import { Hono } from 'hono';
import type { Bindings } from '../bindings';
import { videoIdFromInput, type CommentPage } from '../../../packages/core/src/index';

export const liveRouter = new Hono<{ Bindings: Bindings }>();
class UpstreamError extends Error {}
async function youtube(path: string, params: Record<string, string>, key: string, signal: AbortSignal) {
  const url = new URL('https://www.googleapis.com/youtube/v3/' + path);
  url.search = new URLSearchParams({ ...params, key }).toString();
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
  if (!response.ok) {
    const body = (await response.json()) as { error?: { errors?: { reason?: string }[] } };
    const reason = body.error?.errors?.[0]?.reason || String(response.status);
    throw new UpstreamError('YouTube API: ' + reason + '（API設定・割当量・配信状態を確認してください）');
  }
  return response.json();
}
liveRouter.onError((error, c) =>
  c.json(
    { error: error instanceof UpstreamError ? error.message : '外部サービスへの接続に失敗しました。設定と起動状態を確認してください。' },
    502,
  ),
);
liveRouter.get('/resolve', async (c) => {
  let id: string;
  try {
    id = videoIdFromInput(c.req.query('video') || '');
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
  if (!c.env.YOUTUBE_API_KEY) return c.json({ error: 'server/.dev.vars に YOUTUBE_API_KEY を設定してください。' }, 503);
  const data = (await youtube('videos', { id, part: 'liveStreamingDetails,snippet' }, c.env.YOUTUBE_API_KEY, c.req.raw.signal)) as {
    items?: { snippet: { title: string }; liveStreamingDetails?: { activeLiveChatId?: string } }[];
  };
  const video = data.items?.[0];
  if (!video?.liveStreamingDetails?.activeLiveChatId)
    return c.json({ error: '配信中でチャットが有効な動画が見つかりません。録画済み動画には接続できません。' }, 400);
  return c.json({ liveChatId: video.liveStreamingDetails.activeLiveChatId, title: video.snippet.title });
});
liveRouter.get('/comments', async (c) => {
  const liveChatId = c.req.query('liveChatId');
  if (!liveChatId || liveChatId.length > 1000) return c.json({ error: 'liveChatId が必要です。' }, 400);
  if (!c.env.YOUTUBE_API_KEY) return c.json({ error: 'YOUTUBE_API_KEY が未設定です。' }, 503);
  const params: Record<string, string> = { liveChatId, part: 'snippet,authorDetails', maxResults: '200' };
  const token = c.req.query('pageToken');
  if (token) params.pageToken = token;
  const data = (await youtube('liveChat/messages', params, c.env.YOUTUBE_API_KEY, c.req.raw.signal)) as {
    nextPageToken?: string;
    pollingIntervalMillis?: number;
    offlineAt?: string;
    items?: {
      id: string;
      snippet: { type: string; displayMessage?: string; publishedAt: string };
      authorDetails?: { displayName?: string };
    }[];
  };
  const result: CommentPage = {
    comments: (data.items || [])
      .filter((item) => ['textMessageEvent', 'superChatEvent'].includes(item.snippet.type) && item.snippet.displayMessage)
      .map((item) => ({
        id: item.id,
        text: item.snippet.displayMessage!.slice(0, 500),
        author: item.authorDetails?.displayName || '',
        publishedAt: item.snippet.publishedAt,
      })),
    nextPageToken: data.nextPageToken,
    pollingIntervalMillis: data.pollingIntervalMillis || 5000,
    ended: !!data.offlineAt,
  };
  c.header('Cache-Control', 'no-store');
  return c.json(result);
});
liveRouter.post('/speech', async (c) => {
  let body: { text?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'JSONが必要です。' }, 400);
  }
  if (typeof body?.text !== 'string' || !body.text.trim() || body.text.length > 500)
    return c.json({ error: '読み上げテキストは1〜500文字で指定してください。' }, 400);
  const root = (c.env.VOICEVOX_API_ROOT_URL || 'http://127.0.0.1:50021').replace(/\/$/, '');
  const signal = AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(60000)]);
  const query = await fetch(root + '/audio_query?' + new URLSearchParams({ text: body.text, speaker: '3' }), { method: 'POST', signal });
  if (!query.ok) throw new UpstreamError('VOICEVOX audio_query: ' + query.status);
  const audio = await fetch(root + '/synthesis?speaker=3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await query.json()),
    signal,
  });
  if (!audio.ok) throw new UpstreamError('VOICEVOX synthesis: ' + audio.status);
  return new Response(audio.body, { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' } });
});
