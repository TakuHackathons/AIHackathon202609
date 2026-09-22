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
import { canAccessSchool, canWriteCourse } from '../authorization';
import { body, fail, type AdminContext, type AdminEnv } from '../security';

export const courseDetailsRouter = new Hono<AdminEnv>();
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
    if (!canWriteCourse(c.get('user'), course.schoolId, assigned ? [assigned.teacherId] : [])) fail(403, 'Assigned teacher required.');
  }
  return course;
}

courseDetailsRouter.delete('/courses/:courseId/enrollments/:id', async (c) => {
  const course = await scopedCourse(c, true);
  await database(c.env)
    .update(courseEnrollments)
    .set({ status: 'withdrawn', withdrawnAt: Date.now(), updatedAt: Date.now() })
    .where(and(eq(courseEnrollments.id, param(c)), eq(courseEnrollments.courseId, course.id)));
  return c.json({ ok: true });
});
courseDetailsRouter.patch('/courses/:courseId/schedules/:id', async (c) => {
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
courseDetailsRouter.delete('/courses/:courseId/schedules/:id', async (c) => {
  const course = await scopedCourse(c, true);
  await database(c.env)
    .delete(courseSchedules)
    .where(and(eq(courseSchedules.id, param(c)), eq(courseSchedules.courseId, course.id)));
  return c.json({ ok: true });
});
courseDetailsRouter.post('/courses/:courseId/exceptions', async (c) => {
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
courseDetailsRouter.delete('/courses/:courseId/exceptions/:id', async (c) => {
  const course = await scopedCourse(c, true);
  await database(c.env)
    .delete(scheduleExceptions)
    .where(and(eq(scheduleExceptions.id, param(c)), eq(scheduleExceptions.courseId, course.id)));
  return c.json({ ok: true });
});
courseDetailsRouter.post('/courses/:courseId/sessions', async (c) => {
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
courseDetailsRouter.delete('/courses/:courseId/sessions/:id', async (c) => {
  const course = await scopedCourse(c, true);
  await database(c.env)
    .delete(courseSessions)
    .where(and(eq(courseSessions.id, param(c)), eq(courseSessions.courseId, course.id)));
  return c.json({ ok: true });
});
courseDetailsRouter.patch('/courses/:courseId/assignments/:id', async (c) => {
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
courseDetailsRouter.delete('/courses/:courseId/assignments/:id', async (c) => {
  const course = await scopedCourse(c, true);
  await database(c.env)
    .delete(assignments)
    .where(and(eq(assignments.id, param(c)), eq(assignments.courseId, course.id)));
  return c.json({ ok: true });
});
courseDetailsRouter.delete('/courses/:courseId/attendance/:id', async (c) => {
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
