import { useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { PageHeading, remove, useSchoolData } from '../educationShared';
import { useAdminI18n, type AdminTranslationKey } from '../i18n';
import CsvImportPanel from '../CsvImportPanel';
type Resource = { id: number; kind: string; title: string; category: string; body: string; externalUrl: string };
const blank = { kind: 'rule', title: '', category: '', body: '', externalUrl: '' };
export default function ResourcesPage() {
  const { manager, run, setNotice } = useAdmin();
  const { t } = useAdminI18n();
  const data = useSchoolData<Resource>('resources', 'resources');
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const save = () =>
    run(async () => {
      await adminApi(editingId ? 'resources/' + editingId : 'resources', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...form, schoolId: data.schoolId }),
      });
      setForm(blank);
      setEditingId(null);
      setNotice(t('resources.saved'));
      await data.load();
    });
  const search = () =>
    run(async () => {
      const result = await adminApi('resources/search?schoolId=' + data.schoolId + '&q=' + encodeURIComponent(query));
      data.setRows(result.resources);
    });
  const upload = (id: number, file: File) =>
    run(async () => {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/admin/resources/' + id + '/files', { method: 'POST', body, credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setNotice(t('resources.pdfUploaded'));
    });
  const kindLabel = (kind: string) => t(`resources.${kind}` as AdminTranslationKey);
  return (
    <section>
      <PageHeading kicker={t('kicker.resources')} title={t('resources.title')} description={t('resources.description')} />
      {data.picker}
      {manager && data.schoolId > 0 && (
        <CsvImportPanel
          endpoint="resources/import"
          schoolId={data.schoolId}
          columns="kind,title,category,body,external_url"
          template={
            'kind,title,category,body,external_url\nrule,Library Rules,library,Please return books by the due date,https://example.com/rules\n'
          }
          onImported={data.load}
        />
      )}
      <div className="admin-search">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('resources.searchPlaceholder')} />
        <button onClick={() => void search()}>{t('common.search')}</button>
        <button
          onClick={() => {
            setQuery('');
            void data.load();
          }}
        >
          {t('common.cancel')}
        </button>
      </div>
      {manager && (
        <form
          className="admin-card admin-form admin-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
            <option value="rule">{t('resources.rule')}</option>
            <option value="career">{t('resources.career')}</option>
            <option value="event">{t('resources.event')}</option>
            <option value="other">{t('resources.other')}</option>
          </select>
          <input
            required
            placeholder={t('common.title')}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <input
            placeholder={t('resources.category')}
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          />
          <textarea
            placeholder={t('resources.body')}
            value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })}
          />
          <input
            placeholder={t('common.externalUrl')}
            value={form.externalUrl}
            onChange={(event) => setForm({ ...form, externalUrl: event.target.value })}
          />
          <button className="admin-primary">{t('common.save')}</button>
        </form>
      )}
      <div className="admin-list">
        {data.rows.map((resource) => (
          <article className="admin-card" key={resource.id}>
            <small>
              {kindLabel(resource.kind)} / {resource.category}
            </small>
            <h2>{resource.title}</h2>
            <p>{resource.body}</p>
            {manager && (
              <>
                <label className="file-button">
                  {t('resources.uploadPdf')}
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void upload(resource.id, file);
                    }}
                  />
                </label>
                <div className="admin-actions">
                  <button
                    onClick={() => {
                      setEditingId(resource.id);
                      setForm({
                        kind: resource.kind,
                        title: resource.title,
                        category: resource.category,
                        body: resource.body,
                        externalUrl: resource.externalUrl,
                      });
                    }}
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    className="danger"
                    onClick={() => void run(() => remove('resources/' + resource.id, data.load, t('common.confirmDelete')))}
                  >
                    {t('common.delete')}
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
