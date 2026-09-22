import { useState } from 'react';
import { useAdmin } from './AdminContext';
import { useAdminI18n } from './i18n';

type Credential = { username: string; password: string };

export default function CsvImportPanel({
  endpoint,
  schoolId,
  columns,
  template,
  onImported,
}: {
  endpoint: string;
  schoolId: number;
  columns: string;
  template: string;
  onImported: () => Promise<void>;
}) {
  const { setError, setNotice } = useAdmin();
  const { t } = useAdminI18n();
  const [errors, setErrors] = useState<string[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const upload = async (file: File) => {
    setErrors([]);
    setCredentials([]);
    const body = new FormData();
    body.append('file', file);
    body.append('schoolId', String(schoolId));
    const response = await fetch('/api/admin/' + endpoint, { method: 'POST', body, credentials: 'same-origin' });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? t('common.operationFailed'));
      return;
    }
    setErrors(result.errors ?? []);
    setCredentials(result.credentials ?? []);
    setNotice(t('csv.imported', { count: result.imported }));
    await onImported();
  };
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = endpoint.replaceAll('/', '-') + '-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <details className="admin-card csv-import-panel">
      <summary>{t('csv.title')}</summary>
      <p>{t('csv.description')}</p>
      <code>{columns}</code>
      <div className="admin-actions">
        <button type="button" onClick={downloadTemplate}>
          {t('csv.downloadTemplate')}
        </button>
        <label className="file-button">
          {t('csv.select')}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={!schoolId}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = '';
            }}
          />
        </label>
      </div>
      {credentials.length > 0 && (
        <section className="csv-credentials">
          <h3>{t('csv.credentials')}</h3>
          {credentials.map((credential) => (
            <code key={credential.username}>
              {t('auth.username')}: {credential.username} / {t('auth.password')}: {credential.password}
            </code>
          ))}
        </section>
      )}
      {errors.length > 0 && (
        <section className="import-errors">
          <h3>{t('csv.rejected')}</h3>
          <ul>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </section>
      )}
    </details>
  );
}
