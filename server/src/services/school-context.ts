import { and, eq, inArray } from 'drizzle-orm';
import type { Bindings } from '../bindings';
import { database } from '../db';
import {
  assignments,
  attendance,
  courses,
  courseSchedules,
  courseStudents,
  facilities,
  resourceFiles,
  resources,
  schools,
  students,
} from '../db/schema';
export async function buildSchoolContext(env: Bindings, code: string, studentNumber = '') {
  const db = database(env),
    [school] = await db.select().from(schools).where(eq(schools.code, code)).limit(1);
  if (!school) return null;
  const [facilityRows, courseRows, resourceRows] = await Promise.all([
    db.select().from(facilities).where(eq(facilities.schoolId, school.id)),
    db.select().from(courses).where(eq(courses.schoolId, school.id)),
    db.select().from(resources).where(eq(resources.schoolId, school.id)),
  ]);
  let selected: typeof students.$inferSelect | undefined,
    ids = courseRows.map((x) => x.id),
    attendanceRows: unknown[] = [];
  if (studentNumber) {
    [selected] = await db
      .select()
      .from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.studentNumber, studentNumber)))
      .limit(1);
    if (!selected) return { school, studentMissing: true as const, context: '' };
    const enrolled = await db.select().from(courseStudents).where(eq(courseStudents.studentId, selected.id));
    ids = enrolled.map((x) => x.courseId);
    attendanceRows = ids.length
      ? await db
          .select()
          .from(attendance)
          .where(and(eq(attendance.studentId, selected.id), inArray(attendance.courseId, ids)))
      : [];
  }
  const visible = courseRows.filter((x) => ids.includes(x.id)),
    [schedules, tasks, files] = await Promise.all([
      ids.length ? db.select().from(courseSchedules).where(inArray(courseSchedules.courseId, ids)) : [],
      ids.length ? db.select().from(assignments).where(inArray(assignments.courseId, ids)) : [],
      resourceRows.length
        ? db
            .select()
            .from(resourceFiles)
            .where(
              inArray(
                resourceFiles.resourceId,
                resourceRows.map((x) => x.id),
              ),
            )
        : [],
    ]);
  const context = JSON.stringify({
    school,
    facilities: facilityRows,
    courses: visible,
    schedules,
    assignments: tasks,
    resources: resourceRows.map((x) => ({
      ...x,
      documents: files.filter((f) => f.resourceId === x.id).map((f) => ({ name: f.fileName, text: f.extractedText.slice(0, 12000) })),
    })),
    student: selected && {
      studentNumber: selected.studentNumber,
      personality: selected.personality,
      considerations: selected.considerations,
      tags: selected.tags,
    },
    attendance: attendanceRows,
  }).slice(0, 80000);
  return { school, student: selected, studentMissing: false as const, context };
}
