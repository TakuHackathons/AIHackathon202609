import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { PageHeading, useSchoolData } from '../educationShared';
import { useAdminI18n, type AdminTranslationKey } from '../i18n';
type Course = { id: number; code: string; name: string };
type Detail = {
  sessions: Array<{ id: number; sessionDate: string; startsAt: string }>;
  enrollments: Array<{ id: number; studentId: number }>;
  attendance: Array<{ id: number; courseSessionId: number; studentId: number; status: string }>;
};
export default function AttendancePage() {
  const { run, setNotice, setError } = useAdmin();
  const { t } = useAdminI18n();
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
      setNotice(t('attendance.saved'));
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
    setNotice(t('attendance.imported', { count: result.imported }));
    await load();
  };
  return (
    <section>
      <PageHeading kicker={t('kicker.attendance')} title={t('attendance.title')} description={t('attendance.description')} />
      {courses.picker}
      <div className="admin-card admin-form">
        <select value={courseId} onChange={(event) => setCourseId(Number(event.target.value))}>
          <option value={0}>{t('attendance.selectCourse')}</option>
          {courses.rows.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} {item.name}
            </option>
          ))}
        </select>
        {detail && (
          <>
            <div className="admin-grid">
              <select value={sessionId} onChange={(event) => setSessionId(Number(event.target.value))}>
                <option value={0}>{t('attendance.session')}</option>
                {detail.sessions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sessionDate} {item.startsAt}
                  </option>
                ))}
              </select>
              <select value={studentId} onChange={(event) => setStudentId(Number(event.target.value))}>
                <option value={0}>{t('attendance.student')}</option>
                {detail.enrollments.map((item) => (
                  <option key={item.id} value={item.studentId}>
                    #{item.studentId}
                  </option>
                ))}
              </select>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="present">{t('attendance.present')}</option>
                <option value="late">{t('attendance.late')}</option>
                <option value="absent">{t('attendance.absent')}</option>
                <option value="excused">{t('attendance.excused')}</option>
              </select>
            </div>
            <button className="admin-primary" disabled={!sessionId || !studentId} onClick={() => void save()}>
              {t('attendance.save')}
            </button>
            <div className="compact-list">
              {detail.attendance.map((item) => (
                <span key={item.id}>
                  {t('attendance.session')} #{item.courseSessionId} / {t('courses.student')} #{item.studentId} /{' '}
                  {t(`attendance.${item.status}` as AdminTranslationKey)}
                  <button className="danger" onClick={() => void removeAttendance(item.id)}>
                    {t('common.delete')}
                  </button>
                </span>
              ))}
            </div>
            <hr />
            <label className="file-button">
              {t('attendance.selectCsv')}
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
            </label>
            <p className="admin-help">{t('attendance.columns')}</p>
          </>
        )}
      </div>
      {errors.length > 0 && (
        <section className="import-errors">
          <h2>{t('attendance.rejectedRows')}</h2>
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
