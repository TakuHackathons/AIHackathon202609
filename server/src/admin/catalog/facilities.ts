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

export const facilityRouter = new Hono<AdminEnv>();
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

facilityRouter.get('/facilities', async (c) => {
  const s = listSchool(c);
  if (!s) return c.json({ facilities: [] });
  const rows = await database(c.env).select().from(facilities).where(eq(facilities.schoolId, s)).orderBy(asc(facilities.name));
  const statuses = await facilityStatuses(c.env, rows);
  return c.json({ facilities: rows.map((row) => ({ ...row, currentStatus: statuses.get(row.id) })) });
});
facilityRouter.post('/facilities', async (c) => {
  manager(c);
  const d = await body(c),
    now = Date.now(),
    [r] = await database(c.env)
      .insert(facilities)
      .values({
        schoolId: schoolId(c, d.schoolId),
        name: text(d.name, 'name'),
        category: text(d.category, 'category', 100, false),
        description: text(d.description, 'description', 4000, false),
        location: text(d.location, 'location', 300, false),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
  return c.json({ facility: r }, 201);
});
facilityRouter.patch('/facilities/:id', async (c) => {
  manager(c);
  const old = await facility(c),
    d = await body(c),
    now = Date.now(),
    db = database(c.env),
    [r] = await db
      .update(facilities)
      .set({
        name: text(d.name, 'name'),
        category: text(d.category, 'category', 100, false),
        description: text(d.description, 'description', 4000, false),
        location: text(d.location, 'location', 300, false),
        updatedAt: Date.now(),
      })
      .where(eq(facilities.id, old.id))
      .returning();
  if ('manualStatus' in d) {
    await db.delete(facilityStatusOverrides).where(eq(facilityStatusOverrides.facilityId, old.id));
    const status = String(d.manualStatus ?? '');
    if (status) {
      if (!['open', 'closed', 'restricted'].includes(status)) fail(400, 'Invalid manualStatus.');
      await db.insert(facilityStatusOverrides).values({
        facilityId: old.id,
        status: status as any,
        startsAt: now,
        endsAt: d.manualStatusUntil ? Number(d.manualStatusUntil) : null,
        reason: text(d.manualStatusReason, 'manualStatusReason', 500, false),
        createdBy: c.get('user').id,
        updatedBy: c.get('user').id,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return c.json({ facility: r });
});
facilityRouter.delete('/facilities/:id', async (c) => {
  manager(c);
  const r = await facility(c);
  await database(c.env).delete(facilities).where(eq(facilities.id, r.id));
  return c.json({ ok: true });
});
facilityRouter.put('/facilities/:id/hours', async (c) => {
  manager(c);
  const f = await facility(c),
    d = await body(c);
  if (!Array.isArray(d.hours)) fail(400, 'hours must be an array.');
  const hourRows = (d.hours as unknown[]).filter((v) => !(v as any).closed);
  const now = Date.now();
  const rows = hourRows.map((v: unknown) => {
      const x = v as any,
        w = Number(x.weekday);
      if (!Number.isInteger(w) || w < 0 || w > 6) fail(400, 'Invalid weekday.');
      return {
        facilityId: f.id,
        weekday: w,
        opensAt: text(x.opensAt, 'opensAt', 5),
        closesAt: text(x.closesAt, 'closesAt', 5),
        createdBy: c.get('user').id,
        updatedBy: c.get('user').id,
        createdAt: now,
        updatedAt: now,
      };
    }),
    db = database(c.env);
  await db.delete(facilityBusinessHours).where(eq(facilityBusinessHours.facilityId, f.id));
  if (rows.length) await db.insert(facilityBusinessHours).values(rows);
  return c.json({ hours: rows });
});
facilityRouter.post('/facilities/:id/exceptions', async (c) => {
  manager(c);
  const f = await facility(c),
    d = await body(c),
    st = String(d.status);
  if (!['open', 'closed', 'restricted'].includes(st)) fail(400, 'Invalid status.');
  const [r] = await database(c.env)
    .insert(facilityBusinessExceptions)
    .values({
      facilityId: f.id,
      date: text(d.date, 'date', 10),
      status: st as any,
      opensAt: text(d.opensAt, 'opensAt', 5, false) || null,
      closesAt: text(d.closesAt, 'closesAt', 5, false) || null,
      note: text(d.note, 'note', 500, false),
      createdBy: c.get('user').id,
      updatedBy: c.get('user').id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    .returning();
  return c.json({ exception: r }, 201);
});
