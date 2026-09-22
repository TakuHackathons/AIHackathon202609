import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings } from './bindings';
import { groqRouter } from './routes/groq';
import { geminiRouter } from './routes/gemini';
import { voicevoxRouter } from './routes/voicevox';
import { orcaRouter } from './routes/orca';
import { adminRouter } from './admin/routes';
import { Hono as SchoolHono } from 'hono';
import { buildSchoolContext } from './services/school-context';

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
api.route('/orca', orcaRouter);
api.route('/admin', adminRouter);
const schoolApi = new SchoolHono<{ Bindings: Bindings }>();
schoolApi.post('/select', async (c) => {
  const d = (await c.req.json()) as { schoolCode?: string; studentNumber?: string };
  const r = await buildSchoolContext(c.env, d.schoolCode?.trim() || '', d.studentNumber?.trim() || '');
  if (!r) return c.json({ error: '学校が見つかりません。' }, 404);
  if (r.studentMissing) return c.json({ error: '学生番号が見つかりません。' }, 404);
  return c.json({ school: { code: r.school.code, name: r.school.name }, studentNumber: r.student?.studentNumber || '' });
});
api.route('/school-context', schoolApi);

export default app;
