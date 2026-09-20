import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LiveSession, videoIdFromInput, wait, type LiveComment } from '../packages/core/src/index';

test('accepts video IDs and supported YouTube URLs, rejects other hosts', () => {
  for (const input of [
    'abcdefghijk',
    'https://youtu.be/abcdefghijk?t=1',
    'https://www.youtube.com/watch?v=abcdefghijk',
    'https://youtube.com/live/abcdefghijk',
  ])
    assert.equal(videoIdFromInput(input), 'abcdefghijk');
  for (const input of ['', 'https://example.com/watch?v=abcdefghijk', 'abc']) assert.throws(() => videoIdFromInput(input));
});
test('wait aborts promptly', async () => {
  const controller = new AbortController();
  const pending = wait(10000, controller.signal);
  controller.abort();
  await assert.rejects(pending);
});
test('skips history and duplicates; plays a bounded queue in order without overlapping', async () => {
  const spoken: string[] = [];
  let maxSpeaking = 0;
  let speaking = 0;
  let drops = 0;
  const comment = (id: string): LiveComment => ({ id, text: id, author: 'viewer', publishedAt: new Date(Date.now() + 1000).toISOString() });
  let session: LiveSession;
  session = new LiveSession(
    {
      poll: async () => ({
        comments: [{ ...comment('history'), publishedAt: '2020-01-01T00:00:00Z' }, comment('a'), comment('a'), comment('b'), comment('c')],
        nextPageToken: 'next',
        pollingIntervalMillis: 1000,
        ended: false,
      }),
      speak: async (comment) => {
        speaking++;
        maxSpeaking = Math.max(maxSpeaking, speaking);
        await new Promise((resolve) => setTimeout(resolve, 5));
        spoken.push(comment.id);
        speaking--;
        if (spoken.length === 2) session.stop();
      },
      onQueue: (_, skipped) => {
        drops = skipped;
      },
      onError: (error) => {
        throw error;
      },
    },
    2,
  );
  await session.run();
  assert.deepEqual(spoken, ['b', 'c']);
  assert.equal(maxSpeaking, 1);
  assert.equal(drops, 1);
});
test('passes the continuation token and respects the poll interval', async () => {
  const tokens: (string | undefined)[] = [];
  const times: number[] = [];
  let ended = false;
  const session = new LiveSession({
    poll: async (token) => {
      tokens.push(token);
      times.push(Date.now());
      return { comments: [], nextPageToken: 'next', pollingIntervalMillis: 1000, ended: tokens.length === 2 };
    },
    speak: async () => {},
    onError: (error) => {
      throw error;
    },
    onEnd: () => {
      ended = true;
    },
  });
  await session.run();
  assert.deepEqual(tokens, [undefined, 'next']);
  assert.ok(times[1] - times[0] >= 950);
  assert.equal(ended, true);
});
test('stops the whole session on upstream failure', async () => {
  const errors: unknown[] = [];
  const session = new LiveSession({
    poll: async () => {
      throw new Error('quotaExceeded');
    },
    speak: async () => {
      assert.fail('must not speak');
    },
    onError: (error) => {
      errors.push(error);
    },
  });
  await session.run();
  assert.equal(errors.length, 1);
});
