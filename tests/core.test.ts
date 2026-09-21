import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SentenceBuffer, SpeechQueue, readChatStream } from '../packages/core/src/index';
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
test('segments incremental Japanese and limits long sentences without breaking emoji', () => {
  const b = new SentenceBuffer(10);
  assert.deepEqual(b.push('こんにちは'), []);
  assert.deepEqual(b.push('。次の文！最後'), ['こんにちは。', '次の文！']);
  assert.deepEqual(b.flush(), ['最後']);
  const text = 'あ'.repeat(9) + '😀' + 'い'.repeat(20);
  const c = new SentenceBuffer(10);
  const parts = [...c.push(text), ...c.flush()];
  assert.equal(parts.join(''), text);
  assert.ok(parts.every((s) => s.length <= 10 && !/[\uD800-\uDBFF]$/.test(s)));
});
test('SSE survives byte-by-byte UTF8 and CRLF boundaries', async () => {
  const bytes = new TextEncoder().encode(
    'data: ' + JSON.stringify({ type: 'delta', text: 'こんにちは' }) + '\r\n\r\ndata: {"type":"done"}\r\n\r\n',
  );
  const response = new Response(
    new ReadableStream({
      start(c) {
        for (const byte of bytes) c.enqueue(new Uint8Array([byte]));
        c.close();
      },
    }),
  );
  const events = [];
  for await (const event of readChatStream(response)) events.push(event);
  assert.deepEqual(events, [{ type: 'delta', text: 'こんにちは' }, { type: 'done' }]);
});
test('SSE rejects truncated responses', async () => {
  await assert.rejects(async () => {
    for await (const event of readChatStream(new Response('data: {"type":"delta","text":"途中"}\n\n'))) void event;
  }, /途中/);
});
test('speech starts before finish, prefetches only two and preserves order', async () => {
  const pending = new Map<string, (v: ArrayBuffer) => void>();
  const played: string[] = [];
  const q = new SpeechQueue({
    synthesize: (text) => new Promise((resolve) => pending.set(text, resolve)),
    play: async (_, text) => {
      played.push(text);
    },
    stop() {},
    onError(e) {
      throw e;
    },
  });
  q.enqueue('one');
  q.enqueue('two');
  q.enqueue('three');
  await tick();
  assert.deepEqual([...pending.keys()], ['one', 'two']);
  pending.get('two')!(new ArrayBuffer(1));
  await tick();
  assert.deepEqual(played, []);
  pending.get('one')!(new ArrayBuffer(1));
  await tick();
  assert.deepEqual(played, ['one', 'two']);
  pending.get('three')!(new ArrayBuffer(1));
  await q.finish();
  assert.deepEqual(played, ['one', 'two', 'three']);
});
test('cancel prevents late synthesis from playing', async () => {
  let resolve!: (v: ArrayBuffer) => void;
  let played = false;
  let aborted = false;
  const q = new SpeechQueue({
    synthesize: (_, signal) => {
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      return new Promise((r) => (resolve = r));
    },
    play: async () => {
      played = true;
    },
    stop() {},
    onError(e) {
      throw e;
    },
  });
  q.enqueue('one');
  await tick();
  q.cancel();
  resolve(new ArrayBuffer(1));
  await q.finish();
  assert.equal(played, false);
  assert.equal(aborted, true);
});
test('synthesis failure is reported and stops the queue', async () => {
  let errors = 0,
    stops = 0;
  const q = new SpeechQueue({
    synthesize: async () => {
      throw new Error('offline');
    },
    play: async () => {
      assert.fail('must not play');
    },
    stop() {
      stops++;
    },
    onError() {
      errors++;
    },
  });
  q.enqueue('one');
  q.enqueue('two');
  await q.finish();
  assert.equal(errors, 1);
  assert.equal(stops, 1);
});
