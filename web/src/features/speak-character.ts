import { EmotionType } from './vrmViewer/model';
import { Viewer } from './vrmViewer/viewer';
import { Speaker, resolveStyleId } from '../lib/speakersAtom';

const voiceVoxApiBase = '/api/voicevox';

// ----------------------------------------------------------------
// VoiceVox Speakers
// ----------------------------------------------------------------

export async function loadSpeackers(): Promise<any[]> {
  const res = await fetch(`${voiceVoxApiBase}/speakers`);
  return res.json();
}

// ----------------------------------------------------------------
// 音声合成（内部ユーティリティ）
// ----------------------------------------------------------------

async function synthesizeAudio(speackerId: number, text: string): Promise<ArrayBuffer> {
  const audioQueryUrl = new URL(`${location.origin}${voiceVoxApiBase}/audio_query`);
  audioQueryUrl.searchParams.set('text', text);
  audioQueryUrl.searchParams.set('speaker', speackerId.toString());
  const audioQueryRes = await fetch(audioQueryUrl.toString(), { method: 'POST' });
  const audioQuery = await audioQueryRes.json();

  const synthesisUrl = new URL(`${location.origin}${voiceVoxApiBase}/synthesis`);
  synthesisUrl.searchParams.set('speaker', speackerId.toString());
  const synthesisRes = await fetch(synthesisUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(audioQuery),
  });
  return synthesisRes.arrayBuffer();
}

// ----------------------------------------------------------------
// SSE ストリームパーサー
// ----------------------------------------------------------------

export type GroqStreamEvent = { type: 'emotion'; value: EmotionType } | { type: 'delta'; value: string } | { type: 'done' };

async function* readGroqStream(response: Response): AsyncGenerator<GroqStreamEvent> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') {
        yield { type: 'done' };
        return;
      }
      try {
        const parsed = JSON.parse(payload) as { type: string; value: string };
        if (parsed.type === 'emotion') {
          yield { type: 'emotion', value: parsed.value as EmotionType };
        } else if (parsed.type === 'delta') {
          yield { type: 'delta', value: parsed.value };
        }
      } catch {
        // malformed chunk — skip
      }
    }
  }
}

// ----------------------------------------------------------------
// センテンス分割器
// ----------------------------------------------------------------

class SentenceBuffer {
  private buf = '';
  private static readonly DELIMITERS = /[。．！？!?\n]/;

  push(text: string): string[] {
    this.buf += text;
    const results: string[] = [];
    let pos: number;
    while ((pos = this.findDelimiter()) !== -1) {
      const sentence = this.buf.slice(0, pos + 1).trim();
      this.buf = this.buf.slice(pos + 1);
      if (sentence.length > 0) results.push(sentence);
    }
    return results;
  }

  flush(): string[] {
    const remaining = this.buf.trim();
    this.buf = '';
    return remaining.length > 0 ? [remaining] : [];
  }

  private findDelimiter(): number {
    for (let i = 0; i < this.buf.length; i++) {
      if (SentenceBuffer.DELIMITERS.test(this.buf[i])) return i;
    }
    return -1;
  }
}

// ----------------------------------------------------------------
// メイン: Groq SSE ストリームを受け取り順次再生
//
// speaker を受け取り、感情が確定した時点で resolveStyleId() で
// 対応するスタイル ID を自動決定する。
// ----------------------------------------------------------------

export async function speakCharacterStream(
  speaker: Speaker,
  groqResponse: Response,
  viewer: Viewer,
  onEmotion?: (emotion: EmotionType) => void,
  onDelta?: (delta: string) => void,
): Promise<void> {
  const synthesisQueue: { promise: Promise<ArrayBuffer>; expression: EmotionType }[] = [];
  const sentenceBuffer = new SentenceBuffer();
  let currentEmotion: EmotionType = 'neutral';

  const enqueueSynthesis = (sentence: string) => {
    // 感情に対応したスタイル ID をその時点で解決してキューに積む
    const styleId = resolveStyleId(speaker, currentEmotion);
    synthesisQueue.push({
      promise: synthesizeAudio(styleId, sentence),
      expression: currentEmotion,
    });
  };

  for await (const event of readGroqStream(groqResponse)) {
    if (event.type === 'emotion') {
      currentEmotion = event.value;
      onEmotion?.(currentEmotion);
    } else if (event.type === 'delta') {
      onDelta?.(event.value);
      const sentences = sentenceBuffer.push(event.value);
      for (const s of sentences) enqueueSynthesis(s);
    }
  }

  for (const s of sentenceBuffer.flush()) enqueueSynthesis(s);

  for (const { promise, expression } of synthesisQueue) {
    const buffer = await promise;
    await viewer.model?.speak(buffer, expression);
  }
}
