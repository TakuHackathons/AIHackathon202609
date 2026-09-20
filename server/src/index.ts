import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings } from './bindings';
import { groqRouter } from './routes/groq';
import { geminiRouter } from './routes/gemini';
import { voicevoxRouter } from './routes/voicevox';

const app = new Hono<{ Bindings: Bindings }>();

app.use('/*', cors());

// すべてのAPIルートに /api プレフィックスを付与
const api = app.basePath('/api');

api.get('/', (c) => {
  return c.json({
    message: 'Hello World',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

api.route('/groq', groqRouter);
api.route('/gemini', geminiRouter);
api.route('/voicevox', voicevoxRouter);

export default app;
