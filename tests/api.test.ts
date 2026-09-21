import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voicevoxRouter } from '../server/src/routes/voicevox';
test('VOICEVOX query and synthesis use sample style 3 and stream WAV', async () => {
  const original = globalThis.fetch;
  const calls: { url: URL; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    return url.pathname === '/audio_query' ? Response.json({ speedScale: 1 }) : new Response(new Uint8Array([82, 73, 70, 70]));
  };
  try {
    const response = await voicevoxRouter.request(
      '/speech',
      { method: 'POST', body: JSON.stringify({ text: 'テスト' }), headers: { 'Content-Type': 'application/json' } },
      { VOICEVOX_API_ROOT_URL: 'http://localhost:50021' },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/wav');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url.searchParams.get('text'), 'テスト');
    assert.ok(calls.every((call) => call.url.searchParams.get('speaker') === '3'));
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { speedScale: 1 });
    assert.equal((await response.arrayBuffer()).byteLength, 4);
  } finally {
    globalThis.fetch = original;
  }
});

test('rejects empty speech and returns safe upstream failures', async () => {
  assert.equal(
    (await voicevoxRouter.request('/speech', { method: 'POST', body: '{"text":""}', headers: { 'Content-Type': 'application/json' } }, {}))
      .status,
    400,
  );
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('private connection details');
  };
  try {
    const response = await voicevoxRouter.request(
      '/speech',
      { method: 'POST', body: JSON.stringify({ text: 'こんにちは' }), headers: { 'Content-Type': 'application/json' } },
      {},
    );
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes('private connection'));
  } finally {
    globalThis.fetch = original;
  }
});
