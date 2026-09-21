import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orcaRouter } from '../server/src/routes/orca';

const env = {
  BOT_NAME: 'Product Assistant',
  BOT_DESCRIPTION: 'Productに関する質問に回答するアシスタント',
  GITHUB_REPOSITORY: 'owner/repository',
  DOCUMENTATION_URL: 'https://docs.example.com/',
  ORCAROUTER_API_KEY: 'orca-key',
  ORCAROUTER_MODEL: 'openai/gpt-5',
  ORCAROUTER_BASE_URL: 'https://api.orcarouter.ai/v1',
  GITHUB_MCP_SERVER_URL: 'https://api.githubcopilot.com/mcp/',
  GITHUB_MCP_PAT: 'github-token',
  EXA_MCP_SERVER_URL: 'https://mcp.exa.ai/mcp',
};

test('returns the non-streaming OrcaRouter answer with shared MCP settings', async () => {
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
        body: JSON.stringify({ message: '使い方を教えて' }),
      },
      env,
    );
    assert.deepEqual(await response.json(), { answer: '回答です。' });
    assert.equal(request?.model, 'openai/gpt-5');
    assert.equal(request?.stream, false);
    assert.match(String(request?.instructions), /owner\/repository/);
    assert.deepEqual(request?.tools, [
      {
        type: 'mcp',
        server_label: 'github',
        server_url: 'https://api.githubcopilot.com/mcp/',
        headers: { Authorization: 'Bearer github-token' },
        require_approval: 'never',
      },
      {
        type: 'mcp',
        server_label: 'documentation',
        server_url: 'https://mcp.exa.ai/mcp',
        require_approval: 'never',
      },
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
