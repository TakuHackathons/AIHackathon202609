import { Hono } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { database } from '../db';
import { challenges, passkeys, sessions, users, publicUser } from '../db/schema';
import {
  type AdminEnv,
  authenticate,
  base64,
  body,
  consumeChallenge,
  clearSession,
  fail,
  makeSession,
  origin,
  passwordHash,
  rateLimit,
  saveChallenge,
  token,
  unbase64,
  username,
  verifyPassword,
} from './security';

export const authRouter = new Hono<AdminEnv>();

authRouter.get('/me', async (c) => {
  const { user, session } = await authenticate(c, false);
  return c.json({ user: publicUser(user), enrollmentRequired: session.scope === 'enroll' });
});

authRouter.post('/logout', async (c) => {
  const { session } = await authenticate(c, false);
  await database(c.env).delete(sessions).where(eq(sessions.id, session.id));
  clearSession(c);
  return c.json({ ok: true });
});
authRouter.post('/password', async (c) => {
  const input = await body(c);
  const login = username(input);
  const password = typeof input.password === 'string' ? input.password : '';
  if (!password || password.length > 256) fail(400, 'Invalid password.');
  await rateLimit(c, 'password:' + login, 5, 15 * 60_000);

  const db = database(c.env);
  const [user] = await db.select().from(users).where(eq(users.username, login)).limit(1);
  const valid = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !valid || !user.passwordExpiresAt || user.passwordExpiresAt <= Date.now()) fail(401, 'Password login failed.');
  await makeSession(c, user, 'enroll');
  return c.json({ user: publicUser(user), enrollmentRequired: true });
});

authRouter.post('/password/issue', async (c) => {
  const { user } = await authenticate(c);
  const password = token(),
    expiresAt = Date.now() + 15 * 60_000,
    db = database(c.env);
  await db.batch([
    db
      .update(users)
      .set({ passwordHash: await passwordHash(password), passwordExpiresAt: expiresAt, updatedAt: Date.now() })
      .where(eq(users.id, user.id)),
    db.delete(sessions).where(and(eq(sessions.userId, user.id), eq(sessions.scope, 'enroll'))),
    db.delete(challenges).where(eq(challenges.userId, user.id)),
  ]);
  return c.json({ username: user.username, password, expiresAt });
});

authRouter.post('/authentication/options', async (c) => {
  const db = database(c.env);
  const registered = await db.select({ id: passkeys.id }).from(passkeys).limit(1);
  const options = await generateAuthenticationOptions({ rpID: origin(c).rpID, userVerification: 'required' });
  await saveChallenge(c, { challenge: options.challenge, kind: 'authentication' });
  return c.json({ ...options, passwordLoginAvailable: registered.length === 0 });
});

authRouter.post('/authentication/verify', async (c) => {
  const input = await body(c);
  const response = input.response as AuthenticationResponseJSON;
  if (!response || typeof response.id !== 'string') fail(400, 'Invalid authentication response.');

  const challenge = await consumeChallenge(c, 'authentication');
  const db = database(c.env);
  const [record] = await db
    .select({ key: passkeys, user: users })
    .from(passkeys)
    .innerJoin(users, eq(passkeys.userId, users.id))
    .where(eq(passkeys.credentialId, response.id))
    .limit(1);
  if (!record) fail(401, 'Passkey verification failed.');

  let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>> | undefined;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin(c).origin,
      expectedRPID: origin(c).rpID,
      requireUserVerification: true,
      credential: {
        id: record.key.credentialId,
        publicKey: unbase64(record.key.publicKey) as never,
        counter: record.key.counter,
        transports: record.key.transports,
      },
    });
  } catch {
    fail(401, 'Passkey verification failed.');
  }
  if (!verification?.verified) fail(401, 'Passkey verification failed.');
  const verifiedAuthentication = verification!;

  const result = await db
    .update(passkeys)
    .set({
      counter: verifiedAuthentication.authenticationInfo.newCounter,
      lastUsedAt: Date.now(),
      backedUp: verifiedAuthentication.authenticationInfo.credentialBackedUp,
    })
    .where(and(eq(passkeys.id, record.key.id), eq(passkeys.counter, record.key.counter)))
    .returning({ id: passkeys.id });
  if (!result.length) fail(401, 'Authentication expired. Please retry.');
  await makeSession(c, record.user, 'full');
  return c.json({ ok: true });
});

authRouter.post('/registration/options', async (c) => {
  const { user, session } = await authenticate(c, false);
  const input = await body(c);
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 80) : 'Passkey';
  const db = database(c.env);
  const keys = await db.select().from(passkeys).where(eq(passkeys.userId, user.id));
  if (keys.length >= 10) fail(400, 'Too many passkeys.');

  const options = await generateRegistrationOptions({
    rpName: 'Yorisoi AI Admin',
    rpID: origin(c).rpID,
    userID: new Uint8Array([...new TextEncoder().encode(String(user.id))]) as never,
    userName: user.username,
    userDisplayName: user.name,
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    excludeCredentials: keys.map((key) => ({ id: key.credentialId, transports: key.transports })),
    supportedAlgorithmIDs: [-7, -257],
  });
  await saveChallenge(c, {
    challenge: options.challenge,
    kind: 'registration',
    userId: user.id,
    authVersion: user.authVersion,
    sessionId: session.id,
    name,
  });
  return c.json(options);
});

authRouter.post('/registration/verify', async (c) => {
  const { user, session } = await authenticate(c, false);
  const input = await body(c);
  const challenge = await consumeChallenge(c, 'registration');
  if (challenge.userId !== user.id || challenge.authVersion !== user.authVersion || challenge.sessionId !== session.id)
    fail(400, 'Registration expired.');

  let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>> | undefined;
  try {
    verification = await verifyRegistrationResponse({
      response: input.response as RegistrationResponseJSON,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin(c).origin,
      expectedRPID: origin(c).rpID,
      requireUserVerification: true,
      supportedAlgorithmIDs: [-7, -257],
    });
  } catch {
    fail(400, 'Passkey registration failed.');
  }
  if (!verification?.verified || !verification.registrationInfo) fail(400, 'Passkey registration failed.');
  const info = verification!.registrationInfo!;
  const db = database(c.env);
  const insertPasskey = db.insert(passkeys).values({
    credentialId: info.credential.id,
    userId: user.id,
    publicKey: base64(info.credential.publicKey),
    counter: info.credential.counter,
    transports: info.credential.transports ?? [],
    name: challenge.name ?? 'Passkey',
    deviceType: info.credentialDeviceType,
    backedUp: info.credentialBackedUp,
    createdAt: Date.now(),
  });
  if (session.scope === 'enroll') {
    await db.batch([
      insertPasskey,
      db
        .update(users)
        .set({ passwordHash: null, passwordExpiresAt: null, updatedAt: Date.now() })
        .where(and(eq(users.id, user.id), eq(users.authVersion, user.authVersion))),
      db.delete(sessions).where(and(eq(sessions.userId, user.id), eq(sessions.scope, 'enroll'))),
    ]);
    await makeSession(c, user, 'full');
  } else {
    await insertPasskey;
  }
  return c.json({ ok: true });
});

authRouter.get('/passkeys', async (c) => {
  const { user } = await authenticate(c);
  const keys = await database(c.env)
    .select({ id: passkeys.id, name: passkeys.name, createdAt: passkeys.createdAt, lastUsedAt: passkeys.lastUsedAt })
    .from(passkeys)
    .where(eq(passkeys.userId, user.id));
  return c.json({ passkeys: keys });
});

authRouter.delete('/passkeys/:id', async (c) => {
  const { user } = await authenticate(c);
  const db = database(c.env);
  const keys = await db.select({ id: passkeys.id }).from(passkeys).where(eq(passkeys.userId, user.id));
  if (keys.length <= 1) fail(400, 'Register another passkey before deleting this one.');
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id < 1) fail(404, 'Passkey not found.');
  const deleted = await db
    .delete(passkeys)
    .where(and(eq(passkeys.id, id), eq(passkeys.userId, user.id)))
    .returning({ id: passkeys.id });
  if (!deleted.length) fail(404, 'Passkey not found.');
  await db.batch([
    db
      .update(users)
      .set({ authVersion: sql`${users.authVersion} + 1` })
      .where(eq(users.id, user.id)),
    db.delete(sessions).where(eq(sessions.userId, user.id)),
  ]);
  return c.json({ ok: true, loginRequired: true });
});
