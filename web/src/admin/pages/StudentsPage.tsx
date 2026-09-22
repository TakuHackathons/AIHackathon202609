import { useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { PageHeading, remove, useSchoolData } from '../educationShared';
type Row = { id: number; studentNumber: string; personality: string; considerations: string; tags: string[] };
const blank = { studentNumber: '', personality: '', considerations: '', tags: '' };
export default function StudentsPage() {
  const { manager, run, setNotice } = useAdmin(),
    d = useSchoolData<Row>('students', 'students');
  const [f, setF] = useState(blank),
    [edit, setEdit] = useState<number | null>(null);
  const save = () =>
    run(async () => {
      await adminApi(edit ? 'students/' + edit : 'students', {
        method: edit ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...f,
          schoolId: d.schoolId,
          tags: f.tags
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
        }),
      });
      setF(blank);
      setEdit(null);
      setNotice('Student saved.');
      await d.load();
    });
  return (
    <section>
      <PageHeading kicker="STUDENTS" title="Students" description="Manage student number, personality, considerations and tags." />
      {d.picker}
      {manager && (
        <form
          className="admin-card admin-form admin-inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <input
            required
            placeholder="Student number"
            value={f.studentNumber}
            onChange={(e) => setF({ ...f, studentNumber: e.target.value })}
          />
          <textarea placeholder="Personality" value={f.personality} onChange={(e) => setF({ ...f, personality: e.target.value })} />
          <textarea
            placeholder="Considerations"
            value={f.considerations}
            onChange={(e) => setF({ ...f, considerations: e.target.value })}
          />
          <input placeholder="Tags separated by commas" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} />
          <button className="admin-primary">Save</button>
        </form>
      )}
      <div className="admin-list">
        {d.rows.map((x) => (
          <article className="admin-card" key={x.id}>
            <h2>{x.studentNumber}</h2>
            <p>{x.personality}</p>
            <p>{x.considerations}</p>
            <div className="tag-list">
              {x.tags?.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            {manager && (
              <div className="admin-actions">
                <button
                  onClick={() => {
                    setEdit(x.id);
                    setF({
                      studentNumber: x.studentNumber,
                      personality: x.personality,
                      considerations: x.considerations,
                      tags: (x.tags ?? []).join(', '),
                    });
                  }}
                >
                  Edit
                </button>
                <button className="danger" onClick={() => void run(() => remove('students/' + x.id, d.load))}>
                  Delete
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
