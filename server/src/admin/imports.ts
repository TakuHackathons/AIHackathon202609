import { Hono } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import { database } from '../db';
import {
  academicTerms,
  courseSchedules,
  courseTeachers,
  courses,
  facilities,
  resources,
  schoolPeriods,
  schools,
  studentTagAssignments,
  studentTags,
  students,
  users,
} from '../db/schema';
import { canAccessSchool, canGrantRole, canWriteCourse } from './authorization';
import { csvUpload, importRows, optional, required } from './csv';
import { fail, passwordHash, token, type AdminContext, type AdminEnv } from './security';

export const importRouter = new Hono<AdminEnv>();

function manager(c: AdminContext) {
  if (c.get('user').role === 'general') fail(403, 'Manager role required.');
}

function schoolId(c: AdminContext, form: FormData): number {
  const actor = c.get('user');
  const id = actor.role === 'super_admin' ? Number(form.get('schoolId')) : actor.schoolId;
  if (!id || !Number.isSafeInteger(id) || !canAccessSchool(actor, id)) fail(400, 'A valid schoolId is required.');
  return id as number;
}

async function assertSchool(c: AdminContext, id: number) {
  const [school] = await database(c.env).select({ id: schools.id }).from(schools).where(eq(schools.id, id)).limit(1);
  if (!school) fail(404, 'School not found.');
}

importRouter.post('/teachers/import', async (c) => {
  manager(c);
  const { form, rows } = await csvUpload(c, ['username', 'name'], 100);
  const targetSchoolId = schoolId(c, form);
  await assertSchool(c, targetSchoolId);
  const actor = c.get('user');
  const credentials: Array<{ username: string; password: string }> = [];
  const result = await importRows(rows, async (row) => {
    const login = required(row, 'username', 80).toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(login)) throw new Error('username format is invalid.');
    const requestedRole = (optional(row, 'role', 20) || 'general') as 'general' | 'admin';
    if (!['general', 'admin'].includes(requestedRole)) throw new Error('role must be general or admin.');
    if (!canGrantRole(actor, requestedRole)) throw new Error('Only super admin can grant the admin role.');
    const db = database(c.env);
    const [existing] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = ${login}`)
      .limit(1);
    const now = Date.now();
    if (existing) {
      if (existing.schoolId !== targetSchoolId || existing.role === 'super_admin')
        throw new Error('username is already used outside this school.');
      await db
        .update(users)
        .set({ name: required(row, 'name', 120), email: optional(row, 'email', 320), role: requestedRole, updatedAt: now })
        .where(eq(users.id, existing.id));
      return;
    }
    const temporaryPassword = token();
    await db.insert(users).values({
      schoolId: targetSchoolId,
      username: login,
      name: required(row, 'name', 120),
      email: optional(row, 'email', 320),
      role: actor.role === 'super_admin' ? requestedRole : 'general',
      passwordHash: await passwordHash(temporaryPassword),
      passwordExpiresAt: now + 7 * 86_400_000,
      createdAt: now,
      updatedAt: now,
    });
    credentials.push({ username: login, password: temporaryPassword });
  });
  return c.json({ ...result, credentials });
});

importRouter.post('/facilities/import', async (c) => {
  manager(c);
  const { form, rows } = await csvUpload(c, ['name']);
  const targetSchoolId = schoolId(c, form);
  await assertSchool(c, targetSchoolId);
  const result = await importRows(rows, async (row) => {
    const db = database(c.env),
      name = required(row, 'name', 200),
      [existing] = await db
        .select()
        .from(facilities)
        .where(and(eq(facilities.schoolId, targetSchoolId), sql`lower(${facilities.name}) = ${name.toLowerCase()}`))
        .limit(1),
      values = {
        name,
        category: optional(row, 'category', 100),
        location: optional(row, 'location', 300),
        description: optional(row, 'description'),
        updatedAt: Date.now(),
      };
    if (existing) await db.update(facilities).set(values).where(eq(facilities.id, existing.id));
    else await db.insert(facilities).values({ schoolId: targetSchoolId, ...values, createdAt: Date.now() });
  });
  return c.json(result);
});

async function syncTags(c: AdminContext, studentId: number, targetSchoolId: number, tags: string[]) {
  const db = database(c.env);
  await db.delete(studentTagAssignments).where(eq(studentTagAssignments.studentId, studentId));
  for (const name of tags) {
    await db
      .insert(studentTags)
      .values({ schoolId: targetSchoolId, name, createdAt: Date.now(), updatedAt: Date.now() })
      .onConflictDoNothing();
    const [tag] = await db
      .select()
      .from(studentTags)
      .where(and(eq(studentTags.schoolId, targetSchoolId), eq(studentTags.name, name)))
      .limit(1);
    if (tag) await db.insert(studentTagAssignments).values({ studentId, tagId: tag.id, createdAt: Date.now() }).onConflictDoNothing();
  }
}

importRouter.post('/students/import', async (c) => {
  manager(c);
  const { form, rows } = await csvUpload(c, ['student_number']);
  const targetSchoolId = schoolId(c, form);
  await assertSchool(c, targetSchoolId);
  const result = await importRows(rows, async (row) => {
    const db = database(c.env),
      studentNumber = required(row, 'student_number', 80),
      now = Date.now(),
      values = { personality: optional(row, 'personality'), considerations: optional(row, 'considerations'), updatedAt: now };
    const [existing] = await db
      .select()
      .from(students)
      .where(and(eq(students.schoolId, targetSchoolId), eq(students.studentNumber, studentNumber)))
      .limit(1);
    let studentId: number;
    if (existing) {
      await db.update(students).set(values).where(eq(students.id, existing.id));
      studentId = existing.id;
    } else {
      const [created] = await db
        .insert(students)
        .values({ schoolId: targetSchoolId, studentNumber, ...values, createdAt: now })
        .returning();
      studentId = created.id;
    }
    const tags = optional(row, 'tags', 1000)
      .split('|')
      .map((tag) => tag.trim())
      .filter(Boolean);
    await syncTags(c, studentId, targetSchoolId, tags);
  });
  return c.json(result);
});

importRouter.post('/courses/import', async (c) => {
  const { form, rows } = await csvUpload(c, ['course_code', 'course_name', 'term_name']);
  const targetSchoolId = schoolId(c, form);
  await assertSchool(c, targetSchoolId);
  const actor = c.get('user');
  const result = await importRows(rows, async (row) => {
    const db = database(c.env);
    const [term] = await db
      .select()
      .from(academicTerms)
      .where(and(eq(academicTerms.schoolId, targetSchoolId), eq(academicTerms.name, required(row, 'term_name', 100))))
      .limit(1);
    if (!term) throw new Error('term_name was not found.');
    const teacherUsername = actor.role === 'general' ? actor.username : required(row, 'teacher_username', 80).toLowerCase();
    const [teacher] = await db
      .select()
      .from(users)
      .where(and(eq(users.schoolId, targetSchoolId), sql`lower(${users.username}) = ${teacherUsername}`))
      .limit(1);
    if (!teacher) throw new Error('teacher_username was not found.');
    const code = required(row, 'course_code', 80),
      now = Date.now();
    const [existing] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.academicTermId, term.id), eq(courses.code, code)))
      .limit(1);
    if (existing) {
      const assigned = await db
        .select({ id: courseTeachers.teacherId })
        .from(courseTeachers)
        .where(eq(courseTeachers.courseId, existing.id));
      if (
        !canWriteCourse(
          actor,
          targetSchoolId,
          assigned.map((item) => item.id),
        )
      )
        throw new Error('Only an assigned teacher can update this course.');
    }
    const [course] = existing
      ? await db
          .update(courses)
          .set({ name: required(row, 'course_name', 200), description: optional(row, 'description'), updatedAt: now })
          .where(eq(courses.id, existing.id))
          .returning()
      : await db
          .insert(courses)
          .values({
            schoolId: targetSchoolId,
            academicTermId: term.id,
            code,
            name: required(row, 'course_name', 200),
            description: optional(row, 'description'),
            createdAt: now,
            updatedAt: now,
          })
          .returning();
    await db.delete(courseTeachers).where(and(eq(courseTeachers.courseId, course.id), eq(courseTeachers.assignmentRole, 'primary')));
    await db
      .insert(courseTeachers)
      .values({ courseId: course.id, teacherId: teacher.id, assignmentRole: 'primary', createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [courseTeachers.courseId, courseTeachers.teacherId],
        set: { assignmentRole: 'primary', updatedAt: now },
      });
    const weekdayText = optional(row, 'weekday', 2);
    const periodText = optional(row, 'period_number', 3);
    if (!weekdayText && !periodText) return;
    const weekday = Number(weekdayText),
      periodNumber = Number(periodText);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error('weekday must be 0 through 6.');
    const [period] = await db
      .select()
      .from(schoolPeriods)
      .where(and(eq(schoolPeriods.schoolId, targetSchoolId), eq(schoolPeriods.periodNumber, periodNumber)))
      .limit(1);
    if (!period) throw new Error('period_number was not found.');
    let facilityId: number | null = null;
    const facilityName = optional(row, 'facility_name', 200);
    if (facilityName) {
      const [facility] = await db
        .select()
        .from(facilities)
        .where(and(eq(facilities.schoolId, targetSchoolId), sql`lower(${facilities.name}) = ${facilityName.toLowerCase()}`))
        .limit(1);
      if (!facility) throw new Error('facility_name was not found.');
      facilityId = facility.id;
    }
    const validFrom = required(row, 'valid_from', 10),
      validTo = required(row, 'valid_to', 10);
    await db
      .insert(courseSchedules)
      .values({
        courseId: course.id,
        periodId: period.id,
        facilityId,
        weekday,
        locationNote: optional(row, 'location_note', 300),
        validFrom,
        validTo,
        createdBy: actor.id,
        updatedBy: actor.id,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [courseSchedules.courseId, courseSchedules.weekday, courseSchedules.periodId, courseSchedules.validFrom],
        set: { facilityId, locationNote: optional(row, 'location_note', 300), validTo, updatedBy: actor.id, updatedAt: now },
      });
  });
  return c.json(result);
});

importRouter.post('/resources/import', async (c) => {
  manager(c);
  const { form, rows } = await csvUpload(c, ['kind', 'title']);
  const targetSchoolId = schoolId(c, form);
  await assertSchool(c, targetSchoolId);
  const result = await importRows(rows, async (row) => {
    const kind = required(row, 'kind', 30);
    if (!['rule', 'career', 'event', 'other'].includes(kind)) throw new Error('kind must be rule, career, event, or other.');
    const db = database(c.env),
      title = required(row, 'title', 200),
      now = Date.now();
    const [existing] = await db
      .select()
      .from(resources)
      .where(and(eq(resources.schoolId, targetSchoolId), eq(resources.kind, kind as any), eq(resources.title, title)))
      .limit(1);
    const values = {
      kind: kind as any,
      title,
      category: optional(row, 'category', 100),
      body: optional(row, 'body', 20_000),
      externalUrl: optional(row, 'external_url', 2000),
      updatedBy: c.get('user').id,
      updatedAt: now,
    };
    if (existing) await db.update(resources).set(values).where(eq(resources.id, existing.id));
    else await db.insert(resources).values({ schoolId: targetSchoolId, ...values, createdBy: c.get('user').id, createdAt: now });
  });
  return c.json(result);
});
