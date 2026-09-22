import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const id = () => integer('id').primaryKey({ autoIncrement: true });
const createdAt = () => integer('created_at').notNull();
const updatedAt = () => integer('updated_at').notNull();

export const schools = sqliteTable(
  'schools',
  {
    id: id(),
    name: text('name').notNull(),
    code: text('code').notNull(),
    address: text('address').notNull().default(''),
    phone: text('phone').notNull().default(''),
    timezone: text('timezone').notNull().default('Asia/Tokyo'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('schools_code_ci').on(sql`lower(${t.code})`)],
);

export const users = sqliteTable(
  'users',
  {
    id: id(),
    schoolId: integer('school_id').references(() => schools.id, { onDelete: 'cascade' }),
    username: text('username').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull().default(''),
    role: text('role', { enum: ['super_admin', 'admin', 'general'] }).notNull(),
    passwordHash: text('password_hash'),
    passwordExpiresAt: integer('password_expires_at'),
    authVersion: integer('auth_version').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('users_username_ci').on(sql`lower(${t.username})`),
    index('users_school_role').on(t.schoolId, t.role),
    check('users_role', sql`${t.role} IN ('super_admin','admin','general')`),
    check(
      'users_role_school',
      sql`(${t.role} = 'super_admin' AND ${t.schoolId} IS NULL) OR (${t.role} IN ('admin','general') AND ${t.schoolId} IS NOT NULL)`,
    ),
  ],
);

export const passkeys = sqliteTable(
  'passkeys',
  {
    id: id(),
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
    createdAt: createdAt(),
    lastUsedAt: integer('last_used_at'),
  },
  (t) => [index('passkeys_user').on(t.userId)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: id(),
    tokenHash: text('token_hash').notNull().unique(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: text('scope', { enum: ['enroll', 'full'] }).notNull(),
    authVersion: integer('auth_version').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [
    index('sessions_user').on(t.userId),
    index('sessions_expiry').on(t.expiresAt),
    check('sessions_scope', sql`${t.scope} IN ('enroll','full')`),
  ],
);

export const challenges = sqliteTable(
  'challenges',
  {
    id: id(),
    tokenHash: text('token_hash').notNull().unique(),
    challenge: text('challenge').notNull(),
    kind: text('kind', { enum: ['registration', 'authentication'] }).notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    authVersion: integer('auth_version'),
    sessionId: integer('session_id'),
    name: text('name'),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [
    index('challenges_user').on(t.userId),
    index('challenges_expiry').on(t.expiresAt),
    check('challenges_kind', sql`${t.kind} IN ('registration','authentication')`),
  ],
);

export const attempts = sqliteTable(
  'auth_attempts',
  {
    id: id(),
    keyHash: text('key_hash').notNull().unique(),
    count: integer('count').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('auth_attempts_expiry').on(t.expiresAt)],
);

export const facilities = sqliteTable(
  'facilities',
  {
    id: id(),
    schoolId: integer('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: text('category').notNull().default(''),
    description: text('description').notNull().default(''),
    location: text('location').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('facilities_school_name').on(t.schoolId, t.name)],
);

export const facilityBusinessHours = sqliteTable(
  'facility_business_hours',
  {
    id: id(),
    facilityId: integer('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    weekday: integer('weekday').notNull(),
    opensAt: text('opens_at').notNull(),
    closesAt: text('closes_at').notNull(),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('facility_business_hours_unique').on(t.facilityId, t.weekday, t.opensAt, t.closesAt),
    index('facility_business_hours_lookup').on(t.facilityId, t.weekday),
    check('facility_business_hours_weekday', sql`${t.weekday} BETWEEN 0 AND 6`),
    check('facility_business_hours_order', sql`${t.opensAt} < ${t.closesAt}`),
  ],
);

export const facilityBusinessExceptions = sqliteTable(
  'facility_business_exceptions',
  {
    id: id(),
    facilityId: integer('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    status: text('status', { enum: ['open', 'closed', 'restricted'] }).notNull(),
    opensAt: text('opens_at'),
    closesAt: text('closes_at'),
    note: text('note').notNull().default(''),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('facility_business_exceptions_unique').on(t.facilityId, t.date, t.status, t.opensAt, t.closesAt),
    index('facility_business_exceptions_lookup').on(t.facilityId, t.date),
    check('facility_business_exceptions_status', sql`${t.status} IN ('open','closed','restricted')`),
    check(
      'facility_business_exceptions_times',
      sql`(${t.opensAt} IS NULL AND ${t.closesAt} IS NULL) OR (${t.opensAt} IS NOT NULL AND ${t.closesAt} IS NOT NULL AND ${t.opensAt} < ${t.closesAt})`,
    ),
  ],
);

export const facilityStatusOverrides = sqliteTable(
  'facility_status_overrides',
  {
    id: id(),
    facilityId: integer('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['open', 'closed', 'restricted'] }).notNull(),
    startsAt: integer('starts_at').notNull(),
    endsAt: integer('ends_at'),
    reason: text('reason').notNull().default(''),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('facility_status_overrides_active').on(t.facilityId, t.startsAt, t.endsAt),
    check('facility_status_overrides_status', sql`${t.status} IN ('open','closed','restricted')`),
    check('facility_status_overrides_order', sql`${t.endsAt} IS NULL OR ${t.startsAt} < ${t.endsAt}`),
  ],
);

export const academicTerms = sqliteTable(
  'academic_terms',
  {
    id: id(),
    schoolId: integer('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startsOn: text('starts_on').notNull(),
    endsOn: text('ends_on').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('academic_terms_school_name').on(t.schoolId, t.name),
    index('academic_terms_school_dates').on(t.schoolId, t.startsOn, t.endsOn),
    check('academic_terms_dates', sql`${t.startsOn} <= ${t.endsOn}`),
  ],
);

export const schoolPeriods = sqliteTable(
  'school_periods',
  {
    id: id(),
    schoolId: integer('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    periodNumber: integer('period_number').notNull(),
    name: text('name').notNull().default(''),
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('school_periods_number').on(t.schoolId, t.periodNumber),
    uniqueIndex('school_periods_time').on(t.schoolId, t.startsAt, t.endsAt),
    check('school_periods_positive', sql`${t.periodNumber} > 0`),
    check('school_periods_order', sql`${t.startsAt} < ${t.endsAt}`),
  ],
);

export const students = sqliteTable(
  'students',
  {
    id: id(),
    schoolId: integer('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    studentNumber: text('student_number').notNull(),
    personality: text('personality').notNull().default(''),
    considerations: text('considerations').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('students_school_number').on(t.schoolId, t.studentNumber), index('students_school').on(t.schoolId)],
);

export const studentPrivateDetails = sqliteTable(
  'student_private_details',
  {
    id: id(),
    studentId: integer('student_id')
      .notNull()
      .unique()
      .references(() => students.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull().default(''),
    email: text('email').notNull().default(''),
    phone: text('phone').notNull().default(''),
    address: text('address').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('student_private_details_student').on(t.studentId)],
);

export const studentTags = sqliteTable(
  'student_tags',
  {
    id: id(),
    schoolId: integer('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('student_tags_school_name').on(t.schoolId, t.name), index('student_tags_school').on(t.schoolId)],
);

export const studentTagAssignments = sqliteTable(
  'student_tag_assignments',
  {
    id: id(),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => studentTags.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('student_tag_assignments_unique').on(t.studentId, t.tagId),
    index('student_tag_assignments_tag').on(t.tagId, t.studentId),
  ],
);

export const courses = sqliteTable(
  'courses',
  {
    id: id(),
    schoolId: integer('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    academicTermId: integer('academic_term_id')
      .notNull()
      .references(() => academicTerms.id, { onDelete: 'restrict' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('courses_term_code').on(t.academicTermId, t.code),
    index('courses_school_term').on(t.schoolId, t.academicTermId),
    index('courses_school_name').on(t.schoolId, t.name),
  ],
);

export const courseTeachers = sqliteTable(
  'course_teachers',
  {
    id: id(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    teacherId: integer('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    assignmentRole: text('assignment_role', { enum: ['primary', 'assistant'] })
      .notNull()
      .default('primary'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('course_teachers_unique').on(t.courseId, t.teacherId),
    uniqueIndex('course_teachers_one_primary')
      .on(t.courseId)
      .where(sql`${t.assignmentRole} = 'primary'`),
    index('course_teachers_teacher').on(t.teacherId, t.courseId),
    check('course_teachers_role', sql`${t.assignmentRole} IN ('primary','assistant')`),
  ],
);

export const courseEnrollments = sqliteTable(
  'course_enrollments',
  {
    id: id(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['active', 'withdrawn', 'completed'] })
      .notNull()
      .default('active'),
    enrolledAt: integer('enrolled_at').notNull(),
    withdrawnAt: integer('withdrawn_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('course_enrollments_unique').on(t.courseId, t.studentId),
    index('course_enrollments_student_status').on(t.studentId, t.status),
    index('course_enrollments_course_status').on(t.courseId, t.status),
    check('course_enrollments_status', sql`${t.status} IN ('active','withdrawn','completed')`),
  ],
);

export const courseSchedules = sqliteTable(
  'course_schedules',
  {
    id: id(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    periodId: integer('period_id')
      .notNull()
      .references(() => schoolPeriods.id, { onDelete: 'restrict' }),
    facilityId: integer('facility_id').references(() => facilities.id, { onDelete: 'set null' }),
    weekday: integer('weekday').notNull(),
    locationNote: text('location_note').notNull().default(''),
    validFrom: text('valid_from').notNull(),
    validTo: text('valid_to').notNull(),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('course_schedules_unique').on(t.courseId, t.weekday, t.periodId, t.validFrom),
    index('course_schedules_course_weekday').on(t.courseId, t.weekday),
    index('course_schedules_facility').on(t.facilityId, t.weekday, t.periodId),
    check('course_schedules_weekday', sql`${t.weekday} BETWEEN 0 AND 6`),
    check('course_schedules_dates', sql`${t.validFrom} <= ${t.validTo}`),
  ],
);

export const scheduleExceptions = sqliteTable(
  'schedule_exceptions',
  {
    id: id(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    courseScheduleId: integer('course_schedule_id').references(() => courseSchedules.id, { onDelete: 'cascade' }),
    periodId: integer('period_id').references(() => schoolPeriods.id, { onDelete: 'restrict' }),
    facilityId: integer('facility_id').references(() => facilities.id, { onDelete: 'set null' }),
    date: text('date').notNull(),
    kind: text('kind', { enum: ['cancelled', 'makeup', 'rescheduled', 'room_changed'] }).notNull(),
    startsAt: text('starts_at'),
    endsAt: text('ends_at'),
    locationNote: text('location_note').notNull().default(''),
    note: text('note').notNull().default(''),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('schedule_exceptions_course_date').on(t.courseId, t.date),
    index('schedule_exceptions_schedule_date').on(t.courseScheduleId, t.date),
    check('schedule_exceptions_kind', sql`${t.kind} IN ('cancelled','makeup','rescheduled','room_changed')`),
    check(
      'schedule_exceptions_times',
      sql`(${t.startsAt} IS NULL AND ${t.endsAt} IS NULL) OR (${t.startsAt} IS NOT NULL AND ${t.endsAt} IS NOT NULL AND ${t.startsAt} < ${t.endsAt})`,
    ),
  ],
);

export const courseSessions = sqliteTable(
  'course_sessions',
  {
    id: id(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    courseScheduleId: integer('course_schedule_id').references(() => courseSchedules.id, { onDelete: 'set null' }),
    scheduleExceptionId: integer('schedule_exception_id').references(() => scheduleExceptions.id, { onDelete: 'set null' }),
    periodId: integer('period_id').references(() => schoolPeriods.id, { onDelete: 'restrict' }),
    facilityId: integer('facility_id').references(() => facilities.id, { onDelete: 'set null' }),
    sessionDate: text('session_date').notNull(),
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at').notNull(),
    locationNote: text('location_note').notNull().default(''),
    status: text('status', { enum: ['scheduled', 'cancelled', 'completed'] })
      .notNull()
      .default('scheduled'),
    source: text('source', { enum: ['recurring', 'exception', 'manual'] }).notNull(),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('course_sessions_unique').on(t.courseId, t.sessionDate, t.startsAt),
    index('course_sessions_course_date').on(t.courseId, t.sessionDate),
    index('course_sessions_facility_date').on(t.facilityId, t.sessionDate, t.startsAt),
    check('course_sessions_status', sql`${t.status} IN ('scheduled','cancelled','completed')`),
    check('course_sessions_source', sql`${t.source} IN ('recurring','exception','manual')`),
    check('course_sessions_times', sql`${t.startsAt} < ${t.endsAt}`),
  ],
);

export const attendance = sqliteTable(
  'attendance',
  {
    id: id(),
    courseSessionId: integer('course_session_id')
      .notNull()
      .references(() => courseSessions.id, { onDelete: 'cascade' }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['present', 'late', 'absent', 'excused'] }).notNull(),
    source: text('source', { enum: ['manual', 'csv'] })
      .notNull()
      .default('manual'),
    note: text('note').notNull().default(''),
    recordedBy: integer('recorded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('attendance_session_student').on(t.courseSessionId, t.studentId),
    index('attendance_student_session').on(t.studentId, t.courseSessionId),
    index('attendance_status').on(t.status),
    check('attendance_status_check', sql`${t.status} IN ('present','late','absent','excused')`),
    check('attendance_source', sql`${t.source} IN ('manual','csv')`),
  ],
);

export const assignments = sqliteTable(
  'assignments',
  {
    id: id(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    publishedAt: integer('published_at'),
    dueAt: integer('due_at'),
    externalUrl: text('external_url').notNull().default(''),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('assignments_course_due').on(t.courseId, t.dueAt),
    check('assignments_dates', sql`${t.dueAt} IS NULL OR ${t.publishedAt} IS NULL OR ${t.publishedAt} <= ${t.dueAt}`),
  ],
);

export const resources = sqliteTable(
  'resources',
  {
    id: id(),
    schoolId: integer('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    facilityId: integer('facility_id').references(() => facilities.id, { onDelete: 'set null' }),
    kind: text('kind', { enum: ['rule', 'career', 'event', 'other'] }).notNull(),
    title: text('title').notNull(),
    category: text('category').notNull().default(''),
    body: text('body').notNull().default(''),
    externalUrl: text('external_url').notNull().default(''),
    locationNote: text('location_note').notNull().default(''),
    publishedAt: integer('published_at'),
    effectiveFrom: integer('effective_from'),
    effectiveTo: integer('effective_to'),
    startsAt: integer('starts_at'),
    endsAt: integer('ends_at'),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('resources_school_kind_date').on(t.schoolId, t.kind, t.startsAt),
    index('resources_facility').on(t.facilityId),
    check('resources_kind', sql`${t.kind} IN ('rule','career','event','other')`),
    check(
      'resources_effective_dates',
      sql`${t.effectiveTo} IS NULL OR ${t.effectiveFrom} IS NULL OR ${t.effectiveFrom} <= ${t.effectiveTo}`,
    ),
    check('resources_event_dates', sql`${t.endsAt} IS NULL OR ${t.startsAt} IS NULL OR ${t.startsAt} <= ${t.endsAt}`),
  ],
);

export const resourceFiles = sqliteTable(
  'resource_files',
  {
    id: id(),
    resourceId: integer('resource_id')
      .notNull()
      .references(() => resources.id, { onDelete: 'cascade' }),
    r2Key: text('r2_key').notNull().unique(),
    fileName: text('file_name').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    sha256: text('sha256').notNull(),
    pageCount: integer('page_count'),
    extractionStatus: text('extraction_status', { enum: ['pending', 'processing', 'completed', 'failed'] })
      .notNull()
      .default('pending'),
    extractionError: text('extraction_error').notNull().default(''),
    extractedText: text('extracted_text').notNull().default(''),
    extractedAt: integer('extracted_at'),
    uploadedBy: integer('uploaded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('resource_files_resource').on(t.resourceId),
    index('resource_files_extraction').on(t.extractionStatus),
    uniqueIndex('resource_files_resource_hash').on(t.resourceId, t.sha256),
    check('resource_files_size', sql`${t.size} >= 0`),
    check('resource_files_extraction_status', sql`${t.extractionStatus} IN ('pending','processing','completed','failed')`),
  ],
);

export const assignmentFiles = sqliteTable(
  'assignment_files',
  {
    id: id(),
    assignmentId: integer('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    r2Key: text('r2_key').notNull().unique(),
    fileName: text('file_name').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    sha256: text('sha256').notNull(),
    pageCount: integer('page_count'),
    extractionStatus: text('extraction_status', { enum: ['pending', 'processing', 'completed', 'failed'] })
      .notNull()
      .default('pending'),
    extractionError: text('extraction_error').notNull().default(''),
    extractedText: text('extracted_text').notNull().default(''),
    extractedAt: integer('extracted_at'),
    uploadedBy: integer('uploaded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('assignment_files_assignment').on(t.assignmentId),
    index('assignment_files_extraction').on(t.extractionStatus),
    uniqueIndex('assignment_files_assignment_hash').on(t.assignmentId, t.sha256),
    check('assignment_files_size', sql`${t.size} >= 0`),
    check('assignment_files_extraction_status', sql`${t.extractionStatus} IN ('pending','processing','completed','failed')`),
  ],
);

export const resourceSearchDocuments = sqliteTable(
  'resource_search_documents',
  {
    id: id(),
    resourceId: integer('resource_id')
      .notNull()
      .unique()
      .references(() => resources.id, { onDelete: 'cascade' }),
    schoolId: integer('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    category: text('category').notNull().default(''),
    body: text('body').notNull().default(''),
    extractedText: text('extracted_text').notNull().default(''),
    updatedAt: updatedAt(),
  },
  (t) => [index('resource_search_documents_school').on(t.schoolId), index('resource_search_documents_resource').on(t.resourceId)],
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
