import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { useAdminI18n } from '../i18n';
const initialValue = { name: '', code: '', address: '', phone: '', adminName: '', username: '' };
export default function SchoolNewPage() {
  const { refresh, run, setNotice, superAdmin } = useAdmin();
  const { t } = useAdminI18n();
  const navigate = useNavigate();
  const [value, setValue] = useState(initialValue);
  if (!superAdmin) return <p className="admin-error">{t('common.permissionDenied')}</p>;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await adminApi('schools', { method: 'POST', body: JSON.stringify(value) });
      await refresh();
      setNotice(t('schools.created', { password: result.temporaryPassword }));
      await navigate({ to: '/admin/schools' });
    });
  };
  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">{t('kicker.schools')}</p>
          <h1>{t('schools.newTitle')}</h1>
          <p>{t('schools.newDescription')}</p>
        </div>
      </div>
      <form className="admin-card admin-form" onSubmit={submit}>
        <div className="admin-grid">
          <input
            required
            placeholder={t('schools.name')}
            value={value.name}
            onChange={(event) => setValue({ ...value, name: event.target.value })}
          />
          <input
            required
            placeholder={t('schools.code')}
            value={value.code}
            onChange={(event) => setValue({ ...value, code: event.target.value })}
          />
          <input
            placeholder={t('schools.address')}
            value={value.address}
            onChange={(event) => setValue({ ...value, address: event.target.value })}
          />
          <input
            placeholder={t('schools.phone')}
            value={value.phone}
            onChange={(event) => setValue({ ...value, phone: event.target.value })}
          />
          <input
            required
            placeholder={t('schools.adminName')}
            value={value.adminName}
            onChange={(event) => setValue({ ...value, adminName: event.target.value })}
          />
          <input
            required
            placeholder={t('schools.adminUsername')}
            value={value.username}
            onChange={(event) => setValue({ ...value, username: event.target.value })}
          />
        </div>
        <button className="admin-primary">{t('common.add')}</button>
        <Link className="admin-secondary" to="/admin/schools">
          {t('common.cancel')}
        </Link>
      </form>
    </section>
  );
}
