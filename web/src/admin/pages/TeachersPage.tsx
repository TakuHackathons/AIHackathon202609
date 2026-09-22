import { Link } from '@tanstack/react-router';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { useAdminI18n } from '../i18n';
export default function TeachersPage() {
  const { teachers, manager, refresh, run, setNotice } = useAdmin();
  const { t } = useAdminI18n();
  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">{t('kicker.teachers')}</p>
          <h1>{t('teachers.title')}</h1>
          <p>{t('teachers.description')}</p>
        </div>
        {manager && (
          <Link className="admin-primary" to="/admin/teachers/new">
            {t('teachers.invite')}
          </Link>
        )}
      </div>
      <div className="admin-list">
        {teachers.map((teacher) => (
          <article className="admin-card teacher" key={teacher.id}>
            <div>
              <h2>
                {teacher.name} <small>{t(`role.${teacher.role}`)}</small>
              </h2>
              <p>@{teacher.username}</p>
            </div>
            {manager && teacher.role !== 'super_admin' && (
              <div className="admin-actions">
                <Link to="/admin/teachers/edit" search={{ teacherId: teacher.id }}>
                  {t('common.edit')}
                </Link>
                <button
                  onClick={() =>
                    void run(async () => {
                      const result = await adminApi('teachers/' + teacher.id + '/reset-passkeys', { method: 'POST', body: '{}' });
                      setNotice(t('teachers.resetDone', { name: teacher.name, password: result.temporaryPassword }));
                    })
                  }
                >
                  {t('teachers.resetPasskey')}
                </button>
                <button
                  className="danger"
                  onClick={() =>
                    void run(async () => {
                      if (!confirm(t('teachers.confirmDelete', { name: teacher.name }))) return;
                      await adminApi('teachers/' + teacher.id, { method: 'DELETE' });
                      await refresh();
                    })
                  }
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
