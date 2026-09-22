import { Hono } from 'hono';
import { and, asc, eq, inArray, like, or } from 'drizzle-orm';
import { extractText, getDocumentProxy } from 'unpdf';
import { database } from '../db';
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
      await db
        .insert(facilityStatusOverrides)
        .values({
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
catalogRouter.post('/facilities/:id/exceptions', async (c) => {
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

catalogRouter.get('/students', async (c) => {
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
        createdAt: now,
        updatedAt: now,
      })
      .returning();
  await syncStudentTags(c, r.id, r.schoolId, d.tags);
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
        updatedAt: Date.now(),
      })
      .where(eq(students.id, old.id))
      .returning();
  await syncStudentTags(c, r.id, r.schoolId, d.tags);
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
  const db = database(c.env);
  let rows = await db.select().from(courses).where(eq(courses.schoolId, s)).orderBy(asc(courses.code));
  if (a.role === 'general') {
    const assigned = await db.select({ courseId: courseTeachers.courseId }).from(courseTeachers).where(eq(courseTeachers.teacherId, a.id));
    const ids = new Set(assigned.map((x) => x.courseId));
    rows = rows.filter((x) => ids.has(x.id));
  }
  return c.json({ courses: rows });
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
      academicTermId: num(d.academicTermId, 'academicTermId')!,
      code: text(d.code, 'code', 80),
      name: text(d.name, 'name'),
      description: text(d.description, 'description', 4000, false),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await database(c.env)
    .insert(courseTeachers)
    .values({ courseId: r.id, teacherId, assignmentRole: 'primary', createdAt: now, updatedAt: now });
  return c.json({ course: { ...r, teacherId } }, 201);
});
catalogRouter.patch('/courses/:courseId', async (c) => {
  const old = await course(c, true),
    a = c.get('user'),
    d = await body(c),
    now = Date.now(),
    db = database(c.env),
    [r] = await db
      .update(courses)
      .set({
        code: text(d.code, 'code', 80),
        name: text(d.name, 'name'),
        description: text(d.description, 'description', 4000, false),
        updatedAt: Date.now(),
      })
      .where(eq(courses.id, old.id))
      .returning();
  if (a.role !== 'general' && d.teacherId !== undefined) {
    const teacherId = num(d.teacherId, 'teacherId')!;
    const [teacher] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, teacherId), eq(users.schoolId, old.schoolId)))
      .limit(1);
    if (!teacher) fail(400, 'Teacher is invalid.');
    await db.delete(courseTeachers).where(and(eq(courseTeachers.courseId, old.id), eq(courseTeachers.assignmentRole, 'primary')));
    await db
      .insert(courseTeachers)
      .values({ courseId: old.id, teacherId, assignmentRole: 'primary', createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [courseTeachers.courseId, courseTeachers.teacherId],
        set: { assignmentRole: 'primary', updatedAt: now },
      });
  }
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
    db.select().from(courseEnrollments).where(eq(courseEnrollments.courseId, r.id)),
    db.select().from(courseSchedules).where(eq(courseSchedules.courseId, r.id)),
    db.select().from(scheduleExceptions).where(eq(scheduleExceptions.courseId, r.id)),
    db.select().from(assignments).where(eq(assignments.courseId, r.id)),
    db.select().from(courseSessions).where(eq(courseSessions.courseId, r.id)),
  ]);
  const attendanceRows = t.length
    ? await db
        .select()
        .from(attendance)
        .where(
          inArray(
            attendance.courseSessionId,
            t.map((row) => row.id),
          ),
        )
    : [];
  return c.json({ course: r, enrollments: e, schedules: s, exceptions: x, assignments: a, sessions: t, attendance: attendanceRows });
});
catalogRouter.post('/courses/:courseId/enrollments', async (c) => {
  const r = await course(c, true),
    d = await body(c),
    sid = num(d.studentId, 'studentId')!,
    s = await student(c, sid);
  if (s.schoolId !== r.schoolId) fail(400, 'Student is invalid.');
  const now = Date.now();
  await database(c.env)
    .insert(courseEnrollments)
    .values({ courseId: r.id, studentId: sid, status: 'active', enrolledAt: now, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [courseEnrollments.courseId, courseEnrollments.studentId],
      set: { status: 'active', withdrawnAt: null, updatedAt: now },
    });
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
      periodId: num(d.periodId, 'periodId')!,
      facilityId: num(d.facilityId, 'facilityId', true),
      weekday: w,
      locationNote: text(d.locationNote, 'locationNote', 300, false),
      validFrom: text(d.validFrom, 'validFrom', 10),
      validTo: text(d.validTo, 'validTo', 10),
      createdBy: c.get('user').id,
      updatedBy: c.get('user').id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
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
    .from(courseEnrollments)
    .where(and(eq(courseEnrollments.courseId, courseId), eq(courseEnrollments.studentId, studentId)))
    .limit(1);
  if (!enrolled) fail(400, 'Student is not enrolled.');
  const st = String(d.status);
  if (!['present', 'late', 'absent', 'excused'].includes(st)) fail(400, 'Invalid status.');
  const db = database(c.env);
  let courseSessionId = num(d.courseSessionId, 'courseSessionId', true);
  if (!courseSessionId) {
    const date = text(d.date, 'date', 10);
    const sessions = await db
      .select()
      .from(courseSessions)
      .where(and(eq(courseSessions.courseId, courseId), eq(courseSessions.sessionDate, date)));
    const matches = d.startsAt ? sessions.filter((session) => session.startsAt === d.startsAt) : sessions;
    if (matches.length !== 1) fail(400, 'courseSessionId is required when date does not identify one session.');
    courseSessionId = matches[0].id;
  }
  await db
    .insert(attendance)
    .values({
      courseSessionId,
      studentId,
      status: st as any,
      note: text(d.note, 'note', 500, false),
      source: d.source === 'csv' ? 'csv' : 'manual',
      recordedBy: c.get('user').id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: [attendance.courseSessionId, attendance.studentId],
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
      await saveAttendance(c, r.id, sid, {
        courseSessionId: pos('course_session_id') >= 0 ? v[pos('course_session_id')] : null,
        date: pos('date') >= 0 ? v[pos('date')] : null,
        startsAt: pos('starts_at') >= 0 ? v[pos('starts_at')] : null,
        status: v[pos('status')],
        note: pos('note') >= 0 ? v[pos('note')] : '',
        source: 'csv',
      });
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
  await syncResourceSearch(c, r.id);
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
  await syncResourceSearch(c, r.id);
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
