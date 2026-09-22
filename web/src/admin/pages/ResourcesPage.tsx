import { useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { PageHeading, remove, useSchoolData } from '../educationShared';
type R = { id: number; kind: string; title: string; category: string; body: string; externalUrl: string };
const blank = { kind: 'rule', title: '', category: '', body: '', externalUrl: '' };
export default function ResourcesPage() {
  const { manager, run, setNotice } = useAdmin(),
    d = useSchoolData<R>('resources', 'resources');
  const [f, setF] = useState(blank),
    [edit, setEdit] = useState<number | null>(null),
    [q, setQ] = useState('');
  const save = () =>
    run(async () => {
      await adminApi(edit ? 'resources/' + edit : 'resources', {
        method: edit ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...f, schoolId: d.schoolId }),
      });
      setF(blank);
      setEdit(null);
      setNotice('Resource saved.');
      await d.load();
    });
  const search = () =>
    run(async () => {
      const x = await adminApi('resources/search?schoolId=' + d.schoolId + '&q=' + encodeURIComponent(q));
      d.setRows(x.resources);
    });
  const upload = (id: number, file: File) =>
    run(async () => {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/admin/resources/' + id + '/files', { method: 'POST', body, credentials: 'same-origin' }),
        x = await response.json();
      if (!response.ok) throw Error(x.error);
      setNotice('PDF uploaded and indexed.');
    });
  return (
    <section>
      <PageHeading kicker="RESOURCES" title="Rules, careers and events" description="Search titles, text and extracted PDF content." />
      {d.picker}
      <div className="admin-search">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search resources" />
        <button onClick={() => void search()}>Search</button>
        <button onClick={() => void d.load()}>Clear</button>
      </div>
      {manager && (
        <form
          className="admin-card admin-form admin-inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            <option value="rule">Rule</option>
            <option value="career">Career</option>
            <option value="event">Event</option>
            <option value="other">Other</option>
          </select>
          <input required placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <input placeholder="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          <textarea placeholder="Body" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          <input placeholder="External URL" value={f.externalUrl} onChange={(e) => setF({ ...f, externalUrl: e.target.value })} />
          <button className="admin-primary">Save</button>
        </form>
      )}
      <div className="admin-list">
        {d.rows.map((x) => (
          <article className="admin-card" key={x.id}>
            <small>
              {x.kind} / {x.category}
            </small>
            <h2>{x.title}</h2>
            <p>{x.body}</p>
            {manager && (
              <>
                <label className="file-button">
                  Upload PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void upload(x.id, file);
                    }}
                  />
                </label>
                <div className="admin-actions">
                  <button
                    onClick={() => {
                      setEdit(x.id);
                      setF({ kind: x.kind, title: x.title, category: x.category, body: x.body, externalUrl: x.externalUrl });
                    }}
                  >
                    Edit
                  </button>
                  <button className="danger" onClick={() => void run(() => remove('resources/' + x.id, d.load))}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
