import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { PageHeading, remove, useSchoolData } from '../educationShared';
import AcademicSetupPanel from './AcademicSetupPanel';
import CoursePlanningPanel from './CoursePlanningPanel';
import CourseRelatedDataPanel from './CourseRelatedDataPanel';

type Course = { id: number; code: string; name: string; description: string; academicTermId: number; teacherId?: number };
type AcademicTerm = { id: number; name: string; startsOn: string; endsOn: string };
type Period = { id: number; periodNumber: number; name: string; startsAt: string; endsAt: string };
const blank = { code: '', name: '', description: '', academicTermId: 0, teacherId: 0 };

export default function CoursesPage() {
  const { teachers, manager, run, setNotice } = useAdmin();
  const data = useSchoolData<Course>('courses', 'courses');
  const [selectedCourse, setSelectedCourse] = useState(0);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
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
      setNotice('Course saved.');
      await data.load();
    });

  return (
    <section>
      <PageHeading kicker="COURSES" title="Courses and schedules" description="Manage courses by academic term and assigned teacher." />
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
        <input required placeholder="Course code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <input required placeholder="Course name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <select required value={form.academicTermId} onChange={(event) => setForm({ ...form, academicTermId: Number(event.target.value) })}>
          <option value={0}>Academic term</option>
          {terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </select>
        <select required value={form.teacherId} onChange={(event) => setForm({ ...form, teacherId: Number(event.target.value) })}>
          <option value={0}>Teacher</option>
          {teachers
            .filter((teacher) => teacher.schoolId === data.schoolId)
            .map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
        </select>
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
        <button className="admin-primary">Save</button>
      </form>
      <div className="admin-list">
        {data.rows.map((course) => (
          <article className="admin-card" key={course.id}>
            <h2>
              {course.code} {course.name}
            </h2>
            <p>{course.description}</p>
            <div className="admin-actions">
              <button onClick={() => setSelectedCourse(course.id)}>Schedule</button>
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
                Edit
              </button>
              {manager && (
                <button className="danger" onClick={() => void run(() => remove('courses/' + course.id, data.load))}>
                  Delete
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
