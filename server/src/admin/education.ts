import { Hono } from 'hono';
import { and, asc, eq, inArray, like, or } from 'drizzle-orm';
import { database } from '../db';
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
} from '../db/schema';
import { facilityStatuses } from '../services/facility-status';
import { body, fail, type AdminContext, type AdminEnv } from './security';

export const educationRouter = new Hono<AdminEnv>();
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
  if (actor.role !== 'super_admin' && actor.schoolId !== schoolId) fail(404, 'Not found.');
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

educationRouter.get('/academic-terms', async (c) => {
  const schoolId = requestedSchool(c, undefined);
  return c.json({
    terms: await database(c.env)
      .select()
      .from(academicTerms)
      .where(eq(academicTerms.schoolId, schoolId))
      .orderBy(asc(academicTerms.startsOn)),
  });
});
educationRouter.post('/academic-terms', async (c) => {
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
educationRouter.patch('/academic-terms/:id', async (c) => {
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
educationRouter.delete('/academic-terms/:id', async (c) => {
  manager(c);
  const id = param(c),
    db = database(c.env);
  const [old] = await db.select().from(academicTerms).where(eq(academicTerms.id, id)).limit(1);
  if (!old) fail(404, 'Term not found.');
  assertSchool(c, old.schoolId);
  await db.delete(academicTerms).where(eq(academicTerms.id, id));
  return c.json({ ok: true });
});

educationRouter.get('/periods', async (c) => {
  const schoolId = requestedSchool(c, undefined);
  return c.json({
    periods: await database(c.env)
      .select()
      .from(schoolPeriods)
      .where(eq(schoolPeriods.schoolId, schoolId))
      .orderBy(asc(schoolPeriods.periodNumber)),
  });
});
educationRouter.post('/periods', async (c) => {
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
educationRouter.patch('/periods/:id', async (c) => {
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
educationRouter.delete('/periods/:id', async (c) => {
  manager(c);
  const id = param(c),
    db = database(c.env);
  const [old] = await db.select().from(schoolPeriods).where(eq(schoolPeriods.id, id)).limit(1);
  if (!old) fail(404, 'Period not found.');
  assertSchool(c, old.schoolId);
  await db.delete(schoolPeriods).where(eq(schoolPeriods.id, id));
  return c.json({ ok: true });
});

educationRouter.get('/facilities/:id', async (c) => {
  const id = param(c),
    db = database(c.env),
    [facility] = await db.select().from(facilities).where(eq(facilities.id, id)).limit(1);
  if (!facility) fail(404, 'Facility not found.');
  assertSchool(c, facility.schoolId);
  const [hours, exceptions, overrides, statuses] = await Promise.all([
    db.select().from(facilityBusinessHours).where(eq(facilityBusinessHours.facilityId, id)),
    db.select().from(facilityBusinessExceptions).where(eq(facilityBusinessExceptions.facilityId, id)),
    db.select().from(facilityStatusOverrides).where(eq(facilityStatusOverrides.facilityId, id)),
    facilityStatuses(c.env, [facility]),
  ]);
  return c.json({ facility: { ...facility, currentStatus: statuses.get(id) }, hours, exceptions, overrides });
});
educationRouter.delete('/facilities/:facilityId/exceptions/:id', async (c) => {
  manager(c);
  const facilityId = param(c, 'facilityId'),
    id = param(c),
    db = database(c.env);
  const [facility] = await db.select().from(facilities).where(eq(facilities.id, facilityId)).limit(1);
  if (!facility) fail(404, 'Facility not found.');
  assertSchool(c, facility.schoolId);
  await db
    .delete(facilityBusinessExceptions)
    .where(and(eq(facilityBusinessExceptions.id, id), eq(facilityBusinessExceptions.facilityId, facilityId)));
  return c.json({ ok: true });
});
educationRouter.delete('/facilities/:facilityId/overrides/:id', async (c) => {
  manager(c);
  const facilityId = param(c, 'facilityId'),
    id = param(c),
    db = database(c.env);
  const [facility] = await db.select().from(facilities).where(eq(facilities.id, facilityId)).limit(1);
  if (!facility) fail(404, 'Facility not found.');
  assertSchool(c, facility.schoolId);
  await db
    .delete(facilityStatusOverrides)
    .where(and(eq(facilityStatusOverrides.id, id), eq(facilityStatusOverrides.facilityId, facilityId)));
  return c.json({ ok: true });
});

educationRouter.delete('/courses/:courseId/enrollments/:id', async (c) => {
  const course = await scopedCourse(c, true);
  await database(c.env)
    .update(courseEnrollments)
    .set({ status: 'withdrawn', withdrawnAt: Date.now(), updatedAt: Date.now() })
    .where(and(eq(courseEnrollments.id, param(c)), eq(courseEnrollments.courseId, course.id)));
  return c.json({ ok: true });
});
educationRouter.patch('/courses/:courseId/schedules/:id', async (c) => {
  const course = await scopedCourse(c, true),
    data = await body(c),
    db = database(c.env),
    now = Date.now();
  const [schedule] = await db
    .update(courseSchedules)
    .set({
      periodId: number(data.periodId, 'periodId')!,
      facilityId: number(data.facilityId, 'facilityId', true),
      weekday: Number(data.weekday),
      locationNote: string(data.locationNote, 'locationNote', 300, true),
      validFrom: string(data.validFrom, 'validFrom', 10),
      validTo: string(data.validTo, 'validTo', 10),
      updatedBy: c.get('user').id,
      updatedAt: now,
    })
    .where(and(eq(courseSchedules.id, param(c)), eq(courseSchedules.courseId, course.id)))
    .returning();
  if (!schedule) fail(404, 'Schedule not found.');
  return c.json({ schedule });
});
educationRouter.delete('/courses/:courseId/schedules/:id', async (c) => {
  const course = await scopedCourse(c, true);
  await database(c.env)
    .delete(courseSchedules)
    .where(and(eq(courseSchedules.id, param(c)), eq(courseSchedules.courseId, course.id)));
  return c.json({ ok: true });
});
educationRouter.post('/courses/:courseId/exceptions', async (c) => {
  const course = await scopedCourse(c, true),
    data = await body(c),
    kind = String(data.kind);
  if (!['cancelled', 'makeup', 'rescheduled', 'room_changed'].includes(kind)) fail(400, 'Invalid kind.');
  const now = Date.now();
  const [exception] = await database(c.env)
    .insert(scheduleExceptions)
    .values({
      courseId: course.id,
      courseScheduleId: number(data.courseScheduleId, 'courseScheduleId', true),
      periodId: number(data.periodId, 'periodId', true),
      facilityId: number(data.facilityId, 'facilityId', true),
      date: string(data.date, 'date', 10),
      kind: kind as any,
      startsAt: string(data.startsAt, 'startsAt', 5, true) || null,
      endsAt: string(data.endsAt, 'endsAt', 5, true) || null,
      locationNote: string(data.locationNote, 'locationNote', 300, true),
      note: string(data.note, 'note', 500, true),
      createdBy: c.get('user').id,
      updatedBy: c.get('user').id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return c.json({ exception }, 201);
});
educationRouter.delete('/courses/:courseId/exceptions/:id', async (c) => {
  const course = await scopedCourse(c, true);
  await database(c.env)
    .delete(scheduleExceptions)
    .where(and(eq(scheduleExceptions.id, param(c)), eq(scheduleExceptions.courseId, course.id)));
  return c.json({ ok: true });
});
educationRouter.post('/courses/:courseId/sessions', async (c) => {
  const course = await scopedCourse(c, true),
    data = await body(c),
    now = Date.now();
  const [session] = await database(c.env)
    .insert(courseSessions)
    .values({
      courseId: course.id,
      courseScheduleId: number(data.courseScheduleId, 'courseScheduleId', true),
      scheduleExceptionId: number(data.scheduleExceptionId, 'scheduleExceptionId', true),
      periodId: number(data.periodId, 'periodId', true),
      facilityId: number(data.facilityId, 'facilityId', true),
      sessionDate: string(data.sessionDate, 'sessionDate', 10),
      startsAt: string(data.startsAt, 'startsAt', 5),
      endsAt: string(data.endsAt, 'endsAt', 5),
      locationNote: string(data.locationNote, 'locationNote', 300, true),
      status: 'scheduled',
      source: 'manual',
      createdBy: c.get('user').id,
      updatedBy: c.get('user').id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return c.json({ session }, 201);
});
educationRouter.delete('/courses/:courseId/sessions/:id', async (c) => {
  const course = await scopedCourse(c, true);
  await database(c.env)
    .delete(courseSessions)
    .where(and(eq(courseSessions.id, param(c)), eq(courseSessions.courseId, course.id)));
  return c.json({ ok: true });
});
educationRouter.patch('/courses/:courseId/assignments/:id', async (c) => {
  const course = await scopedCourse(c, true),
    data = await body(c);
  const [assignment] = await database(c.env)
    .update(assignments)
    .set({
      title: string(data.title, 'title', 200),
      description: string(data.description, 'description', 4000, true),
      publishedAt: data.publishedAt ? Number(data.publishedAt) : null,
      dueAt: data.dueAt ? Number(data.dueAt) : null,
      externalUrl: string(data.externalUrl, 'externalUrl', 2000, true),
      updatedBy: c.get('user').id,
      updatedAt: Date.now(),
    })
    .where(and(eq(assignments.id, param(c)), eq(assignments.courseId, course.id)))
    .returning();
  if (!assignment) fail(404, 'Assignment not found.');
  return c.json({ assignment });
});
educationRouter.delete('/courses/:courseId/assignments/:id', async (c) => {
  const course = await scopedCourse(c, true);
  await database(c.env)
    .delete(assignments)
    .where(and(eq(assignments.id, param(c)), eq(assignments.courseId, course.id)));
  return c.json({ ok: true });
});
educationRouter.delete('/courses/:courseId/attendance/:id', async (c) => {
  const course = await scopedCourse(c, true),
    db = database(c.env);
  const [record] = await db
    .select({ id: attendance.id })
    .from(attendance)
    .innerJoin(courseSessions, eq(attendance.courseSessionId, courseSessions.id))
    .where(and(eq(attendance.id, param(c)), eq(courseSessions.courseId, course.id)))
    .limit(1);
  if (!record) fail(404, 'Attendance not found.');
  await db.delete(attendance).where(eq(attendance.id, record.id));
  return c.json({ ok: true });
});

educationRouter.get('/resources/search', async (c) => {
  const schoolId = requestedSchool(c, undefined),
    query = (c.req.query('q') ?? '').trim();
  if (!query) return c.json({ resources: [] });
  const phrase = '"' + query.replaceAll('"', '""') + '"';
  const matches = await c.env.DB.prepare(
    'SELECT d.resource_id AS id FROM resource_search JOIN resource_search_documents d ON d.id = resource_search.rowid WHERE d.school_id = ? AND resource_search MATCH ? ORDER BY bm25(resource_search) LIMIT 100',
  )
    .bind(schoolId, phrase)
    .all<{ id: number }>();
  const ids = matches.results.map((row) => row.id);
  return c.json({ resources: ids.length ? await database(c.env).select().from(resources).where(inArray(resources.id, ids)) : [] });
});
educationRouter.delete('/resources/:resourceId/files/:id', async (c) => {
  manager(c);
  const resourceId = param(c, 'resourceId'),
    db = database(c.env),
    [resource] = await db.select().from(resources).where(eq(resources.id, resourceId)).limit(1);
  if (!resource) fail(404, 'Resource not found.');
  assertSchool(c, resource.schoolId);
  const [file] = await db
    .delete(resourceFiles)
    .where(and(eq(resourceFiles.id, param(c)), eq(resourceFiles.resourceId, resourceId)))
    .returning();
  if (!file) fail(404, 'File not found.');
  await c.env.DOCUMENTS.delete(file.r2Key);
  const remaining = await db
    .select({ text: resourceFiles.extractedText })
    .from(resourceFiles)
    .where(eq(resourceFiles.resourceId, resourceId));
  await db
    .update(resourceSearchDocuments)
    .set({ extractedText: remaining.map((row) => row.text).join('\n'), updatedAt: Date.now() })
    .where(eq(resourceSearchDocuments.resourceId, resourceId));
  return c.json({ ok: true });
});
