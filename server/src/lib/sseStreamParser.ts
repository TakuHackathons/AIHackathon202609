/**
 * sseStreamParser.ts
 *
 * LLM から {"emotion":"...","text":"..."} 形式の JSON をストリームで受け取り、
 * SSE イベントとして書き出す共通ステートマシン。
 *
 * 出力イベント:
 *   data: {"type":"emotion","value":"happy"}  … 感情（最初の1回）
 *   data: {"type":"delta","value":"テキスト"} … テキスト断片
 *   data: [DONE]                              … 終端
 */

export type SseWriter = {
  write: (data: string) => Promise<void>;
};

export class JsonEmotionTextParser {
  private rawBuf = '';
  private textBuf = '';
  private emotionSent = false;
  private state: 'before_text' | 'in_text' | 'done' = 'before_text';

  async push(delta: string, writer: SseWriter): Promise<void> {
    if (!delta) return;
    this.rawBuf += delta;

    // emotion を最初の1回だけ抽出して送信
    if (!this.emotionSent) {
      const m = this.rawBuf.match(/"emotion"\s*:\s*"([^"]+)"/);
      if (m) {
        await writer.write(`data: ${JSON.stringify({ type: 'emotion', value: m[1] })}\n\n`);
        this.emotionSent = true;
      }
    }

    // "text": " を探して以降の文字を delta として流す
    if (this.state === 'before_text') {
      const idx = this.rawBuf.indexOf('"text"');
      if (idx !== -1) {
        const after = this.rawBuf.slice(idx + 6);
        const m = after.match(/^\s*:\s*"/);
        if (m) {
          this.rawBuf = after.slice(m[0].length);
          this.state = 'in_text';
        }
      }
    }

    if (this.state === 'in_text') {
      let i = 0;
      while (i < this.rawBuf.length) {
        const ch = this.rawBuf[i];
        if (ch === '\\' && i + 1 < this.rawBuf.length) {
          const next = this.rawBuf[i + 1];
          const decoded: Record<string, string> = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\' };
          this.textBuf += decoded[next] ?? next;
          i += 2;
        } else if (ch === '"') {
          this.state = 'done';
          i++;
          break;
        } else {
          this.textBuf += ch;
          i++;
        }
      }
      this.rawBuf = this.rawBuf.slice(i);

      if (this.textBuf.length > 0) {
        await writer.write(`data: ${JSON.stringify({ type: 'delta', value: this.textBuf })}\n\n`);
        this.textBuf = '';
      }
    }
  }
}

export type SupportedLocale = 'ja' | 'en';

export function buildSystemPrompt(locale: SupportedLocale): string {
  const languageInstruction = locale === 'ja' ? 'Always respond in natural Japanese.' : 'Always respond in natural English.';

  return `You are a friendly AI assistant.
${languageInstruction}
Always respond ONLY with a single JSON object in the following format, with no extra text outside the JSON:
{"emotion":"<emotion>","text":"<your response>"}

emotion must be one of: neutral, happy, angry, sad, relaxed
Choose the emotion that best matches the mood of your response.
The "text" field must contain your full response.`;
}

/** 後方互換のためデフォルトは日本語 */
export const SYSTEM_PROMPT = buildSystemPrompt('ja');
