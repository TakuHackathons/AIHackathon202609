import { Hono } from 'hono';
import type { Bindings } from '../bindings';

const voicevoxRouter = new Hono<{ Bindings: Bindings }>();

/**
 * GET /speakers
 * VoiceVox の話者一覧を返す。
 */
voicevoxRouter.get('/speakers', async (c) => {
  const res = await fetch(`${c.env.VOICEVOX_API_ROOT_URL}/speakers`);
  return c.json(await res.json());
});

/**
 * POST /audio_query?text=...&speaker=...
 * テキストと speaker ID から音声合成クエリを生成する。
 */
voicevoxRouter.post('/audio_query', async (c) => {
  const { text, speaker } = c.req.query();
  const url = new URL(`${c.env.VOICEVOX_API_ROOT_URL}/audio_query`);
  url.searchParams.set('text', text);
  url.searchParams.set('speaker', speaker);
  const res = await fetch(url.toString(), { method: 'POST' });
  return c.json(await res.json());
});

/**
 * POST /synthesis?speaker=...
 * audio_query の結果から WAV 音声を合成して返す。
 */
voicevoxRouter.post('/synthesis', async (c) => {
  const { speaker } = c.req.query();
  const url = new URL(`${c.env.VOICEVOX_API_ROOT_URL}/synthesis`);
  url.searchParams.set('speaker', speaker);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await c.req.json()),
  });
  return new Response(await res.arrayBuffer(), {
    headers: { 'Content-Type': 'audio/wav' },
  });
});

/**
 * GET /version
 * VoiceVox エンジンのバージョンを返す。
 */
voicevoxRouter.get('/version', async (c) => {
  const res = await fetch(`${c.env.VOICEVOX_API_ROOT_URL}/version`);
  return c.json(await res.json());
});

/**
 * GET /engine_manifest
 * VoiceVox エンジンマニフェストを返す。
 */
voicevoxRouter.get('/engine_manifest', async (c) => {
  const res = await fetch(`${c.env.VOICEVOX_API_ROOT_URL}/engine_manifest`);
  return c.json(await res.json());
});

class UpstreamError extends Error {}
voicevoxRouter.onError((error, c) =>
  c.json(
    { error: error instanceof UpstreamError ? error.message : 'VOICEVOXに接続できません。エンジンの起動状態を確認してください。' },
    502,
  ),
);
voicevoxRouter.post('/speech', async (c) => {
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

export { voicevoxRouter };
