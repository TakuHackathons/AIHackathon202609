declare const process: {
  env: Record<string, string | undefined>;
  exitCode?: number;
};

export {};

const baseUrl = (process.env.ORCA_E2E_BASE_URL || 'http://localhost:8787').replace(/\/$/, '');
const endpoint = `${baseUrl}/api/orca/chat`;

type E2eFailure = {
  name: string;
  status: number | 'network error';
  reason: string;
  response?: string;
};

const failures: E2eFailure[] = [];

function redact(text: string): string {
  return text
    .replace(/\bBearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/(["']?(?:api[_-]?key|authorization|token|pat|password|secret)["']?\s*[:=]\s*["']?)([^"',\s}]+)/gi, '$1[REDACTED]')
    .replace(/\b(?:sk-[\w-]+|ghp_[\w-]+|github_pat_[\w-]+)/gi, '[REDACTED]');
}

function excerpt(text: string): string {
  return redact(text).replace(/\s+/g, ' ').slice(0, 500);
}

function fail(failure: E2eFailure) {
  failures.push(failure);
  console.error(`[FAIL] ${failure.name}`);
  console.error(`  status: ${failure.status}`);
  console.error(`  reason: ${failure.reason}`);
  if (failure.response) console.error(`  response: ${failure.response}`);
}

async function post(name: string, body: Record<string, unknown>): Promise<Response | undefined> {
  try {
    return await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    fail({ name, status: 'network error', reason: error instanceof Error ? error.message : 'request failed' });
  }
}

async function expectAnswer(name: string, message: string) {
  const response = await post(name, { message });
  if (!response) return;

  const body = await response.text();
  if (!response.ok) return fail({ name, status: response.status, reason: 'expected HTTP 200', response: excerpt(body) });
  if (!response.headers.get('content-type')?.includes('application/json'))
    return fail({ name, status: response.status, reason: 'expected application/json', response: excerpt(body) });

  try {
    const data = JSON.parse(body) as { answer?: unknown };
    if (typeof data.answer !== 'string' || !data.answer.trim())
      return fail({ name, status: response.status, reason: 'answer is not a non-empty string', response: excerpt(body) });
  } catch {
    return fail({ name, status: response.status, reason: 'response is not valid JSON', response: excerpt(body) });
  }

  console.log(`[PASS] ${name}`);
}

function parseSse(body: string): { type: string; text?: unknown }[] {
  return body
    .replace(/\r\n/g, '\n')
    .split('\n\n')
    .filter((event) => event.trim())
    .map((event) => {
      const data = event
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data) throw new Error('SSE event has no data field');
      return JSON.parse(data) as { type: string; text?: unknown };
    });
}

async function expectStream() {
  const name = 'streaming';
  const response = await post(name, {
    message: '公式ドキュメントを確認して、このプロダクトの使い方を簡潔に説明してください',
    stream: true,
  });
  if (!response) return;

  const body = await response.text();
  if (!response.ok) return fail({ name, status: response.status, reason: 'expected HTTP 200', response: excerpt(body) });
  if (!response.headers.get('content-type')?.includes('text/event-stream'))
    return fail({ name, status: response.status, reason: 'expected text/event-stream', response: excerpt(body) });

  try {
    const events = parseSse(body);
    const eventTypes = events.map((event) => event.type);
    if (!events.some((event) => event.type === 'delta' && typeof event.text === 'string' && event.text.length > 0))
      throw new Error('no non-empty delta event received');
    if (eventTypes.at(-1) !== 'done') throw new Error('the final event is not done');
    if (eventTypes.some((type) => type !== 'delta' && type !== 'done'))
      throw new Error(`non-public SSE event type received: ${eventTypes.filter((type) => type !== 'delta' && type !== 'done').join(', ')}`);
  } catch (error) {
    return fail({
      name,
      status: response.status,
      reason: error instanceof Error ? error.message : 'invalid SSE response',
      response: excerpt(body),
    });
  }

  console.log(`[PASS] ${name}`);
}

async function main() {
  console.log(`Orca E2E target: ${endpoint}`);
  await expectAnswer('non-stream', 'このプロダクトの概要を、利用可能な情報源を確認して簡潔に説明してください');
  await expectAnswer(
    'GitHub MCP scenario',
    'GitHubリポジトリを確認して、現在の実装または最新Releaseで確認できる重要な変更を簡潔に説明してください。確認できた情報だけを答えてください。',
  );
  await expectAnswer(
    'Exa MCP scenario',
    '公式ドキュメントを確認して、このプロダクトの主要な設定または利用手順を簡潔に説明してください。確認できた情報だけを答えてください。',
  );
  await expectStream();

  if (failures.length) {
    console.error(`\n${failures.length} E2E scenario(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log('\nAll Orca E2E scenarios passed.');
  }
}

void main().catch((error) => {
  console.error(`[FAIL] E2E runner: ${error instanceof Error ? redact(error.message) : 'unexpected error'}`);
  process.exitCode = 1;
});
