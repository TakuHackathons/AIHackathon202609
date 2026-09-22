import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { useAdminI18n } from '../i18n';
import { TeacherForm } from '../TeacherForm';
import { emptyTeacher, type TeacherFormValue } from '../types';
export default function TeacherEditPage({ teacherId }: { teacherId: number }) {
  const { teachers, schools, manager, refresh, run, setNotice } = useAdmin();
  const { t } = useAdminI18n();
  const navigate = useNavigate(),
    teacher = teachers.find((item) => item.id === teacherId);
  const [value, setValue] = useState<TeacherFormValue>(emptyTeacher);
  useEffect(() => {
    if (teacher)
      setValue({
        name: teacher.name,
        username: teacher.username,
        email: teacher.email,
        role: teacher.role,
        schoolId: teacher.schoolId ?? 0,
      });
  }, [teacher]);
  if (!manager) return <p className="admin-error">{t('common.permissionDenied')}</p>;
  if (!teacher) return <p className="admin-error">{t('common.notFound')}</p>;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await adminApi('teachers/' + teacher.id, { method: 'PATCH', body: JSON.stringify(value) });
      await refresh();
      setNotice(t('teachers.updated'));
      await navigate({ to: '/admin/teachers' });
    });
  };
  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">{t('kicker.teachers')}</p>
          <h1>{t('teachers.editTitle')}</h1>
          <p>{teacher.name}</p>
        </div>
      </div>
      <form className="admin-card admin-form" onSubmit={submit}>
        <TeacherForm value={value} schools={schools} creating={false} showSchool={false} onChange={setValue} />
        <button className="admin-primary">{t('common.save')}</button>
        <Link className="admin-secondary" to="/admin/teachers">
          {t('common.cancel')}
        </Link>
      </form>
    </section>
  );
}
