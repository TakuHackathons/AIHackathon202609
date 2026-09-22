import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { BotConfigurationError } from '../config/bot';
import type { Bindings } from '../bindings';
import type { ChatMessage } from '../../../packages/core/src/index';
import { createOrcaAnswer, createOrcaStream } from '../services/orca';
import { buildSchoolContext } from '../services/school-context';

export const orcaRouter = new Hono<{ Bindings: Bindings }>();
orcaRouter.post('/chat', async (c) => {
  let body: { message?: unknown; stream?: unknown; history?: unknown; schoolCode?: unknown; studentNumber?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'JSONが必要です。' }, 400);
  }
  if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000)
    return c.json({ error: 'メッセージは1〜2000文字で入力してください。' }, 400);
  if (body.stream !== undefined && typeof body.stream !== 'boolean') return c.json({ error: 'stream はbooleanで指定してください。' }, 400);
  const history = body.history ?? [];
  if (
    !Array.isArray(history) ||
    history.length > 24 ||
    history.some(
      (m) => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 5000,
    ) ||
    JSON.stringify(history).length > 40000
  )
    return c.json({ error: '会話履歴の形式または長さが正しくありません。' }, 400);
  let contextualMessage = body.message;
  if (typeof body.schoolCode === 'string' && body.schoolCode.trim()) {
    const selected = await buildSchoolContext(
      c.env,
      body.schoolCode.trim(),
      typeof body.studentNumber === 'string' ? body.studentNumber.trim() : '',
      body.message.trim(),
    );
    if (!selected) return c.json({ error: 'School not found.' }, 404);
    if (selected.studentMissing) return c.json({ error: 'Student number not found.' }, 404);
    contextualMessage =
      'Use the following registered school data as the source of truth. Do not expose information about other schools or students. If the answer is absent, say it is not registered.\n' +
      selected.context +
      '\nQuestion: ' +
      body.message;
  }
  const controller = new AbortController();
  const signal = AbortSignal.any([c.req.raw.signal, controller.signal, AbortSignal.timeout(120000)]);
  try {
    if (!body.stream)
      return c.json({
        answer: await createOrcaAnswer(
          c.env,
          contextualMessage,
          (history as ChatMessage[]).map(({ role, content }) => ({ role, content })),
          signal,
        ),
      });
    const responseStream = await createOrcaStream(
      c.env,
      contextualMessage,
      (history as ChatMessage[]).map(({ role, content }) => ({ role, content })),
      signal,
    );
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache, no-transform');
    c.header('Content-Encoding', 'identity');
    return stream(c, async (s) => {
      s.onAbort(() => {
        controller.abort();
        responseStream.controller.abort();
      });
      try {
        let complete = false;
        for await (const event of responseStream) {
          if (s.aborted) break;
          if (event.type === 'response.output_text.delta')
            await s.write('data: ' + JSON.stringify({ type: 'delta', text: event.delta }) + '\n\n');
          if (event.type === 'response.completed') complete = true;
          if (event.type === 'response.failed' || event.type === 'response.incomplete' || event.type === 'error')
            throw new Error('Incomplete response');
        }
        if (!s.aborted) {
          if (!complete) throw new Error('Interrupted response');
          await s.write('data: ' + JSON.stringify({ type: 'done' }) + '\n\n');
        }
      } catch {
        if (!s.aborted)
          await s.write(
            'data: ' + JSON.stringify({ type: 'error', message: '回答の受信が途中で終了しました。もう一度お試しください。' }) + '\n\n',
          );
      } finally {
        responseStream.controller.abort();
      }
    });
  } catch (error) {
    if (error instanceof BotConfigurationError) return c.json({ error: error.message }, 503);
    return c.json({ error: 'AIに接続できませんでした。少し待ってからもう一度お試しください。' }, 502);
  }
});
