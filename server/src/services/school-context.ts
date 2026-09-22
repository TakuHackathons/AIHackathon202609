import { and, eq, inArray } from 'drizzle-orm';
import type { Bindings } from '../bindings';
import { database } from '../db';
import {
  assignments,
  attendance,
  courseEnrollments,
  courseSchedules,
  courseSessions,
  courses,
  facilities,
  facilityBusinessExceptions,
  facilityBusinessHours,
  facilityStatusOverrides,
  resourceFiles,
  resources,
  scheduleExceptions,
  schoolPeriods,
  schools,
  studentTagAssignments,
  studentTags,
  students,
} from '../db/schema';

export async function buildSchoolContext(env: Bindings, code: string, studentNumber = '') {
  const db = database(env);
  const [school] = await db.select().from(schools).where(eq(schools.code, code)).limit(1);
  if (!school) return null;

  const [facilityRows, courseRows, resourceRows, periodRows] = await Promise.all([
    db.select().from(facilities).where(eq(facilities.schoolId, school.id)),
    db.select().from(courses).where(eq(courses.schoolId, school.id)),
    db.select().from(resources).where(eq(resources.schoolId, school.id)),
    db.select().from(schoolPeriods).where(eq(schoolPeriods.schoolId, school.id)),
  ]);

  let selected: typeof students.$inferSelect | undefined;
  let courseIds = courseRows.map((row) => row.id);
  let attendanceRows: Array<typeof attendance.$inferSelect> = [];
  let tags: string[] = [];

  if (studentNumber) {
    [selected] = await db
      .select()
      .from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.studentNumber, studentNumber)))
      .limit(1);
    if (!selected) return { school, studentMissing: true as const, context: '' };

    const [enrolled, tagRows] = await Promise.all([
      db
        .select()
        .from(courseEnrollments)
        .where(and(eq(courseEnrollments.studentId, selected.id), eq(courseEnrollments.status, 'active'))),
      db
        .select({ name: studentTags.name })
        .from(studentTagAssignments)
        .innerJoin(studentTags, eq(studentTagAssignments.tagId, studentTags.id))
        .where(eq(studentTagAssignments.studentId, selected.id)),
    ]);
    courseIds = enrolled.map((row) => row.courseId);
    tags = tagRows.map((row) => row.name);

    const sessions = courseIds.length ? await db.select().from(courseSessions).where(inArray(courseSessions.courseId, courseIds)) : [];
    attendanceRows = sessions.length
      ? await db
          .select()
          .from(attendance)
          .where(
            and(
              eq(attendance.studentId, selected.id),
              inArray(
                attendance.courseSessionId,
                sessions.map((row) => row.id),
              ),
            ),
          )
      : [];
  }

  const visibleCourses = courseRows.filter((row) => courseIds.includes(row.id));
  const facilityIds = facilityRows.map((row) => row.id);
  const [hours, businessExceptions, overrides, schedules, scheduleExceptionRows, sessions, tasks, files] = await Promise.all([
    facilityIds.length ? db.select().from(facilityBusinessHours).where(inArray(facilityBusinessHours.facilityId, facilityIds)) : [],
    facilityIds.length
      ? db.select().from(facilityBusinessExceptions).where(inArray(facilityBusinessExceptions.facilityId, facilityIds))
      : [],
    facilityIds.length ? db.select().from(facilityStatusOverrides).where(inArray(facilityStatusOverrides.facilityId, facilityIds)) : [],
    courseIds.length ? db.select().from(courseSchedules).where(inArray(courseSchedules.courseId, courseIds)) : [],
    courseIds.length ? db.select().from(scheduleExceptions).where(inArray(scheduleExceptions.courseId, courseIds)) : [],
    courseIds.length ? db.select().from(courseSessions).where(inArray(courseSessions.courseId, courseIds)) : [],
    courseIds.length ? db.select().from(assignments).where(inArray(assignments.courseId, courseIds)) : [],
    resourceRows.length
      ? db
          .select()
          .from(resourceFiles)
          .where(
            inArray(
              resourceFiles.resourceId,
              resourceRows.map((row) => row.id),
            ),
          )
      : [],
  ]);

  const context = JSON.stringify({
    school,
    periods: periodRows,
    facilities: facilityRows.map((facility) => ({
      ...facility,
      businessHours: hours.filter((row) => row.facilityId === facility.id),
      businessExceptions: businessExceptions.filter((row) => row.facilityId === facility.id),
      statusOverrides: overrides.filter((row) => row.facilityId === facility.id),
    })),
    courses: visibleCourses,
    schedules,
    scheduleExceptions: scheduleExceptionRows,
    sessions,
    assignments: tasks,
    resources: resourceRows.map((resource) => ({
      ...resource,
      documents: files
        .filter((file) => file.resourceId === resource.id && file.extractionStatus === 'completed')
        .map((file) => ({ name: file.fileName, text: file.extractedText.slice(0, 12000) })),
    })),
    student: selected && {
      studentNumber: selected.studentNumber,
      personality: selected.personality,
      considerations: selected.considerations,
      tags,
    },
    attendance: attendanceRows,
  }).slice(0, 80000);

  return { school, student: selected, studentMissing: false as const, context };
}
