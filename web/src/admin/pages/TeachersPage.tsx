import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import CsvImportPanel from '../CsvImportPanel';
import IssuedPasswordPanel, { type IssuedPassword } from '../IssuedPasswordPanel';
import { useAdminI18n } from '../i18n';

export default function TeachersPage() {
  const { me, schools, teachers, manager, superAdmin, refresh, run, setNotice } = useAdmin();
  const { t } = useAdminI18n();
  const [schoolId, setSchoolId] = useState(me?.user.schoolId ?? schools[0]?.id ?? 0);
  const [issuedPassword, setIssuedPassword] = useState<(IssuedPassword & { teacherId: number }) | null>(null);

  const issueRegistrationPassword = (teacherId: number, teacherName: string) =>
    run(async () => {
      const result = await adminApi('teachers/' + teacherId + '/passkey-password', {
        method: 'POST',
        body: '{}',
      });
      setIssuedPassword({ teacherId, username: result.username, password: result.password, expiresAt: result.expiresAt });
      setNotice(t('teachers.passwordIssued', { name: teacherName }));
    });

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
        {teachers.map((teacher) => {
          const canManageAuthentication = manager && teacher.role !== 'super_admin' && teacher.id !== me?.user.id;
          return (
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
                  {canManageAuthentication && (
                    <>
                      <button onClick={() => void issueRegistrationPassword(teacher.id, teacher.name)}>
                        {t('teachers.issuePasskeyPassword')}
                      </button>
                      <button
                        onClick={() =>
                          void run(async () => {
                            const result = await adminApi('teachers/' + teacher.id + '/reset-passkeys', {
                              method: 'POST',
                              body: '{}',
                            });
                            setIssuedPassword({
                              teacherId: teacher.id,
                              username: result.username,
                              password: result.temporaryPassword,
                              expiresAt: result.expiresAt,
                            });
                            setNotice(t('teachers.resetDone', { name: teacher.name }));
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
                            if (issuedPassword?.teacherId === teacher.id) setIssuedPassword(null);
                            await refresh();
                          })
                        }
                      >
                        {t('common.delete')}
                      </button>
                    </>
                  )}
                </div>
              )}
              {issuedPassword?.teacherId === teacher.id && (
                <IssuedPasswordPanel issued={issuedPassword} onClose={() => setIssuedPassword(null)} />
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
