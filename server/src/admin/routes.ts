import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { asc, eq, sql } from 'drizzle-orm';
import { database } from '../db';
import { challenges, passkeys, schools, sessions, users, publicUser, type User } from '../db/schema';
import { authRouter } from './auth';
import { catalogRouter } from './catalog';
import { canAccessSchool, canGrantRole } from './authorization';
import { educationRouter } from './education';
import {
  authenticate,
  body,
  canManage,
  fail,
  field,
  origin,
  passwordHash,
  rateLimit,
  token,
  type AdminContext,
  type AdminEnv,
  username,
} from './security';

export const adminRouter = new Hono<AdminEnv>();

adminRouter.use('*', async (c, next) => {
  if (c.req.header('Content-Type')?.startsWith('multipart/form-data')) return next();
  return bodyLimit({ maxSize: 65_536, onError: (ctx) => ctx.json({ error: 'Request body is too large.' }, 413) })(c, next);
});
adminRouter.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  if (!c.env.DB) return c.json({ error: 'Database is not configured.' }, 503);
  if (!['GET', 'HEAD'].includes(c.req.method) && !c.req.header('Origin')) return c.json({ error: 'Origin header is required.' }, 400);
  if (c.req.path.includes('/auth/') && c.req.method === 'POST')
    await rateLimit(c, 'ip:' + (c.req.header('CF-Connecting-IP') ?? 'local'), 40, 60_000);
  await next();
});
adminRouter.onError((error, c) => {
  if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
  if (/UNIQUE constraint/i.test(error instanceof Error ? error.message : '')) return c.json({ error: 'Already exists.' }, 409);
  console.error(JSON.stringify({ event: 'admin_error', path: c.req.path }));
  return c.json({ error: 'Admin request failed.' }, 500);
});
adminRouter.route('/auth', authRouter);
adminRouter.use('*', async (c, next) => {
  await authenticate(c);
  await next();
});
adminRouter.route('/', educationRouter);
adminRouter.route('/', catalogRouter);

function requireManager(c: AdminContext) {
  if (c.get('user').role === 'general') fail(403, 'Manager role required.');
}
function schoolScope(c: AdminContext, id: number) {
  const actor = c.get('user');
  if (!canAccessSchool(actor, id)) fail(404, 'School not found.');
}
function managementRole(value: unknown): 'admin' | 'general' {
  if (value !== 'admin' && value !== 'general') fail(400, 'Invalid role.');
  return value as 'admin' | 'general';
}
function teacherFields(data: Record<string, unknown>) {
  return {
    name: field(data, 'name', 100),
    email: field(data, 'email', 254, false),
  };
}
function schoolFields(data: Record<string, unknown>) {
  return {
    name: field(data, 'name', 200),
    code: field(data, 'code', 64),
    address: field(data, 'address', 500, false),
    phone: field(data, 'phone', 50, false),
  };
}
function routeId(c: AdminContext, message: string) {
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id < 1) fail(404, message);
  return id;
}
async function teacher(c: AdminContext): Promise<User> {
  const id = routeId(c, 'Teacher not found.');
  const [result] = await database(c.env).select().from(users).where(eq(users.id, id)).limit(1);
  if (!result) fail(404, 'Teacher not found.');
  const actor = c.get('user');
  if (actor.id !== result.id && !canManage(actor, result)) fail(404, 'Teacher not found.');
  return result;
}

adminRouter.get('/schools', async (c) => {
  const actor = c.get('user');
  const list = await database(c.env)
    .select()
    .from(schools)
    .where(actor.role === 'super_admin' ? undefined : eq(schools.id, actor.schoolId!))
    .orderBy(asc(schools.name));
  return c.json({ schools: list });
});
adminRouter.post('/schools', async (c) => {
  if (c.get('user').role !== 'super_admin') fail(403, 'Super admin required.');
  const data = await body(c),
    school = schoolFields(data),
    adminUsername = username(data),
    adminName = field(data, 'adminName', 100),
    temporaryPassword = token(),
    now = Date.now();
  const db = database(c.env);
  const [createdSchool] = await db
    .insert(schools)
    .values({ ...school, createdAt: now, updatedAt: now })
    .returning();
  await db.insert(users).values({
    schoolId: createdSchool.id,
    username: adminUsername,
    name: adminName,
    role: 'admin',
    passwordHash: await passwordHash(temporaryPassword),
    passwordExpiresAt: now + 7 * 86_400_000,
    createdAt: now,
    updatedAt: now,
  });
  const schoolId = createdSchool.id;
  return c.json({ schoolId, username: adminUsername, temporaryPassword }, 201);
});
adminRouter.patch('/schools/:id', async (c) => {
  requireManager(c);
  const id = routeId(c, 'School not found.');
  schoolScope(c, id);
  const [school] = await database(c.env)
    .update(schools)
    .set({ ...schoolFields(await body(c)), updatedAt: Date.now() })
    .where(eq(schools.id, id))
    .returning();
  if (!school) fail(404, 'School not found.');
  return c.json({ school });
});

adminRouter.get('/teachers', async (c) => {
  const actor = c.get('user');
  const list = await database(c.env)
    .select()
    .from(users)
    .where(actor.role === 'super_admin' ? undefined : actor.role === 'admin' ? eq(users.schoolId, actor.schoolId!) : eq(users.id, actor.id))
    .orderBy(asc(users.name));
  return c.json({ teachers: list.map(publicUser) });
});
adminRouter.post('/teachers', async (c) => {
  requireManager(c);
  const actor = c.get('user'),
    data = await body(c),
    schoolId = actor.role === 'super_admin' ? Number(field(data, 'schoolId', 100)) : actor.schoolId!,
    requestedRole = managementRole(data.role),
    role = actor.role === 'super_admin' ? requestedRole : 'general';
  if (!canGrantRole(actor, requestedRole)) fail(403, 'Only super admin can grant the admin role.');
  const [school] = await database(c.env).select({ id: schools.id }).from(schools).where(eq(schools.id, schoolId)).limit(1);
  if (!school) fail(404, 'School not found.');
  const temporaryPassword = token(),
    now = Date.now();
  const [created] = await database(c.env)
    .insert(users)
    .values({
      ...teacherFields(data),
      schoolId,
      username: username(data),
      role,
      passwordHash: await passwordHash(temporaryPassword),
      passwordExpiresAt: now + 7 * 86_400_000,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return c.json({ teacher: publicUser(created), temporaryPassword }, 201);
});
adminRouter.patch('/teachers/:id', async (c) => {
  const current = await teacher(c),
    actor = c.get('user'),
    data = await body(c);
  let role = current.role;
  if (data.role !== undefined && data.role !== current.role) {
    if (current.role === 'super_admin' || !canManage(actor, current)) fail(403, 'Role cannot be changed.');
    const requestedRole = managementRole(data.role);
    if (!canGrantRole(actor, requestedRole)) fail(403, 'Only super admin can grant the admin role.');
    role = requestedRole;
  }
  const [updated] = await database(c.env)
    .update(users)
    .set({ ...teacherFields(data), role, updatedAt: Date.now() })
    .where(eq(users.id, current.id))
    .returning();
  return c.json({ teacher: publicUser(updated) });
});
adminRouter.delete('/teachers/:id', async (c) => {
  requireManager(c);
  const current = await teacher(c),
    actor = c.get('user');
  if (current.id === actor.id || !canManage(actor, current)) fail(403, 'Teacher cannot be deleted.');
  await database(c.env).delete(users).where(eq(users.id, current.id));
  return c.json({ ok: true });
});
adminRouter.post('/teachers/:id/reset-passkeys', async (c) => {
  requireManager(c);
  const current = await teacher(c),
    actor = c.get('user');
  if (current.id === actor.id || !canManage(actor, current)) fail(403, 'Passkeys cannot be reset.');
  const temporaryPassword = token(),
    db = database(c.env);
  await db.batch([
    db
      .update(users)
      .set({
        passwordHash: await passwordHash(temporaryPassword),
        passwordExpiresAt: Date.now() + 86_400_000,
        authVersion: sql`${users.authVersion} + 1`,
        updatedAt: Date.now(),
      })
      .where(eq(users.id, current.id)),
    db.delete(passkeys).where(eq(passkeys.userId, current.id)),
    db.delete(sessions).where(eq(sessions.userId, current.id)),
    db.delete(challenges).where(eq(challenges.userId, current.id)),
  ]);
  return c.json({ username: current.username, temporaryPassword });
});
