import { Hono } from 'hono';
import { and, asc, eq, inArray, like, or } from 'drizzle-orm';
import { extractText, getDocumentProxy } from 'unpdf';
import { database } from '../../db';
import { facilityStatuses } from '../../services/facility-status';
import { canAccessSchool } from '../authorization';
import {
  assignments,
  attendance,
  courses,
  courseSchedules,
  courseEnrollments,
  courseSessions,
  courseTeachers,
  facilities,
  facilityBusinessExceptions,
  facilityStatusOverrides,
  facilityBusinessHours,
  resourceFiles,
  resourceSearchDocuments,
  resources,
  scheduleExceptions,
  schools,
  studentTagAssignments,
  studentTags,
  students,
  users,
} from '../../db/schema';
import { body, fail, type AdminContext, type AdminEnv } from '../security';

export const studentRouter = new Hono<AdminEnv>();
const id = (c: AdminContext, name = 'id') => {
  const n = Number(c.req.param(name));
  if (!Number.isSafeInteger(n) || n < 1) fail(404, 'Not found.');
  return n;
};
const num = (v: unknown, name: string, nullable = false): number | null => {
  if (nullable && (v === null || v === undefined || v === '')) return null;
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 1) fail(400, name + ' is invalid.');
  return n;
};
const text = (v: unknown, name: string, max = 200, required = true) => {
  if ((v === undefined || v === null) && !required) return '';
  if (typeof v !== 'string' || v.length > max || (required && !v.trim())) fail(400, name + ' is invalid.');
  return (v as string).trim();
};
const manager = (c: AdminContext) => {
  if (c.get('user').role === 'general') fail(403, 'Manager role required.');
};
const schoolId = (c: AdminContext, v: unknown) => {
  const a = c.get('user');
  return a.role === 'super_admin' ? num(v, 'schoolId')! : a.schoolId!;
};
const scope = (c: AdminContext, s: number) => {
  const a = c.get('user');
  if (!canAccessSchool(a, s)) fail(404, 'Not found.');
};
const listSchool = (c: AdminContext) => {
  const a = c.get('user'),
    q = c.req.query('schoolId');
  return a.role === 'super_admin' && q ? num(q, 'schoolId') : a.schoolId;
};
async function facility(c: AdminContext, n = id(c)) {
  const [r] = await database(c.env).select().from(facilities).where(eq(facilities.id, n)).limit(1);
  if (!r) fail(404, 'Facility not found.');
  scope(c, r.schoolId);
  return r;
}
async function student(c: AdminContext, n = id(c)) {
  const [r] = await database(c.env).select().from(students).where(eq(students.id, n)).limit(1);
  if (!r) fail(404, 'Student not found.');
  scope(c, r.schoolId);
  return r;
}
async function course(c: AdminContext, write = false) {
  const n = id(c, 'courseId'),
    [r] = await database(c.env).select().from(courses).where(eq(courses.id, n)).limit(1);
  if (!r) fail(404, 'Course not found.');
  scope(c, r.schoolId);
  if (write && c.get('user').role === 'general') {
    const [assigned] = await database(c.env)
      .select({ id: courseTeachers.id })
      .from(courseTeachers)
      .where(and(eq(courseTeachers.courseId, r.id), eq(courseTeachers.teacherId, c.get('user').id)))
      .limit(1);
    if (!assigned) fail(403, 'Only an assigned teacher can update this course.');
  }
  return r;
}
async function syncStudentTags(c: AdminContext, studentId: number, schoolId: number, raw: unknown) {
  if (!Array.isArray(raw)) return;
  const names = [...new Set(raw.map((value) => String(value).trim()).filter(Boolean))].slice(0, 30);
  if (names.some((name) => name.length > 80)) fail(400, 'tags is invalid.');
  const db = database(c.env),
    now = Date.now();
  await db.delete(studentTagAssignments).where(eq(studentTagAssignments.studentId, studentId));
  for (const name of names) {
    await db
      .insert(studentTags)
      .values({ schoolId, name, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: [studentTags.schoolId, studentTags.name], set: { updatedAt: now } });
    const [tag] = await db
      .select()
      .from(studentTags)
      .where(and(eq(studentTags.schoolId, schoolId), eq(studentTags.name, name)))
      .limit(1);
    await db.insert(studentTagAssignments).values({ studentId, tagId: tag.id, createdAt: now }).onConflictDoNothing();
  }
}

async function syncResourceSearch(c: AdminContext, resourceId: number) {
  const db = database(c.env);
  const [record] = await db.select().from(resources).where(eq(resources.id, resourceId)).limit(1);
  if (!record) return;
  const files = await db
    .select({ text: resourceFiles.extractedText })
    .from(resourceFiles)
    .where(and(eq(resourceFiles.resourceId, resourceId), eq(resourceFiles.extractionStatus, 'completed')));
  const values = {
    schoolId: record.schoolId,
    title: record.title,
    category: record.category,
    body: record.body,
    extractedText: files
      .map((file) => file.text)
      .join('\n')
      .slice(0, 500000),
    updatedAt: Date.now(),
  };
  await db
    .insert(resourceSearchDocuments)
    .values({ resourceId, ...values })
    .onConflictDoUpdate({ target: resourceSearchDocuments.resourceId, set: values });
}

async function resource(c: AdminContext, n = id(c)) {
  const [r] = await database(c.env).select().from(resources).where(eq(resources.id, n)).limit(1);
  if (!r) fail(404, 'Resource not found.');
  scope(c, r.schoolId);
  return r;
}

studentRouter.get('/students', async (c) => {
  const school = listSchool(c);
  if (!school) return c.json({ students: [] });
  const db = database(c.env);
  const rows = await db.select().from(students).where(eq(students.schoolId, school)).orderBy(asc(students.studentNumber));
  const tagRows = rows.length
    ? await db
        .select({ studentId: studentTagAssignments.studentId, name: studentTags.name })
        .from(studentTagAssignments)
        .innerJoin(studentTags, eq(studentTagAssignments.tagId, studentTags.id))
        .where(
          inArray(
            studentTagAssignments.studentId,
            rows.map((row) => row.id),
          ),
        )
    : [];
  return c.json({
    students: rows.map((row) => ({ ...row, tags: tagRows.filter((tag) => tag.studentId === row.id).map((tag) => tag.name) })),
  });
});
studentRouter.post('/students', async (c) => {
  manager(c);
  const d = await body(c),
    now = Date.now(),
    [r] = await database(c.env)
      .insert(students)
      .values({
        schoolId: schoolId(c, d.schoolId),
        studentNumber: text(d.studentNumber, 'studentNumber', 80),
        personality: text(d.personality, 'personality', 4000, false),
        considerations: text(d.considerations, 'considerations', 4000, false),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
  await syncStudentTags(c, r.id, r.schoolId, d.tags);
  return c.json({ student: r }, 201);
});
studentRouter.patch('/students/:id', async (c) => {
  manager(c);
  const old = await student(c),
    d = await body(c),
    [r] = await database(c.env)
      .update(students)
      .set({
        studentNumber: text(d.studentNumber, 'studentNumber', 80),
        personality: text(d.personality, 'personality', 4000, false),
        considerations: text(d.considerations, 'considerations', 4000, false),
        updatedAt: Date.now(),
      })
      .where(eq(students.id, old.id))
      .returning();
  await syncStudentTags(c, r.id, r.schoolId, d.tags);
  return c.json({ student: r });
});
studentRouter.delete('/students/:id', async (c) => {
  manager(c);
  const r = await student(c);
  await database(c.env).delete(students).where(eq(students.id, r.id));
  return c.json({ ok: true });
});
