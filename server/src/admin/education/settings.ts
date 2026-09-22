import { Hono } from 'hono';
import { and, asc, eq, inArray, like, or } from 'drizzle-orm';
import { database } from '../../db';
import {
  academicTerms,
  assignments,
  attendance,
  courseEnrollments,
  courseSchedules,
  courseSessions,
  courses,
  courseTeachers,
  facilities,
  facilityBusinessExceptions,
  facilityBusinessHours,
  facilityStatusOverrides,
  resourceFiles,
  resourceSearchDocuments,
  resources,
  scheduleExceptions,
  schoolPeriods,
  students,
  users,
} from '../../db/schema';
import { facilityStatuses } from '../../services/facility-status';
import { canAccessSchool } from '../authorization';
import { body, fail, type AdminContext, type AdminEnv } from '../security';

export const academicSettingsRouter = new Hono<AdminEnv>();
const number = (value: unknown, name: string, nullable = false): number | null => {
  if (nullable && (value === '' || value === null || value === undefined)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) fail(400, name + ' is invalid.');
  return parsed;
};
const param = (c: AdminContext, name = 'id') => number(c.req.param(name), name)!;
const string = (value: unknown, name: string, max = 4000, optional = false) => {
  if (optional && (value === undefined || value === null)) return '';
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) fail(400, name + ' is invalid.');
  return (value as string).trim();
};
const manager = (c: AdminContext) => {
  if (c.get('user').role === 'general') fail(403, 'Manager role required.');
};
const requestedSchool = (c: AdminContext, value: unknown) => {
  const actor = c.get('user');
  const id = actor.role === 'super_admin' ? number(value ?? c.req.query('schoolId'), 'schoolId')! : actor.schoolId!;
  if (!id) fail(400, 'schoolId is required.');
  return id;
};
const assertSchool = (c: AdminContext, schoolId: number) => {
  const actor = c.get('user');
  if (!canAccessSchool(actor, schoolId)) fail(404, 'Not found.');
};
async function scopedCourse(c: AdminContext, write = false) {
  const db = database(c.env),
    id = param(c, 'courseId');
  const [course] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
  if (!course) fail(404, 'Course not found.');
  assertSchool(c, course.schoolId);
  if (write && c.get('user').role === 'general') {
    const [assigned] = await db
      .select()
      .from(courseTeachers)
      .where(and(eq(courseTeachers.courseId, id), eq(courseTeachers.teacherId, c.get('user').id)))
      .limit(1);
    if (!assigned) fail(403, 'Assigned teacher required.');
  }
  return course;
}

academicSettingsRouter.get('/academic-terms', async (c) => {
  const schoolId = requestedSchool(c, undefined);
  return c.json({
    terms: await database(c.env)
      .select()
      .from(academicTerms)
      .where(eq(academicTerms.schoolId, schoolId))
      .orderBy(asc(academicTerms.startsOn)),
  });
});
academicSettingsRouter.post('/academic-terms', async (c) => {
  manager(c);
  const data = await body(c),
    schoolId = requestedSchool(c, data.schoolId),
    now = Date.now();
  const [term] = await database(c.env)
    .insert(academicTerms)
    .values({
      schoolId,
      name: string(data.name, 'name', 100),
      startsOn: string(data.startsOn, 'startsOn', 10),
      endsOn: string(data.endsOn, 'endsOn', 10),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return c.json({ term }, 201);
});
academicSettingsRouter.patch('/academic-terms/:id', async (c) => {
  manager(c);
  const id = param(c),
    data = await body(c),
    db = database(c.env);
  const [old] = await db.select().from(academicTerms).where(eq(academicTerms.id, id)).limit(1);
  if (!old) fail(404, 'Term not found.');
  assertSchool(c, old.schoolId);
  const [term] = await db
    .update(academicTerms)
    .set({
      name: string(data.name, 'name', 100),
      startsOn: string(data.startsOn, 'startsOn', 10),
      endsOn: string(data.endsOn, 'endsOn', 10),
      updatedAt: Date.now(),
    })
    .where(eq(academicTerms.id, id))
    .returning();
  return c.json({ term });
});
academicSettingsRouter.delete('/academic-terms/:id', async (c) => {
  manager(c);
  const id = param(c),
    db = database(c.env);
  const [old] = await db.select().from(academicTerms).where(eq(academicTerms.id, id)).limit(1);
  if (!old) fail(404, 'Term not found.');
  assertSchool(c, old.schoolId);
  await db.delete(academicTerms).where(eq(academicTerms.id, id));
  return c.json({ ok: true });
});

academicSettingsRouter.get('/periods', async (c) => {
  const schoolId = requestedSchool(c, undefined);
  return c.json({
    periods: await database(c.env)
      .select()
      .from(schoolPeriods)
      .where(eq(schoolPeriods.schoolId, schoolId))
      .orderBy(asc(schoolPeriods.periodNumber)),
  });
});
academicSettingsRouter.post('/periods', async (c) => {
  manager(c);
  const data = await body(c),
    schoolId = requestedSchool(c, data.schoolId),
    now = Date.now();
  const [period] = await database(c.env)
    .insert(schoolPeriods)
    .values({
      schoolId,
      periodNumber: number(data.periodNumber, 'periodNumber')!,
      name: string(data.name, 'name', 100, true),
      startsAt: string(data.startsAt, 'startsAt', 5),
      endsAt: string(data.endsAt, 'endsAt', 5),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return c.json({ period }, 201);
});
academicSettingsRouter.patch('/periods/:id', async (c) => {
  manager(c);
  const id = param(c),
    data = await body(c),
    db = database(c.env);
  const [old] = await db.select().from(schoolPeriods).where(eq(schoolPeriods.id, id)).limit(1);
  if (!old) fail(404, 'Period not found.');
  assertSchool(c, old.schoolId);
  const [period] = await db
    .update(schoolPeriods)
    .set({
      periodNumber: number(data.periodNumber, 'periodNumber')!,
      name: string(data.name, 'name', 100, true),
      startsAt: string(data.startsAt, 'startsAt', 5),
      endsAt: string(data.endsAt, 'endsAt', 5),
      updatedAt: Date.now(),
    })
    .where(eq(schoolPeriods.id, id))
    .returning();
  return c.json({ period });
});
academicSettingsRouter.delete('/periods/:id', async (c) => {
  manager(c);
  const id = param(c),
    db = database(c.env);
  const [old] = await db.select().from(schoolPeriods).where(eq(schoolPeriods.id, id)).limit(1);
  if (!old) fail(404, 'Period not found.');
  assertSchool(c, old.schoolId);
  await db.delete(schoolPeriods).where(eq(schoolPeriods.id, id));
  return c.json({ ok: true });
});
