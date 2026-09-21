import { Hono } from 'hono';
import { and, asc, eq, inArray, like, or } from 'drizzle-orm';
import { extractText, getDocumentProxy } from 'unpdf';
import { database } from '../db';
import {
  assignments,
  attendance,
  courses,
  courseSchedules,
  courseStudents,
  facilities,
  facilityExceptions,
  facilityHours,
  resourceFiles,
  resources,
  scheduleExceptions,
  schools,
  students,
  users,
} from '../db/schema';
import { body, fail, type AdminContext, type AdminEnv } from './security';

export const catalogRouter = new Hono<AdminEnv>();
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
  if (a.role !== 'super_admin' && a.schoolId !== s) fail(404, 'Not found.');
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
  if (write && c.get('user').role === 'general' && r.teacherId !== c.get('user').id)
    fail(403, 'Only the assigned teacher can update this course.');
  return r;
}
async function resource(c: AdminContext, n = id(c)) {
  const [r] = await database(c.env).select().from(resources).where(eq(resources.id, n)).limit(1);
  if (!r) fail(404, 'Resource not found.');
  scope(c, r.schoolId);
  return r;
}

catalogRouter.get('/facilities', async (c) => {
  const s = listSchool(c);
  if (!s) return c.json({ facilities: [] });
  return c.json({
    facilities: await database(c.env).select().from(facilities).where(eq(facilities.schoolId, s)).orderBy(asc(facilities.name)),
  });
});
catalogRouter.post('/facilities', async (c) => {
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
catalogRouter.patch('/facilities/:id', async (c) => {
  manager(c);
  const old = await facility(c),
    d = await body(c),
    ms = ['open', 'closed', 'restricted'].includes(String(d.manualStatus)) ? (d.manualStatus as 'open' | 'closed' | 'restricted') : null,
    [r] = await database(c.env)
      .update(facilities)
      .set({
        name: text(d.name, 'name'),
        category: text(d.category, 'category', 100, false),
        description: text(d.description, 'description', 4000, false),
        location: text(d.location, 'location', 300, false),
        manualStatus: ms,
        manualStatusUntil: ms && d.manualStatusUntil ? Number(d.manualStatusUntil) : null,
        updatedAt: Date.now(),
      })
      .where(eq(facilities.id, old.id))
      .returning();
  return c.json({ facility: r });
});
catalogRouter.delete('/facilities/:id', async (c) => {
  manager(c);
  const r = await facility(c);
  await database(c.env).delete(facilities).where(eq(facilities.id, r.id));
  return c.json({ ok: true });
});
catalogRouter.put('/facilities/:id/hours', async (c) => {
  manager(c);
  const f = await facility(c),
    d = await body(c);
  if (!Array.isArray(d.hours)) fail(400, 'hours must be an array.');
  const hourRows = d.hours as unknown[];
  const rows = hourRows.map((v: unknown) => {
      const x = v as any,
        w = Number(x.weekday);
      if (!Number.isInteger(w) || w < 0 || w > 6) fail(400, 'Invalid weekday.');
      return {
        facilityId: f.id,
        weekday: w,
        opensAt: text(x.opensAt, 'opensAt', 5, false),
        closesAt: text(x.closesAt, 'closesAt', 5, false),
        closed: Boolean(x.closed),
      };
    }),
    db = database(c.env);
  await db.delete(facilityHours).where(eq(facilityHours.facilityId, f.id));
  if (rows.length) await db.insert(facilityHours).values(rows);
  return c.json({ hours: rows });
});
catalogRouter.post('/facilities/:id/exceptions', async (c) => {
  manager(c);
  const f = await facility(c),
    d = await body(c),
    st = String(d.status);
  if (!['open', 'closed', 'restricted'].includes(st)) fail(400, 'Invalid status.');
  const [r] = await database(c.env)
    .insert(facilityExceptions)
    .values({
      facilityId: f.id,
      date: text(d.date, 'date', 10),
      status: st as any,
      opensAt: text(d.opensAt, 'opensAt', 5, false),
      closesAt: text(d.closesAt, 'closesAt', 5, false),
      note: text(d.note, 'note', 500, false),
    })
    .returning();
  return c.json({ exception: r }, 201);
});

catalogRouter.get('/students', async (c) => {
  const s = listSchool(c);
  return c.json({
    students: s ? await database(c.env).select().from(students).where(eq(students.schoolId, s)).orderBy(asc(students.studentNumber)) : [],
  });
});
catalogRouter.post('/students', async (c) => {
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
        tags: Array.isArray(d.tags) ? d.tags.map(String).slice(0, 30) : [],
        createdAt: now,
        updatedAt: now,
      })
      .returning();
  return c.json({ student: r }, 201);
});
catalogRouter.patch('/students/:id', async (c) => {
  manager(c);
  const old = await student(c),
    d = await body(c),
    [r] = await database(c.env)
      .update(students)
      .set({
        studentNumber: text(d.studentNumber, 'studentNumber', 80),
        personality: text(d.personality, 'personality', 4000, false),
        considerations: text(d.considerations, 'considerations', 4000, false),
        tags: Array.isArray(d.tags) ? d.tags.map(String).slice(0, 30) : [],
        updatedAt: Date.now(),
      })
      .where(eq(students.id, old.id))
      .returning();
  return c.json({ student: r });
});
catalogRouter.delete('/students/:id', async (c) => {
  manager(c);
  const r = await student(c);
  await database(c.env).delete(students).where(eq(students.id, r.id));
  return c.json({ ok: true });
});

catalogRouter.get('/courses', async (c) => {
  const s = listSchool(c),
    a = c.get('user');
  if (!s) return c.json({ courses: [] });
  const w = a.role === 'general' ? and(eq(courses.schoolId, s), eq(courses.teacherId, a.id)) : eq(courses.schoolId, s);
  return c.json({ courses: await database(c.env).select().from(courses).where(w).orderBy(asc(courses.code)) });
});
catalogRouter.post('/courses', async (c) => {
  const a = c.get('user'),
    d = await body(c),
    s = schoolId(c, d.schoolId),
    teacherId = a.role === 'general' ? a.id : num(d.teacherId, 'teacherId')!,
    now = Date.now(),
    [teacher] = await database(c.env)
      .select()
      .from(users)
      .where(and(eq(users.id, teacherId), eq(users.schoolId, s)))
      .limit(1);
  if (!teacher) fail(400, 'Teacher is invalid.');
  const [r] = await database(c.env)
    .insert(courses)
    .values({
      schoolId: s,
      teacherId,
      facilityId: num(d.facilityId, 'facilityId', true),
      code: text(d.code, 'code', 80),
      name: text(d.name, 'name'),
      description: text(d.description, 'description', 4000, false),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return c.json({ course: r }, 201);
});
catalogRouter.patch('/courses/:courseId', async (c) => {
  const old = await course(c, true),
    a = c.get('user'),
    d = await body(c),
    [r] = await database(c.env)
      .update(courses)
      .set({
        teacherId: a.role === 'general' ? a.id : num(d.teacherId, 'teacherId')!,
        facilityId: num(d.facilityId, 'facilityId', true),
        code: text(d.code, 'code', 80),
        name: text(d.name, 'name'),
        description: text(d.description, 'description', 4000, false),
        updatedAt: Date.now(),
      })
      .where(eq(courses.id, old.id))
      .returning();
  return c.json({ course: r });
});
catalogRouter.delete('/courses/:courseId', async (c) => {
  manager(c);
  const r = await course(c);
  await database(c.env).delete(courses).where(eq(courses.id, r.id));
  return c.json({ ok: true });
});
catalogRouter.get('/courses/:courseId', async (c) => {
  const r = await course(c),
    db = database(c.env);
  const [e, s, x, a, t] = await Promise.all([
    db.select().from(courseStudents).where(eq(courseStudents.courseId, r.id)),
    db.select().from(courseSchedules).where(eq(courseSchedules.courseId, r.id)),
    db.select().from(scheduleExceptions).where(eq(scheduleExceptions.courseId, r.id)),
    db.select().from(assignments).where(eq(assignments.courseId, r.id)),
    db.select().from(attendance).where(eq(attendance.courseId, r.id)),
  ]);
  return c.json({ course: r, enrollments: e, schedules: s, exceptions: x, assignments: a, attendance: t });
});
catalogRouter.post('/courses/:courseId/enrollments', async (c) => {
  const r = await course(c, true),
    d = await body(c),
    sid = num(d.studentId, 'studentId')!,
    s = await student(c, sid);
  if (s.schoolId !== r.schoolId) fail(400, 'Student is invalid.');
  await database(c.env).insert(courseStudents).values({ courseId: r.id, studentId: sid }).onConflictDoNothing();
  return c.json({ ok: true }, 201);
});
catalogRouter.post('/courses/:courseId/schedules', async (c) => {
  const r = await course(c, true),
    d = await body(c),
    w = Number(d.weekday);
  if (!Number.isInteger(w) || w < 0 || w > 6) fail(400, 'Invalid weekday.');
  const [x] = await database(c.env)
    .insert(courseSchedules)
    .values({
      courseId: r.id,
      weekday: w,
      startsAt: text(d.startsAt, 'startsAt', 5),
      endsAt: text(d.endsAt, 'endsAt', 5),
      validFrom: text(d.validFrom, 'validFrom', 10),
      validTo: text(d.validTo, 'validTo', 10),
    })
    .returning();
  return c.json({ schedule: x }, 201);
});
catalogRouter.post('/courses/:courseId/assignments', async (c) => {
  const r = await course(c, true),
    d = await body(c),
    now = Date.now(),
    [x] = await database(c.env)
      .insert(assignments)
      .values({
        courseId: r.id,
        title: text(d.title, 'title'),
        description: text(d.description, 'description', 4000, false),
        dueAt: d.dueAt ? Number(d.dueAt) : null,
        externalUrl: text(d.externalUrl, 'externalUrl', 2000, false),
        createdBy: c.get('user').id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
  return c.json({ assignment: x }, 201);
});
async function saveAttendance(c: AdminContext, courseId: number, studentId: number, d: Record<string, unknown>) {
  const [enrolled] = await database(c.env)
    .select()
    .from(courseStudents)
    .where(and(eq(courseStudents.courseId, courseId), eq(courseStudents.studentId, studentId)))
    .limit(1);
  if (!enrolled) fail(400, 'Student is not enrolled.');
  const st = String(d.status);
  if (!['present', 'late', 'absent', 'excused'].includes(st)) fail(400, 'Invalid status.');
  await database(c.env)
    .insert(attendance)
    .values({
      courseId,
      studentId,
      date: text(d.date, 'date', 10),
      status: st as any,
      note: text(d.note, 'note', 500, false),
      recordedBy: c.get('user').id,
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: [attendance.courseId, attendance.studentId, attendance.date],
      set: { status: st as any, note: text(d.note, 'note', 500, false), recordedBy: c.get('user').id, updatedAt: Date.now() },
    });
}
catalogRouter.post('/courses/:courseId/attendance', async (c) => {
  const r = await course(c, true),
    d = await body(c);
  await saveAttendance(c, r.id, num(d.studentId, 'studentId')!, d);
  return c.json({ ok: true });
});
catalogRouter.post('/courses/:courseId/attendance/import', async (c) => {
  const r = await course(c, true),
    form = await c.req.formData(),
    file = form.get('file');
  if (!file || typeof file === 'string' || (file as any).size > 2000000) fail(400, 'CSV is required.');
  const csvFile = file as unknown as File;
  const lines = (await csvFile.text())
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter(Boolean),
    header = lines
      .shift()!
      .split(',')
      .map((x: string) => x.trim().toLowerCase()),
    pos = (n: string) => header.indexOf(n),
    all = await database(c.env).select().from(students).where(eq(students.schoolId, r.schoolId)),
    map = new Map(all.map((x) => [x.studentNumber, x.id])),
    errors: string[] = [];
  let imported = 0;
  for (const [i, line] of lines.entries()) {
    try {
      const v = line.split(',').map((x) => x.trim()),
        sid = map.get(v[pos('student_number')]);
      if (!sid) throw new Error('Unknown student');
      await saveAttendance(c, r.id, sid, { date: v[pos('date')], status: v[pos('status')], note: pos('note') >= 0 ? v[pos('note')] : '' });
      imported++;
    } catch (e) {
      errors.push('Row ' + (i + 2) + ': ' + (e instanceof Error ? e.message : 'Invalid'));
    }
  }
  return c.json({ imported, errors });
});

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
catalogRouter.get('/resources', async (c) => {
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
catalogRouter.post('/resources', async (c) => {
  manager(c);
  const d = await body(c),
    now = Date.now(),
    [r] = await database(c.env)
      .insert(resources)
      .values({ schoolId: schoolId(c, d.schoolId), ...resourceValues(d), createdBy: c.get('user').id, createdAt: now, updatedAt: now })
      .returning();
  return c.json({ resource: r }, 201);
});
catalogRouter.get('/resources/:id', async (c) => {
  const r = await resource(c);
  return c.json({ resource: r, files: await database(c.env).select().from(resourceFiles).where(eq(resourceFiles.resourceId, r.id)) });
});
catalogRouter.patch('/resources/:id', async (c) => {
  manager(c);
  const old = await resource(c),
    [r] = await database(c.env)
      .update(resources)
      .set({ ...resourceValues(await body(c)), updatedAt: Date.now() })
      .where(eq(resources.id, old.id))
      .returning();
  return c.json({ resource: r });
});
catalogRouter.delete('/resources/:id', async (c) => {
  manager(c);
  const r = await resource(c),
    db = database(c.env),
    files = await db.select().from(resourceFiles).where(eq(resourceFiles.resourceId, r.id));
  await Promise.all(files.map((f) => c.env.DOCUMENTS.delete(f.r2Key)));
  await db.delete(resources).where(eq(resources.id, r.id));
  return c.json({ ok: true });
});
catalogRouter.post('/resources/:id/files', async (c) => {
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
      extractedText: String(extracted.text).slice(0, 200000),
      createdAt: Date.now(),
    })
    .returning();
  return c.json({ file: x }, 201);
});
catalogRouter.get('/resources/:resourceId/files/:id', async (c) => {
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
