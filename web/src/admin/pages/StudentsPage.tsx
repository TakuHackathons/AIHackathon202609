import { useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { PageHeading, remove, useSchoolData } from '../educationShared';
import { useAdminI18n } from '../i18n';
import CsvImportPanel from '../CsvImportPanel';
type Student = { id: number; studentNumber: string; personality: string; considerations: string; tags: string[] };
const blank = { studentNumber: '', personality: '', considerations: '', tags: '' };
export default function StudentsPage() {
  const { manager, run, setNotice } = useAdmin();
  const { t } = useAdminI18n();
  const data = useSchoolData<Student>('students', 'students');
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<number | null>(null);
  const save = () =>
    run(async () => {
      await adminApi(editingId ? 'students/' + editingId : 'students', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...form,
          schoolId: data.schoolId,
          tags: form.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      setForm(blank);
      setEditingId(null);
      setNotice(t('students.saved'));
      await data.load();
    });
  return (
    <section>
      <PageHeading kicker={t('kicker.students')} title={t('students.title')} description={t('students.description')} />
      {data.picker}
      {manager && data.schoolId > 0 && (
        <CsvImportPanel
          endpoint="students/import"
          schoolId={data.schoolId}
          columns="student_number,personality,considerations,tags"
          template={'student_number,personality,considerations,tags\nS0001,Calm,Needs quiet explanations,careful|visual learner\n'}
          onImported={data.load}
        />
      )}
      {manager && (
        <form
          className="admin-card admin-form admin-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <input
            required
            placeholder={t('students.number')}
            value={form.studentNumber}
            onChange={(event) => setForm({ ...form, studentNumber: event.target.value })}
          />
          <textarea
            placeholder={t('students.personality')}
            value={form.personality}
            onChange={(event) => setForm({ ...form, personality: event.target.value })}
          />
          <textarea
            placeholder={t('students.considerations')}
            value={form.considerations}
            onChange={(event) => setForm({ ...form, considerations: event.target.value })}
          />
          <input placeholder={t('students.tags')} value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
          <button className="admin-primary">{t('common.save')}</button>
        </form>
      )}
      <div className="admin-list">
        {data.rows.map((student) => (
          <article className="admin-card" key={student.id}>
            <h2>{student.studentNumber}</h2>
            <p>{student.personality}</p>
            <p>{student.considerations}</p>
            <div className="tag-list">
              {student.tags?.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            {manager && (
              <div className="admin-actions">
                <button
                  onClick={() => {
                    setEditingId(student.id);
                    setForm({
                      studentNumber: student.studentNumber,
                      personality: student.personality,
                      considerations: student.considerations,
                      tags: (student.tags ?? []).join(', '),
                    });
                  }}
                >
                  {t('common.edit')}
                </button>
                <button
                  className="danger"
                  onClick={() => void run(() => remove('students/' + student.id, data.load, t('common.confirmDelete')))}
                >
                  {t('common.delete')}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
