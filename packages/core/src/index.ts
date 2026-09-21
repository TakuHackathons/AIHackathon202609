export type ChatMessage = { role: 'user' | 'assistant'; content: string };

/** Incremental sentence segmentation, with a hard limit even without punctuation. */
export class SentenceBuffer {
  private pending = '';
  constructor(private limit = 100) {}
  push(delta: string): string[] {
    this.pending += delta;
    const chunks: string[] = [];
    while (this.pending) {
      const boundary = /[。！？!?\n]/u.exec(this.pending);
      let end = boundary && boundary.index < this.limit ? boundary.index + 1 : 0;
      if (!end && this.pending.length >= this.limit) {
        const prefix = this.pending.slice(0, this.limit);
        const soft = Math.max(prefix.lastIndexOf('、'), prefix.lastIndexOf('，'), prefix.lastIndexOf(' '));
        end = soft >= this.limit / 2 ? soft + 1 : this.limit;
        const code = this.pending.charCodeAt(end - 1);
        if (code >= 0xd800 && code <= 0xdbff) end--;
      }
      if (!end) break;
      const text = this.pending.slice(0, end).trim();
      this.pending = this.pending.slice(end);
      if (text) chunks.push(text);
    }
    return chunks;
  }
  flush(): string[] {
    const text = this.pending.trim();
    this.pending = '';
    return text ? [text] : [];
  }
}

export type ChatEvent = { type: 'delta'; text: string } | { type: 'done' } | { type: 'error'; message: string };
/** SSE parsing across arbitrary UTF-8/network boundaries. */
export async function* readChatStream(response: Response, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
  if (!response.body) throw new Error('応答ストリームがありません。');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const parse = (frame: string): ChatEvent | undefined => {
    const data = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) return;
    const event = JSON.parse(data) as ChatEvent;
    if (event.type === 'delta' && typeof event.text === 'string') return event;
    if (event.type === 'done') return event;
    if (event.type === 'error' && typeof event.message === 'string') return event;
    throw new Error('応答形式が正しくありません。');
  };
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    signal?.throwIfAborted();
    while (true) {
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      buffer += decoder.decode(value, { stream: !done });
      // Normalize CRLF only when the complete delimiter has arrived.
      buffer = buffer.replace(/\r\n/g, '\n');
      let index: number;
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const event = parse(buffer.slice(0, index));
        buffer = buffer.slice(index + 2);
        if (event) {
          yield event;
          if (event.type === 'done' || event.type === 'error') return;
        }
      }
      if (buffer.length > 100000) throw new Error('応答データが大きすぎます。');
      if (done) break;
    }
    if (buffer.trim()) {
      const event = parse(buffer);
      if (event) {
        yield event;
        if (event.type === 'done' || event.type === 'error') return;
      }
    }
    throw new Error('回答の受信が途中で終了しました。もう一度お試しください。');
  } finally {
    signal?.removeEventListener('abort', abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

type AudioResult = { audio: ArrayBuffer } | { error: unknown };
export interface SpeechPorts {
  synthesize(text: string, signal: AbortSignal): Promise<ArrayBuffer>;
  play(audio: ArrayBuffer, text: string): Promise<void>;
  stop(): void;
  onError(error: unknown): void;
}
/** Prepare at most two segments ahead; playback always follows input order. */
export class SpeechQueue {
  private controller = new AbortController();
  private items: { text: string; result?: Promise<AudioResult> }[] = [];
  private next = 0;
  private preparing = 0;
  private closed = false;
  private wake?: () => void;
  private completion: Promise<void>;
  constructor(private ports: SpeechPorts) {
    this.completion = this.consume();
  }
  enqueue(text: string) {
    if (this.closed || this.controller.signal.aborted) return;
    if (this.items.length >= 160) {
      this.ports.onError(new Error('回答が長いため音声を停止しました。'));
      this.cancel();
      return;
    }
    this.items.push({ text });
    this.prepare();
    this.wake?.();
  }
  private prepare() {
    while (!this.controller.signal.aborted && this.preparing < this.items.length && this.preparing < this.next + 2) {
      const item = this.items[this.preparing++];
      item.result = Promise.resolve()
        .then(() => {
          this.controller.signal.throwIfAborted();
          return this.ports.synthesize(item.text, this.controller.signal);
        })
        .then(
          (audio) => ({ audio }),
          (error) => ({ error }),
        );
    }
  }
  finish() {
    this.closed = true;
    this.wake?.();
    return this.completion;
  }
  cancel() {
    this.controller.abort();
    this.closed = true;
    this.ports.stop();
    this.wake?.();
  }
  private async consume() {
    try {
      while (!this.controller.signal.aborted) {
        const item = this.items[this.next];
        if (!item) {
          if (this.closed) return;
          await new Promise<void>((resolve) => {
            this.wake = resolve;
          });
          this.wake = undefined;
          continue;
        }
        const result = await item.result!;
        if (this.controller.signal.aborted) return;
        if ('error' in result) throw result.error;
        await this.ports.play(result.audio, item.text);
        item.result = undefined;
        this.next++;
        this.prepare();
      }
    } catch (error) {
      if (!this.controller.signal.aborted) this.ports.onError(error);
      this.cancel();
    } finally {
      this.items = [];
    }
  }
}
