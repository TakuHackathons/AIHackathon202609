import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import Groq from 'groq-sdk';
import type { Bindings } from '../bindings';
import { JsonEmotionTextParser, buildSystemPrompt, SupportedLocale } from '../lib/sseStreamParser';

const groqRouter = new Hono<{ Bindings: Bindings }>();

groqRouter.post('/chat', async (c) => {
  const body = await c.req.json<{ message: string; locale?: string }>();
  const locale: SupportedLocale = body.locale === 'en' ? 'en' : 'ja';
  const groq = new Groq({ apiKey: c.env.GROQ_API_KEY });

  const chatStream = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: buildSystemPrompt(locale) },
      { role: 'user', content: body.message },
    ],
    model: 'llama-3.3-70b-versatile',
    stream: true,
  });

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  return stream(c, async (s) => {
    const parser = new JsonEmotionTextParser();
    for await (const chunk of chatStream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      await parser.push(delta, s);
    }
    await s.write('data: [DONE]\n\n');
  });
});

export { groqRouter };
