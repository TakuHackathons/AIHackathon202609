import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { PageHeading, remove, useSchoolData } from '../educationShared';
import { useAdminI18n } from '../i18n';
import AcademicSetupPanel from './AcademicSetupPanel';
import CoursePlanningPanel from './CoursePlanningPanel';
import CourseRelatedDataPanel from './CourseRelatedDataPanel';
type Course = { id: number; code: string; name: string; description: string; academicTermId: number; teacherId?: number };
type Term = { id: number; name: string; startsOn: string; endsOn: string };
type Period = { id: number; periodNumber: number; name: string; startsAt: string; endsAt: string };
const blank = { code: '', name: '', description: '', academicTermId: 0, teacherId: 0 };
export default function CoursesPage() {
  const { teachers, manager, run, setNotice } = useAdmin();
  const { t } = useAdminI18n();
  const data = useSchoolData<Course>('courses', 'courses');
  const [selectedCourse, setSelectedCourse] = useState(0);
  const [terms, setTerms] = useState<Term[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<number | null>(null);
  const loadSettings = async () => {
    if (!data.schoolId) {
      setTerms([]);
      setPeriods([]);
      return;
    }
    const [termData, periodData] = await Promise.all([
      adminApi('academic-terms?schoolId=' + data.schoolId),
      adminApi('periods?schoolId=' + data.schoolId),
    ]);
    setTerms(termData.terms);
    setPeriods(periodData.periods);
  };
  useEffect(() => {
    void loadSettings();
  }, [data.schoolId]);
  const save = () =>
    run(async () => {
      await adminApi(editingId ? 'courses/' + editingId : 'courses', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...form, schoolId: data.schoolId }),
      });
      setForm(blank);
      setEditingId(null);
      setNotice(t('courses.saved'));
      await data.load();
    });
  return (
    <section>
      <PageHeading kicker={t('kicker.courses')} title={t('courses.title')} description={t('courses.description')} />
      {data.picker}
      {manager && data.schoolId > 0 && (
        <AcademicSetupPanel schoolId={data.schoolId} terms={terms} periods={periods} reload={loadSettings} />
      )}
      <form
        className="admin-card admin-form admin-inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <input
          required
          placeholder={t('courses.code')}
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value })}
        />
        <input
          required
          placeholder={t('courses.name')}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <select required value={form.academicTermId} onChange={(event) => setForm({ ...form, academicTermId: Number(event.target.value) })}>
          <option value={0}>{t('courses.term')}</option>
          {terms.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select required value={form.teacherId} onChange={(event) => setForm({ ...form, teacherId: Number(event.target.value) })}>
          <option value={0}>{t('courses.teacher')}</option>
          {teachers
            .filter((item) => item.schoolId === data.schoolId)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
        <textarea
          placeholder={t('common.description')}
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
        <button className="admin-primary">{t('common.save')}</button>
      </form>
      <div className="admin-list">
        {data.rows.map((course) => (
          <article className="admin-card" key={course.id}>
            <h2>
              {course.code} {course.name}
            </h2>
            <p>{course.description}</p>
            <div className="admin-actions">
              <button onClick={() => setSelectedCourse(course.id)}>{t('courses.schedule')}</button>
              <button
                onClick={() => {
                  setEditingId(course.id);
                  setForm({
                    code: course.code,
                    name: course.name,
                    description: course.description,
                    academicTermId: course.academicTermId,
                    teacherId: course.teacherId ?? 0,
                  });
                }}
              >
                {t('common.edit')}
              </button>
              {manager && (
                <button
                  className="danger"
                  onClick={() => void run(() => remove('courses/' + course.id, data.load, t('common.confirmDelete')))}
                >
                  {t('common.delete')}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {selectedCourse > 0 && (
        <>
          <CoursePlanningPanel courseId={selectedCourse} schoolId={data.schoolId} />
          <CourseRelatedDataPanel courseId={selectedCourse} schoolId={data.schoolId} />
        </>
      )}
    </section>
  );
}
