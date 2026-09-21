import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { TeacherForm } from '../TeacherForm';
import { emptyTeacher } from '../types';

export default function TeacherNewPage() {
  const { me, schools, manager, superAdmin, refresh, run, setNotice } = useAdmin();
  const navigate = useNavigate();
  const [value, setValue] = useState(emptyTeacher);

  if (!manager) return <p className="admin-error">この操作を行う権限がありません。</p>;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await adminApi('teachers', {
        method: 'POST',
        body: JSON.stringify({ ...value, schoolId: superAdmin ? value.schoolId : me?.user.schoolId }),
      });
      await refresh();
      setNotice('教員を招待しました。パスワード: ' + result.temporaryPassword);
      await navigate({ to: '/admin/teachers' });
    });
  };

  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">TEACHERS</p>
          <h1>教員を招待</h1>
          <p>教員情報と管理権限を設定します。</p>
        </div>
      </div>
      <form className="admin-card admin-form" onSubmit={submit}>
        <TeacherForm value={value} schools={schools} creating showSchool={superAdmin} onChange={setValue} />
        <button className="admin-primary">招待を作成</button>
        <Link className="admin-secondary" to="/admin/teachers">
          キャンセル
        </Link>
      </form>
    </section>
  );
}
