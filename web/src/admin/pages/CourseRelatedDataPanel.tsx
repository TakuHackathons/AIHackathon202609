import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { useAdminI18n, type AdminTranslationKey } from '../i18n';
type Detail = {
  enrollments: Array<{ id: number; studentId: number; status: string }>;
  assignments: Array<{ id: number; title: string; description: string; dueAt: number | null; externalUrl: string }>;
  exceptions: Array<{ id: number; date: string; kind: string; note: string }>;
};
type Student = { id: number; studentNumber: string };
const assignmentBlank = { title: '', description: '', dueAt: '', externalUrl: '' };
export default function CourseRelatedDataPanel({ courseId, schoolId }: { courseId: number; schoolId: number }) {
  const { run, setNotice } = useAdmin();
  const { t, locale } = useAdminI18n();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState(0);
  const [assignment, setAssignment] = useState(assignmentBlank);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [exception, setException] = useState({ date: '', kind: 'cancelled', startsAt: '', endsAt: '', note: '' });
  const load = async () => {
    const [course, studentData] = await Promise.all([adminApi('courses/' + courseId), adminApi('students?schoolId=' + schoolId)]);
    setDetail(course);
    setStudents(studentData.students);
  };
  useEffect(() => {
    void load();
  }, [courseId, schoolId]);
  const enroll = () =>
    run(async () => {
      await adminApi('courses/' + courseId + '/enrollments', { method: 'POST', body: JSON.stringify({ studentId }) });
      setNotice(t('courses.enrolled'));
      await load();
    });
  const saveAssignment = () =>
    run(async () => {
      await adminApi('courses/' + courseId + '/assignments' + (editingId ? '/' + editingId : ''), {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...assignment, dueAt: assignment.dueAt ? new Date(assignment.dueAt).getTime() : null }),
      });
      setAssignment(assignmentBlank);
      setEditingId(null);
      setNotice(t('courses.assignmentSaved'));
      await load();
    });
  const addException = () =>
    run(async () => {
      await adminApi('courses/' + courseId + '/exceptions', { method: 'POST', body: JSON.stringify(exception) });
      setException({ date: '', kind: 'cancelled', startsAt: '', endsAt: '', note: '' });
      setNotice(t('courses.exceptionSaved'));
      await load();
    });
  const removeItem = (path: string) =>
    run(async () => {
      await adminApi(path, { method: 'DELETE' });
      await load();
    });
  return (
    <section className="admin-card course-planning">
      <h2>{t('courses.related')}</h2>
      <h3>{t('courses.enrolledStudents')}</h3>
      <div className="admin-grid">
        <select value={studentId} onChange={(event) => setStudentId(Number(event.target.value))}>
          <option value={0}>{t('courses.student')}</option>
          {students.map((item) => (
            <option key={item.id} value={item.id}>
              {item.studentNumber}
            </option>
          ))}
        </select>
        <button disabled={!studentId} onClick={() => void enroll()}>
          {t('courses.enroll')}
        </button>
      </div>
      <div className="compact-list">
        {detail?.enrollments.map((item) => (
          <span key={item.id}>
            #{item.studentId} / {t(`status.${item.status}` as AdminTranslationKey)}
            <button className="danger" onClick={() => void removeItem('courses/' + courseId + '/enrollments/' + item.id)}>
              {t('common.remove')}
            </button>
          </span>
        ))}
      </div>
      <hr />
      <h3>{t('courses.assignments')}</h3>
      <div className="admin-grid">
        <input
          placeholder={t('common.title')}
          value={assignment.title}
          onChange={(event) => setAssignment({ ...assignment, title: event.target.value })}
        />
        <input
          aria-label={t('courses.dueAt')}
          type="datetime-local"
          value={assignment.dueAt}
          onChange={(event) => setAssignment({ ...assignment, dueAt: event.target.value })}
        />
        <input
          placeholder={t('common.externalUrl')}
          value={assignment.externalUrl}
          onChange={(event) => setAssignment({ ...assignment, externalUrl: event.target.value })}
        />
        <textarea
          placeholder={t('common.description')}
          value={assignment.description}
          onChange={(event) => setAssignment({ ...assignment, description: event.target.value })}
        />
        <button disabled={!assignment.title} onClick={() => void saveAssignment()}>
          {t('courses.saveAssignment')}
        </button>
      </div>
      <div className="compact-list">
        {detail?.assignments.map((item) => (
          <span key={item.id}>
            {item.title}{' '}
            {item.dueAt
              ? new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(item.dueAt)
              : ''}
            <button
              onClick={() => {
                setEditingId(item.id);
                setAssignment({
                  title: item.title,
                  description: item.description,
                  dueAt: item.dueAt ? new Date(item.dueAt).toISOString().slice(0, 16) : '',
                  externalUrl: item.externalUrl,
                });
              }}
            >
              {t('common.edit')}
            </button>
            <button className="danger" onClick={() => void removeItem('courses/' + courseId + '/assignments/' + item.id)}>
              {t('common.delete')}
            </button>
          </span>
        ))}
      </div>
      <hr />
      <h3>{t('courses.scheduleExceptions')}</h3>
      <div className="admin-grid">
        <input type="date" value={exception.date} onChange={(event) => setException({ ...exception, date: event.target.value })} />
        <select value={exception.kind} onChange={(event) => setException({ ...exception, kind: event.target.value })}>
          <option value="cancelled">{t('courses.cancelled')}</option>
          <option value="makeup">{t('courses.makeup')}</option>
          <option value="rescheduled">{t('courses.rescheduled')}</option>
          <option value="room_changed">{t('courses.roomChanged')}</option>
        </select>
        <input type="time" value={exception.startsAt} onChange={(event) => setException({ ...exception, startsAt: event.target.value })} />
        <input type="time" value={exception.endsAt} onChange={(event) => setException({ ...exception, endsAt: event.target.value })} />
        <input
          placeholder={t('common.note')}
          value={exception.note}
          onChange={(event) => setException({ ...exception, note: event.target.value })}
        />
        <button disabled={!exception.date} onClick={() => void addException()}>
          {t('courses.addScheduleException')}
        </button>
      </div>
      <div className="compact-list">
        {detail?.exceptions.map((item) => (
          <span key={item.id}>
            {item.date} / {t(`courses.${item.kind === 'room_changed' ? 'roomChanged' : item.kind}` as AdminTranslationKey)} / {item.note}
            <button className="danger" onClick={() => void removeItem('courses/' + courseId + '/exceptions/' + item.id)}>
              {t('common.delete')}
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}
