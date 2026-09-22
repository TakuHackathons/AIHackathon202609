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

export const resourceRouter = new Hono<AdminEnv>();
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

const resourceValues = (d: Record<string, unknown>) => {
  const k = String(d.kind);
  if (!['rule', 'career', 'event', 'other'].includes(k)) fail(400, 'Invalid kind.');
  return {
    kind: k as any,
    title: text(d.title, 'title'),
    category: text(d.category, 'category', 100, false),
    body: text(d.body, 'body', 50000, false),
    externalUrl: text(d.externalUrl, 'externalUrl', 2000, false),
    startsAt: d.startsAt ? Number(d.startsAt) : null,
    endsAt: d.endsAt ? Number(d.endsAt) : null,
  };
};
resourceRouter.get('/resources', async (c) => {
  const s = listSchool(c),
    q = c.req.query('q')?.trim();
  if (!s) return c.json({ resources: [] });
  const w = q
    ? and(
        eq(resources.schoolId, s),
        or(like(resources.title, '%' + q + '%'), like(resources.category, '%' + q + '%'), like(resources.body, '%' + q + '%')),
      )
    : eq(resources.schoolId, s);
  return c.json({ resources: await database(c.env).select().from(resources).where(w).orderBy(asc(resources.title)) });
});
resourceRouter.post('/resources', async (c) => {
  manager(c);
  const d = await body(c),
    now = Date.now(),
    [r] = await database(c.env)
      .insert(resources)
      .values({ schoolId: schoolId(c, d.schoolId), ...resourceValues(d), createdBy: c.get('user').id, createdAt: now, updatedAt: now })
      .returning();
  await syncResourceSearch(c, r.id);
  return c.json({ resource: r }, 201);
});
resourceRouter.get('/resources/:id', async (c) => {
  const r = await resource(c);
  return c.json({ resource: r, files: await database(c.env).select().from(resourceFiles).where(eq(resourceFiles.resourceId, r.id)) });
});
resourceRouter.patch('/resources/:id', async (c) => {
  manager(c);
  const old = await resource(c),
    [r] = await database(c.env)
      .update(resources)
      .set({ ...resourceValues(await body(c)), updatedAt: Date.now() })
      .where(eq(resources.id, old.id))
      .returning();
  await syncResourceSearch(c, r.id);
  return c.json({ resource: r });
});
resourceRouter.delete('/resources/:id', async (c) => {
  manager(c);
  const r = await resource(c),
    db = database(c.env),
    files = await db.select().from(resourceFiles).where(eq(resourceFiles.resourceId, r.id));
  await Promise.all(files.map((f) => c.env.DOCUMENTS.delete(f.r2Key)));
  await db.delete(resources).where(eq(resources.id, r.id));
  return c.json({ ok: true });
});
resourceRouter.post('/resources/:id/files', async (c) => {
  manager(c);
  const r = await resource(c),
    form = await c.req.formData(),
    file = form.get('file');
  if (!file || typeof file === 'string' || (file as any).type !== 'application/pdf' || (file as any).size > 10000000)
    fail(400, 'PDF is required (max 10 MB).');
  const pdfFile = file as unknown as File;
  const buffer = await pdfFile.arrayBuffer(),
    pdf = await getDocumentProxy(new Uint8Array(buffer));
  if (pdf.numPages > 100) fail(400, 'PDF is too long.');
  const extracted = await extractText(pdf, { mergePages: true }),
    key = r.schoolId + '/' + r.id + '/' + crypto.randomUUID() + '.pdf';
  await c.env.DOCUMENTS.put(key, buffer, { httpMetadata: { contentType: pdfFile.type } });
  const [x] = await database(c.env)
    .insert(resourceFiles)
    .values({
      resourceId: r.id,
      r2Key: key,
      fileName: pdfFile.name.slice(0, 255),
      contentType: pdfFile.type,
      size: pdfFile.size,
      sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)))
        .map((x) => x.toString(16).padStart(2, '0'))
        .join(''),
      pageCount: pdf.numPages,
      extractionStatus: 'completed',
      extractedAt: Date.now(),
      uploadedBy: c.get('user').id,
      extractedText: String(extracted.text).slice(0, 200000),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    .returning();
  await syncResourceSearch(c, r.id);
  return c.json({ file: x }, 201);
});
resourceRouter.get('/resources/:resourceId/files/:id', async (c) => {
  const r = await resource(c, id(c, 'resourceId')),
    [f] = await database(c.env)
      .select()
      .from(resourceFiles)
      .where(and(eq(resourceFiles.id, id(c)), eq(resourceFiles.resourceId, r.id)))
      .limit(1);
  if (!f) fail(404, 'File not found.');
  const o = await c.env.DOCUMENTS.get(f.r2Key);
  if (!o) fail(404, 'File not found.');
  return new Response(o!.body, {
    headers: { 'Content-Type': f.contentType, 'Content-Disposition': 'attachment; filename="' + encodeURIComponent(f.fileName) + '"' },
  });
});
