import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { BotConfigurationError } from '../config/bot';
import type { Bindings } from '../bindings';
import { createOrcaAnswer, createOrcaStream } from '../services/orca';

const orcaRouter = new Hono<{ Bindings: Bindings }>();

orcaRouter.post('/chat', async (c) => {
  let body: { message?: unknown; stream?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'JSONが必要です。' }, 400);
  }

  if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 10_000)
    return c.json({ error: 'message は1〜10000文字の文字列で指定してください。' }, 400);
  if (body.stream !== undefined && typeof body.stream !== 'boolean') return c.json({ error: 'stream はbooleanで指定してください。' }, 400);

  try {
    if (!body.stream) return c.json({ answer: await createOrcaAnswer(c.env, body.message) });

    const responseStream = await createOrcaStream(c.env, body.message);
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    return stream(c, async (s) => {
      for await (const event of responseStream) {
        if (event.type === 'response.output_text.delta') await s.write(`data: ${JSON.stringify({ type: 'delta', text: event.delta })}\n\n`);
      }
      await s.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    });
  } catch (error) {
    if (error instanceof BotConfigurationError) return c.json({ error: error.message }, 503);
    return c.json({ error: 'OrcaRouterへの接続に失敗しました。設定と起動状態を確認してください。' }, 502);
  }
});

export { orcaRouter };
