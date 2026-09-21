import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core';

export const schools = sqliteTable('schools', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  address: text('address').notNull().default(''),
  phone: text('phone').notNull().default(''),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    schoolId: text('school_id').references(() => schools.id, { onDelete: 'cascade' }),
    username: text('username').notNull().unique(),
    name: text('name').notNull(),
    email: text('email').notNull().default(''),
    department: text('department').notNull().default(''),
    subjects: text('subjects').notNull().default(''),
    responsibilities: text('responsibilities').notNull().default(''),
    role: text('role', { enum: ['super_admin', 'admin', 'general'] }).notNull(),
    passwordHash: text('password_hash'),
    passwordExpiresAt: integer('password_expires_at'),
    authVersion: integer('auth_version').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('users_school').on(t.schoolId),
    check(
      'user_role_school',
      sql`(${t.role} = 'super_admin' AND ${t.schoolId} IS NULL) OR (${t.role} IN ('admin','general') AND ${t.schoolId} IS NOT NULL)`,
    ),
  ],
);
export const passkeys = sqliteTable(
  'passkeys',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    publicKey: text('public_key').notNull(),
    counter: integer('counter').notNull(),
    transports: text('transports', { mode: 'json' }).$type<string[]>().notNull(),
    name: text('name').notNull(),
    deviceType: text('device_type').notNull(),
    backedUp: integer('backed_up', { mode: 'boolean' }).notNull(),
    createdAt: integer('created_at').notNull(),
    lastUsedAt: integer('last_used_at'),
  },
  (t) => [index('passkeys_user').on(t.userId)],
);
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: text('scope', { enum: ['enroll', 'full'] }).notNull(),
    authVersion: integer('auth_version').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('sessions_expiry').on(t.expiresAt)],
);
export const challenges = sqliteTable(
  'challenges',
  {
    id: text('id').primaryKey(),
    challenge: text('challenge').notNull(),
    kind: text('kind', { enum: ['registration', 'authentication'] }).notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    authVersion: integer('auth_version'),
    sessionId: text('session_id'),
    name: text('name'),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('challenges_expiry').on(t.expiresAt)],
);
export const attempts = sqliteTable('auth_attempts', {
  id: text('id').primaryKey(),
  count: integer('count').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
export type User = typeof users.$inferSelect;
export const publicUser = (u: User) => ({
  id: u.id,
  schoolId: u.schoolId,
  username: u.username,
  name: u.name,
  email: u.email,
  department: u.department,
  subjects: u.subjects,
  responsibilities: u.responsibilities,
  role: u.role,
  createdAt: u.createdAt,
});
