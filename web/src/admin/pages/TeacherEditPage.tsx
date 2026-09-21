import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { TeacherForm } from '../TeacherForm';
import { emptyTeacher, type TeacherFormValue } from '../types';

export default function TeacherEditPage({ teacherId }: { teacherId: number }) {
  const { teachers, schools, manager, refresh, run, setNotice } = useAdmin();
  const navigate = useNavigate();
  const teacher = teachers.find((item) => item.id === teacherId);
  const [value, setValue] = useState<TeacherFormValue>(emptyTeacher);

  useEffect(() => {
    if (!teacher) return;
    setValue({
      name: teacher.name,
      username: teacher.username,
      email: teacher.email,
      department: teacher.department,
      subjects: teacher.subjects,
      responsibilities: teacher.responsibilities,
      role: teacher.role,
      schoolId: teacher.schoolId ?? 0,
    });
  }, [teacher]);

  if (!manager) return <p className="admin-error">この操作を行う権限がありません。</p>;
  if (!teacher) return <p className="admin-error">教員が見つかりません。</p>;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await adminApi('teachers/' + teacher.id, { method: 'PATCH', body: JSON.stringify(value) });
      await refresh();
      setNotice('教員情報を更新しました。');
      await navigate({ to: '/admin/teachers' });
    });
  };

  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">TEACHERS</p>
          <h1>教員情報を編集</h1>
          <p>{teacher.name}</p>
        </div>
      </div>
      <form className="admin-card admin-form" onSubmit={submit}>
        <TeacherForm value={value} schools={schools} creating={false} showSchool={false} onChange={setValue} />
        <button className="admin-primary">保存</button>
        <Link className="admin-secondary" to="/admin/teachers">
          キャンセル
        </Link>
      </form>
    </section>
  );
}
