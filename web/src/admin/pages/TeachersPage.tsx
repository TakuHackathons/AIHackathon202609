import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { useAdminI18n } from '../i18n';
import CsvImportPanel from '../CsvImportPanel';
export default function TeachersPage() {
  const { me, schools, teachers, manager, superAdmin, refresh, run, setNotice } = useAdmin();
  const { t } = useAdminI18n();
  const [schoolId, setSchoolId] = useState(me?.user.schoolId ?? schools[0]?.id ?? 0);
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
      {manager && (
        <>
          {superAdmin && (
            <label className="admin-school-picker">
              {t('common.school')}
              <select value={schoolId} onChange={(event) => setSchoolId(Number(event.target.value))}>
                <option value={0}>{t('common.selectSchool')}</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <CsvImportPanel
            endpoint="teachers/import"
            schoolId={schoolId}
            columns="username,name,email,role"
            template={'username,name,email,role\nteacher-001,Teacher Name,teacher@example.com,general\n'}
            onImported={refresh}
          />
        </>
      )}
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
