import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { useAdminI18n } from '../i18n';
import { TeacherForm } from '../TeacherForm';
import { emptyTeacher } from '../types';
export default function TeacherNewPage() {
  const { me, schools, manager, superAdmin, refresh, run, setNotice } = useAdmin();
  const { t } = useAdminI18n();
  const navigate = useNavigate();
  const [value, setValue] = useState(emptyTeacher);
  if (!manager) return <p className="admin-error">{t('common.permissionDenied')}</p>;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await adminApi('teachers', {
        method: 'POST',
        body: JSON.stringify({ ...value, schoolId: superAdmin ? value.schoolId : me?.user.schoolId }),
      });
      await refresh();
      setNotice(t('teachers.invited', { password: result.temporaryPassword }));
      await navigate({ to: '/admin/teachers' });
    });
  };
  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">{t('kicker.teachers')}</p>
          <h1>{t('teachers.newTitle')}</h1>
          <p>{t('teachers.newDescription')}</p>
        </div>
      </div>
      <form className="admin-card admin-form" onSubmit={submit}>
        <TeacherForm value={value} schools={schools} creating showSchool={superAdmin} onChange={setValue} />
        <button className="admin-primary">{t('teachers.createInvite')}</button>
        <Link className="admin-secondary" to="/admin/teachers">
          {t('common.cancel')}
        </Link>
      </form>
    </section>
  );
}
