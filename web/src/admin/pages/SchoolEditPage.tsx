import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { useAdminI18n } from '../i18n';
import type { School } from '../types';
export default function SchoolEditPage({ schoolId }: { schoolId: number }) {
  const { schools, manager, refresh, run, setNotice } = useAdmin();
  const { t } = useAdminI18n();
  const navigate = useNavigate(),
    school = schools.find((item) => item.id === schoolId);
  const [value, setValue] = useState<School | null>(school ?? null);
  useEffect(() => setValue(school ?? null), [school]);
  if (!manager) return <p className="admin-error">{t('common.permissionDenied')}</p>;
  if (!value) return <p className="admin-error">{t('common.notFound')}</p>;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await adminApi('schools/' + value.id, {
        method: 'PATCH',
        body: JSON.stringify({ name: value.name, code: value.code, address: value.address, phone: value.phone }),
      });
      await refresh();
      setNotice(t('schools.updated'));
      await navigate({ to: '/admin/schools' });
    });
  };
  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">{t('kicker.schools')}</p>
          <h1>{t('schools.editTitle')}</h1>
          <p>{school?.name}</p>
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
        </div>
        <button className="admin-primary">{t('common.save')}</button>
        <Link className="admin-secondary" to="/admin/schools">
          {t('common.cancel')}
        </Link>
      </form>
    </section>
  );
}
