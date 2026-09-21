import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const schools = sqliteTable('schools', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  address: text('address').notNull().default(''),
  phone: text('phone').notNull().default(''),
  timezone: text('timezone').notNull().default('Asia/Tokyo'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    schoolId: integer('school_id').references(() => schools.id, { onDelete: 'cascade' }),
    username: text('username').notNull().unique(),
    name: text('name').notNull(),
    email: text('email').notNull().default(''),
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
      'users_role_school',
      sql`(${t.role} = 'super_admin' AND ${t.schoolId} IS NULL) OR (${t.role} IN ('admin','general') AND ${t.schoolId} IS NOT NULL)`,
    ),
  ],
);
export const passkeys = sqliteTable(
  'passkeys',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    credentialId: text('credential_id').notNull().unique(),
    userId: integer('user_id')
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
    id: integer('id').primaryKey({ autoIncrement: true }),
    tokenHash: text('token_hash').notNull().unique(),
    userId: integer('user_id')
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
    id: integer('id').primaryKey({ autoIncrement: true }),
    tokenHash: text('token_hash').notNull().unique(),
    challenge: text('challenge').notNull(),
    kind: text('kind', { enum: ['registration', 'authentication'] }).notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    authVersion: integer('auth_version'),
    sessionId: integer('session_id'),
    name: text('name'),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('challenges_expiry').on(t.expiresAt)],
);
export const attempts = sqliteTable('auth_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  keyHash: text('key_hash').notNull().unique(),
  count: integer('count').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
export const facilities = sqliteTable(
  'facilities',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    schoolId: integer('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: text('category').notNull().default(''),
    description: text('description').notNull().default(''),
    location: text('location').notNull().default(''),
    manualStatus: text('manual_status', { enum: ['open', 'closed', 'restricted'] }),
    manualStatusUntil: integer('manual_status_until'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('facilities_school').on(t.schoolId)],
);
export const facilityHours = sqliteTable(
  'facility_hours',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    facilityId: integer('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    weekday: integer('weekday').notNull(),
    opensAt: text('opens_at').notNull().default(''),
    closesAt: text('closes_at').notNull().default(''),
    closed: integer('closed', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [uniqueIndex('facility_hours_day').on(t.facilityId, t.weekday)],
);
export const facilityExceptions = sqliteTable(
  'facility_exceptions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    facilityId: integer('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    status: text('status', { enum: ['open', 'closed', 'restricted'] }).notNull(),
    opensAt: text('opens_at').notNull().default(''),
    closesAt: text('closes_at').notNull().default(''),
    note: text('note').notNull().default(''),
  },
  (t) => [uniqueIndex('facility_exceptions_date').on(t.facilityId, t.date)],
);
export const students = sqliteTable(
  'students',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    schoolId: integer('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    studentNumber: text('student_number').notNull(),
    personality: text('personality').notNull().default(''),
    considerations: text('considerations').notNull().default(''),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [uniqueIndex('students_school_number').on(t.schoolId, t.studentNumber), index('students_school').on(t.schoolId)],
);
export const studentPrivateDetails = sqliteTable('student_private_details', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id')
    .notNull()
    .unique()
    .references(() => students.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull().default(''),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  address: text('address').notNull().default(''),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
export const courses = sqliteTable(
  'courses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    schoolId: integer('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    teacherId: integer('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    facilityId: integer('facility_id').references(() => facilities.id, { onDelete: 'set null' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [uniqueIndex('courses_school_code').on(t.schoolId, t.code), index('courses_teacher').on(t.teacherId)],
);
export const courseStudents = sqliteTable(
  'course_students',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('course_students_unique').on(t.courseId, t.studentId)],
);
export const courseSchedules = sqliteTable(
  'course_schedules',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    weekday: integer('weekday').notNull(),
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at').notNull(),
    validFrom: text('valid_from').notNull(),
    validTo: text('valid_to').notNull(),
  },
  (t) => [index('course_schedules_course').on(t.courseId)],
);
export const scheduleExceptions = sqliteTable(
  'schedule_exceptions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    facilityId: integer('facility_id').references(() => facilities.id, { onDelete: 'set null' }),
    date: text('date').notNull(),
    kind: text('kind', { enum: ['cancelled', 'makeup', 'changed'] }).notNull(),
    startsAt: text('starts_at').notNull().default(''),
    endsAt: text('ends_at').notNull().default(''),
    note: text('note').notNull().default(''),
  },
  (t) => [index('schedule_exceptions_course_date').on(t.courseId, t.date)],
);
export const attendance = sqliteTable(
  'attendance',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    status: text('status', { enum: ['present', 'late', 'absent', 'excused'] }).notNull(),
    note: text('note').notNull().default(''),
    recordedBy: integer('recorded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [uniqueIndex('attendance_course_student_date').on(t.courseId, t.studentId, t.date)],
);
export const assignments = sqliteTable(
  'assignments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    dueAt: integer('due_at'),
    externalUrl: text('external_url').notNull().default(''),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('assignments_course').on(t.courseId)],
);
export const resources = sqliteTable(
  'resources',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    schoolId: integer('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['rule', 'career', 'event', 'other'] }).notNull(),
    title: text('title').notNull(),
    category: text('category').notNull().default(''),
    body: text('body').notNull().default(''),
    externalUrl: text('external_url').notNull().default(''),
    startsAt: integer('starts_at'),
    endsAt: integer('ends_at'),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('resources_school_kind').on(t.schoolId, t.kind)],
);
export const resourceFiles = sqliteTable(
  'resource_files',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    resourceId: integer('resource_id')
      .notNull()
      .references(() => resources.id, { onDelete: 'cascade' }),
    r2Key: text('r2_key').notNull().unique(),
    fileName: text('file_name').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    extractedText: text('extracted_text').notNull().default(''),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('resource_files_resource').on(t.resourceId)],
);
export type User = typeof users.$inferSelect;
export const publicUser = (u: User) => ({
  id: u.id,
  schoolId: u.schoolId,
  username: u.username,
  name: u.name,
  email: u.email,
  role: u.role,
  createdAt: u.createdAt,
});
