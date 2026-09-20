export interface LiveComment {
  id: string;
  text: string;
  author: string;
  publishedAt: string;
}
export interface CommentPage {
  comments: LiveComment[];
  nextPageToken?: string;
  pollingIntervalMillis: number;
  ended: boolean;
}
export interface LivePorts {
  poll(token: string | undefined, signal: AbortSignal): Promise<CommentPage>;
  speak(comment: LiveComment, signal: AbortSignal): Promise<void>;
  onError(error: unknown): void;
  onQueue?(length: number, dropped: number): void;
  onEnd?(): void;
}
export function videoIdFromInput(input: string): string {
  const value = input.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const id =
      host === 'youtu.be'
        ? url.pathname.slice(1)
        : ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)
          ? url.searchParams.get('v') || url.pathname.match(/^\/live\/([\w-]+)/)?.[1]
          : null;
    if (id && /^[\w-]{11}$/.test(id)) return id;
  } catch {}
  throw new Error('YouTubeの動画URLまたは11文字の動画IDを入力してください。');
}
export function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}
/** UI-independent polling and bounded sequential playback. */
export class LiveSession {
  private controller = new AbortController();
  private queue: LiveComment[] = [];
  private seen = new Set<string>();
  private dropped = 0;
  private started = false;
  private startedAt = 0;
  constructor(
    private ports: LivePorts,
    private maxQueue = 50,
  ) {}
  stop() {
    this.controller.abort();
    this.queue = [];
    this.report();
  }
  async run() {
    if (this.started) throw new Error('Session already started');
    this.started = true;
    this.startedAt = Date.now();
    await Promise.all([this.poll(), this.play()]);
  }
  private report() {
    this.ports.onQueue?.(this.queue.length, this.dropped);
  }
  private async poll() {
    const signal = this.controller.signal;
    let token: string | undefined;
    try {
      while (!signal.aborted) {
        const page = await this.ports.poll(token, signal);
        if (signal.aborted) return;
        for (const comment of page.comments) {
          if (this.seen.has(comment.id)) continue;
          this.seen.add(comment.id);
          if (this.seen.size > 10000) this.seen.delete(this.seen.values().next().value!);
          if (Date.parse(comment.publishedAt) < this.startedAt || !comment.text.trim()) continue;
          if (this.queue.length >= this.maxQueue) {
            this.queue.shift();
            this.dropped++;
          }
          this.queue.push(comment);
        }
        this.report();
        if (page.ended) {
          this.ports.onEnd?.();
          this.stop();
          return;
        }
        if (!page.nextPageToken) throw new Error('YouTubeから継続トークンを取得できませんでした。');
        token = page.nextPageToken;
        await wait(Math.max(1000, page.pollingIntervalMillis), signal);
      }
    } catch (error) {
      if (!signal.aborted) {
        this.ports.onError(error);
        this.stop();
      }
    }
  }
  private async play() {
    const signal = this.controller.signal;
    try {
      while (!signal.aborted) {
        const comment = this.queue.shift();
        this.report();
        if (!comment) {
          await wait(100, signal);
          continue;
        }
        await this.ports.speak(comment, signal);
      }
    } catch (error) {
      if (!signal.aborted) {
        this.ports.onError(error);
        this.stop();
      }
    }
  }
}
