import { Link } from '@tanstack/react-router';
import { useAdmin } from '../AdminContext';
import { roleLabel } from '../types';

export default function DashboardPage() {
  const { me, schools, teachers, superAdmin } = useAdmin();
  const visibleSchools = schools.filter((school) => superAdmin || school.id === me?.user.schoolId);

  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">DASHBOARD</p>
          <h1>概要</h1>
          <p>学校と教員の登録状況を確認できます。</p>
        </div>
      </div>
      <div className="admin-summary-grid">
        <Link className="admin-summary-card" to="/admin/schools">
          <span>学校</span>
          <strong>{visibleSchools.length}</strong>
          <small>登録されている学校</small>
        </Link>
        <Link className="admin-summary-card" to="/admin/teachers">
          <span>教員</span>
          <strong>{teachers.length}</strong>
          <small>登録されている教員</small>
        </Link>
        <Link className="admin-summary-card" to="/admin/settings">
          <span>ログイン中</span>
          <strong className="admin-summary-name">{me?.user.name}</strong>
          <small>{me ? roleLabel[me.user.role] : ''}</small>
        </Link>
      </div>
    </section>
  );
}
