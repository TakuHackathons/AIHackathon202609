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

export const facilityDetailsRouter = new Hono<AdminEnv>();
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

facilityDetailsRouter.get('/facilities/:id', async (c) => {
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
facilityDetailsRouter.delete('/facilities/:facilityId/exceptions/:id', async (c) => {
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
facilityDetailsRouter.delete('/facilities/:facilityId/overrides/:id', async (c) => {
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
