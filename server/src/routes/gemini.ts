import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Bindings } from '../bindings';
import { JsonEmotionTextParser, buildSystemPrompt, SupportedLocale } from '../lib/sseStreamParser';

const geminiRouter = new Hono<{ Bindings: Bindings }>();

geminiRouter.post('/chat', async (c) => {
  const body = await c.req.json<{ message: string; locale?: string }>();
  const locale: SupportedLocale = body.locale === 'en' ? 'en' : 'ja';
  const genAI = new GoogleGenerativeAI(c.env.GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    systemInstruction: buildSystemPrompt(locale),
  });

  const result = await model.generateContentStream(body.message);

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  return stream(c, async (s) => {
    const parser = new JsonEmotionTextParser();
    for await (const chunk of result.stream) {
      const delta = chunk.text();
      await parser.push(delta, s);
    }
    await s.write('data: [DONE]\n\n');
  });
});

export { geminiRouter };
