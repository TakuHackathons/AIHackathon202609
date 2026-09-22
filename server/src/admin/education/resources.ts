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

export const resourceSearchRouter = new Hono<AdminEnv>();
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

resourceSearchRouter.get('/resources/search', async (c) => {
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
resourceSearchRouter.delete('/resources/:resourceId/files/:id', async (c) => {
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
