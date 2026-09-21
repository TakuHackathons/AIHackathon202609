import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';
import type { Bindings } from '../bindings';
import { database } from '../db';
import { sessions, users, attempts, challenges, type User } from '../db/schema';

export type AdminEnv = { Bindings: Bindings; Variables: { user: User; session: typeof sessions.$inferSelect } };
export type AdminContext = Context<AdminEnv>;
export const fail = (status: 400 | 401 | 403 | 404 | 409 | 429 | 503, message: string): never => {
  throw new HTTPException(status, { message });
};
export const token = () => base64(crypto.getRandomValues(new Uint8Array(32)));
export function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}
export function unbase64(text: string) {
  return Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
}
export async function hash(text: string) {
  return base64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
}
export async function passwordHash(password: string, salt = base64(crypto.getRandomValues(new Uint8Array(16)))) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unbase64(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return 'pbkdf2-sha256:100000:' + salt + ':' + base64(new Uint8Array(derived));
}
export async function verifyPassword(password: string, encoded: string | null) {
  const parts = (encoded ?? 'pbkdf2-sha256:100000:AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA').split(':');
  const result = await passwordHash(password, parts[2]);
  const a = new TextEncoder().encode(result),
    b = new TextEncoder().encode(encoded ?? '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ (b[i] ?? 0);
  return diff === 0;
}
const localAdminOrigins = new Set(['http://localhost:3000', 'http://127.0.0.1:3000']);
export function origin(c: AdminContext) {
  const requested = c.req.header('Origin');
  const raw = c.env.ADMIN_ORIGIN || (requested && localAdminOrigins.has(requested) ? requested : 'http://localhost:3000');
  const url = new URL(raw);
  if (url.origin !== raw || (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)))
    fail(503, 'ADMIN_ORIGINを正しい公開URLに設定してください。');
  return { origin: url.origin, rpID: url.hostname, secure: url.protocol === 'https:' };
}
export async function body(c: AdminContext): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await c.req.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, '入力形式が正しくありません。');
    return value as Record<string, unknown>;
  } catch {
    return fail(400, 'JSON形式で入力してください。');
  }
}
export function field(data: Record<string, unknown>, key: string, max = 200, required = true) {
  const value = data[key];
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) return fail(400, key + 'を確認してください。');
  return value.trim();
}
export function username(data: Record<string, unknown>) {
  const value = field(data, 'username', 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(value)) fail(400, 'ユーザー名は英数字・ドット・ハイフン・アンダースコアの3〜64文字です。');
  return value;
}
const cookieName = 'teacher_session';
export async function currentSession(c: AdminContext) {
  const raw = getCookie(c, cookieName);
  if (!raw) return null;
  const db = database(c.env);
  const [record] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, await hash(raw)), gt(sessions.expiresAt, Date.now()), eq(sessions.authVersion, users.authVersion)))
    .limit(1);
  return record ?? null;
}
export async function authenticate(c: AdminContext, full = true) {
  const auth = await currentSession(c);
  if (!auth) return fail(401, 'ログインしてください。');
  if (full && auth.session.scope !== 'full') fail(403, '先にPasskeyを登録してください。');
  c.set('user', auth.user);
  c.set('session', auth.session);
  return auth;
}
export async function makeSession(c: AdminContext, user: User, scope: 'enroll' | 'full') {
  const raw = token(),
    id = await hash(raw),
    maxAge = scope === 'enroll' ? 600 : 28800;
  await database(c.env)
    .insert(sessions)
    .values({ tokenHash: id, userId: user.id, scope, authVersion: user.authVersion, expiresAt: Date.now() + maxAge * 1000 });
  setCookie(c, cookieName, raw, { httpOnly: true, secure: origin(c).secure, sameSite: 'Strict', path: '/api/admin', maxAge });
}
export function clearSession(c: AdminContext) {
  deleteCookie(c, cookieName, { path: '/api/admin' });
}
export async function rateLimit(c: AdminContext, key: string, max: number, windowMs: number) {
  const db = database(c.env),
    now = Date.now(),
    id = await hash(key + ':' + Math.floor(now / windowMs));
  const [row] = await db
    .insert(attempts)
    .values({ keyHash: id, count: 1, expiresAt: now + windowMs })
    .onConflictDoUpdate({ target: attempts.keyHash, set: { count: sql`${attempts.count}+1` } })
    .returning();
  if (row.count > max) fail(429, '試行回数が多すぎます。しばらく待ってから再度お試しください。');
}
export async function saveChallenge(c: AdminContext, value: Omit<typeof challenges.$inferInsert, 'id' | 'tokenHash' | 'expiresAt'>) {
  const raw = token();
  await database(c.env)
    .insert(challenges)
    .values({ ...value, tokenHash: await hash(raw), expiresAt: Date.now() + 300000 });
  setCookie(c, 'teacher_challenge', raw, {
    httpOnly: true,
    secure: origin(c).secure,
    sameSite: 'Strict',
    path: '/api/admin/auth',
    maxAge: 300,
  });
}
export async function consumeChallenge(c: AdminContext, kind: 'registration' | 'authentication') {
  const raw = getCookie(c, 'teacher_challenge');
  deleteCookie(c, 'teacher_challenge', { path: '/api/admin/auth' });
  if (!raw) return fail(400, '認証を最初からやり直してください。');
  const [row] = await database(c.env)
    .delete(challenges)
    .where(and(eq(challenges.tokenHash, await hash(raw)), eq(challenges.kind, kind), gt(challenges.expiresAt, Date.now())))
    .returning();
  if (!row) return fail(400, '認証の有効期限が切れています。やり直してください。');
  return row;
}
export async function cleanup(env: Bindings) {
  const db = database(env),
    now = Date.now();
  await db.batch([
    db.delete(challenges).where(lt(challenges.expiresAt, now)),
    db.delete(sessions).where(lt(sessions.expiresAt, now)),
    db.delete(attempts).where(lt(attempts.expiresAt, now)),
  ]);
}
export function canManage(actor: User, target: User) {
  return target.role !== 'super_admin' && (actor.role === 'super_admin' || (actor.role === 'admin' && actor.schoolId === target.schoolId));
}
