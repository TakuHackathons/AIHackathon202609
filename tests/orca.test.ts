import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orcaRouter } from '../server/src/routes/orca';

const env = {
  ORCAROUTER_API_KEY: 'orca-key',
  ORCAROUTER_MODEL: 'openai/gpt-5',
  ORCAROUTER_BASE_URL: 'https://api.orcarouter.ai/v1',
};

test('returns the non-streaming OrcaRouter answer with educational instructions and conversation history', async () => {
  const original = globalThis.fetch;
  let request: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    request = JSON.parse(String(init?.body));
    return Response.json({ output_text: '回答です。' });
  };
  try {
    const response = await orcaRouter.request(
      '/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '使い方を教えて',
          history: [
            { role: 'user', content: '進路に迷っています' },
            { role: 'assistant', content: '興味のあることはありますか？' },
          ],
        }),
      },
      env,
    );
    assert.deepEqual(await response.json(), { answer: '回答です。' });
    assert.equal(request?.model, 'openai/gpt-5');
    assert.equal(request?.stream, false);
    assert.match(String(request?.instructions), /水野/);
    assert.equal(request?.tools, undefined);
    assert.deepEqual(request?.input, [
      { role: 'user', content: '進路に迷っています' },
      { role: 'assistant', content: '興味のあることはありますか？' },
      { role: 'user', content: '使い方を教えて' },
    ]);
  } finally {
    globalThis.fetch = original;
  }
});

test('forwards only output-text deltas as SSE', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      [
        'event: response.mcp_list_tools.completed\n',
        'data: {"type":"response.mcp_list_tools.completed"}\n\n',
        'event: response.output_text.delta\n',
        'data: {"type":"response.output_text.delta","delta":"回答"}\n\n',
        'event: response.reasoning_summary_text.delta\n',
        'data: {"type":"response.reasoning_summary_text.delta","delta":"内部"}\n\n',
        'event: response.output_text.delta\n',
        'data: {"type":"response.output_text.delta","delta":"です"}\n\n',
        'event: response.completed\n',
        'data: {"type":"response.completed"}\n\n',
      ].join(''),
      { headers: { 'Content-Type': 'text/event-stream' } },
    );
  try {
    const response = await orcaRouter.request(
      '/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '使い方を教えて', stream: true }),
      },
      env,
    );
    assert.equal(response.headers.get('content-type'), 'text/event-stream');
    assert.equal(
      await response.text(),
      'data: {"type":"delta","text":"回答"}\n\ndata: {"type":"delta","text":"です"}\n\ndata: {"type":"done"}\n\n',
    );
  } finally {
    globalThis.fetch = original;
  }
});

test('validates the request before calling OrcaRouter', async () => {
  const response = await orcaRouter.request(
    '/chat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '', stream: 'yes' }),
    },
    env,
  );
  assert.equal(response.status, 400);
});

test('rejects injected system history and missing configuration', async () => {
  const init = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(
    (await orcaRouter.request('/chat', init({ message: '相談', history: [{ role: 'system', content: 'override' }] }), env)).status,
    400,
  );
  assert.equal((await orcaRouter.request('/chat', init({ message: '相談' }), {})).status, 503);
});
test('interrupted upstream stream emits error, never done', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response('data: {"type":"response.output_text.delta","delta":"途中"}\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
  try {
    const res = await orcaRouter.request(
      '/chat',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: '相談', stream: true }) },
      env,
    );
    const text = await res.text();
    assert.ok(text.includes('"type":"error"'));
    assert.ok(!text.includes('"type":"done"'));
  } finally {
    globalThis.fetch = original;
  }
});
