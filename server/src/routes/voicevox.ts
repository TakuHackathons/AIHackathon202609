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

export { voicevoxRouter };
