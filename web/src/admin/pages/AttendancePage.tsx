import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { PageHeading, useSchoolData } from '../educationShared';

type Course = { id: number; code: string; name: string };
type Detail = {
  sessions: Array<{ id: number; sessionDate: string; startsAt: string }>;
  enrollments: Array<{ id: number; studentId: number; status: string }>;
  attendance: Array<{ id: number; courseSessionId: number; studentId: number; status: string; note: string }>;
};

export default function AttendancePage() {
  const { run, setNotice, setError } = useAdmin();
  const courses = useSchoolData<Course>('courses', 'courses');
  const [courseId, setCourseId] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [sessionId, setSessionId] = useState(0);
  const [studentId, setStudentId] = useState(0);
  const [status, setStatus] = useState('present');
  const [errors, setErrors] = useState<string[]>([]);

  const load = async (id = courseId) => setDetail(id ? await adminApi('courses/' + id) : null);
  useEffect(() => {
    void load();
  }, [courseId]);

  const save = () =>
    run(async () => {
      await adminApi('courses/' + courseId + '/attendance', {
        method: 'POST',
        body: JSON.stringify({ courseSessionId: sessionId, studentId, status, note: '' }),
      });
      setNotice('Attendance saved.');
      await load();
    });

  const removeAttendance = (id: number) =>
    run(async () => {
      await adminApi('courses/' + courseId + '/attendance/' + id, { method: 'DELETE' });
      await load();
    });

  const upload = async (file: File) => {
    setErrors([]);
    const body = new FormData();
    body.append('file', file);
    const response = await fetch('/api/admin/courses/' + courseId + '/attendance/import', {
      method: 'POST',
      body,
      credentials: 'same-origin',
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error);
      return;
    }
    setErrors(result.errors ?? []);
    setNotice(result.imported + ' rows imported.');
    await load();
  };

  return (
    <section>
      <PageHeading
        kicker="ATTENDANCE"
        title="Attendance and CSV import"
        description="Record attendance for a course session or import a CSV file."
      />
      {courses.picker}
      <div className="admin-card admin-form">
        <select value={courseId} onChange={(event) => setCourseId(Number(event.target.value))}>
          <option value={0}>Select course</option>
          {courses.rows.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code} {course.name}
            </option>
          ))}
        </select>
        {detail && (
          <>
            <div className="admin-grid">
              <select value={sessionId} onChange={(event) => setSessionId(Number(event.target.value))}>
                <option value={0}>Course session</option>
                {detail.sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.sessionDate} {session.startsAt}
                  </option>
                ))}
              </select>
              <select value={studentId} onChange={(event) => setStudentId(Number(event.target.value))}>
                <option value={0}>Enrolled student</option>
                {detail.enrollments.map((enrollment) => (
                  <option key={enrollment.id} value={enrollment.studentId}>
                    Student #{enrollment.studentId}
                  </option>
                ))}
              </select>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="excused">Excused</option>
              </select>
            </div>
            <button className="admin-primary" disabled={!sessionId || !studentId} onClick={() => void save()}>
              Save attendance
            </button>
            <div className="compact-list">
              {detail.attendance.map((item) => (
                <span key={item.id}>
                  Session #{item.courseSessionId} / Student #{item.studentId} / {item.status}
                  <button className="danger" onClick={() => void removeAttendance(item.id)}>
                    Delete
                  </button>
                </span>
              ))}
            </div>
            <hr />
            <label className="file-button">
              Select CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
            </label>
            <p className="admin-help">Columns: student_number, course_session_id, status, note</p>
          </>
        )}
      </div>
      {errors.length > 0 && (
        <section className="import-errors">
          <h2>Rejected rows</h2>
          <ul>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
