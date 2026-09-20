import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveRouter } from '../server/src/routes/live';

test('rejects invalid input and missing credentials without upstream requests', async () => {
  assert.equal((await liveRouter.request('/resolve?video=invalid', {}, {})).status, 400);
  assert.equal((await liveRouter.request('/resolve?video=abcdefghijk', {}, {})).status, 503);
  assert.equal(
    (await liveRouter.request('/speech', { method: 'POST', body: '{"text":""}', headers: { 'Content-Type': 'application/json' } }, {}))
      .status,
    400,
  );
});
test('resolves live video and normalizes comments with continuation interval', async () => {
  const original = globalThis.fetch;
  const urls: URL[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    if (url.pathname.endsWith('/videos'))
      return Response.json({ items: [{ snippet: { title: 'Live' }, liveStreamingDetails: { activeLiveChatId: 'chat' } }] });
    return Response.json({
      nextPageToken: 'next',
      pollingIntervalMillis: 7000,
      items: [
        {
          id: '1',
          snippet: { type: 'textMessageEvent', displayMessage: 'こんにちは', publishedAt: '2026-09-20T00:00:00Z' },
          authorDetails: { displayName: 'viewer' },
        },
        { id: '2', snippet: { type: 'messageDeletedEvent' } },
      ],
    });
  };
  try {
    const env = { YOUTUBE_API_KEY: 'test-key' };
    const resolved = await liveRouter.request('/resolve?video=abcdefghijk', {}, env);
    assert.deepEqual(await resolved.json(), { liveChatId: 'chat', title: 'Live' });
    const response = await liveRouter.request('/comments?liveChatId=chat&pageToken=previous', {}, env);
    const data = await response.json();
    assert.equal(data.comments.length, 1);
    assert.equal(data.comments[0].text, 'こんにちは');
    assert.equal(data.pollingIntervalMillis, 7000);
    assert.equal(data.nextPageToken, 'next');
    assert.equal(urls[1].searchParams.get('pageToken'), 'previous');
    assert.equal(urls[1].searchParams.get('key'), 'test-key');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally {
    globalThis.fetch = original;
  }
});
test('VOICEVOX query and synthesis use sample style 3 and stream WAV', async () => {
  const original = globalThis.fetch;
  const calls: { url: URL; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    return url.pathname === '/audio_query' ? Response.json({ speedScale: 1 }) : new Response(new Uint8Array([82, 73, 70, 70]));
  };
  try {
    const response = await liveRouter.request(
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
test('reports upstream quota errors without exposing API key', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: { errors: [{ reason: 'quotaExceeded' }] } }, { status: 403 });
  try {
    const response = await liveRouter.request('/resolve?video=abcdefghijk', {}, { YOUTUBE_API_KEY: 'secret-test-key' });
    assert.equal(response.status, 502);
    const text = await response.text();
    assert.match(text, /quotaExceeded/);
    assert.ok(!text.includes('secret-test-key'));
  } finally {
    globalThis.fetch = original;
  }
});
