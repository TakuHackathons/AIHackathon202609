import { Link } from '@tanstack/react-router';
import { useAdmin } from '../AdminContext';

export default function SchoolsPage() {
  const { me, schools, manager, superAdmin } = useAdmin();
  const visibleSchools = schools.filter((school) => superAdmin || school.id === me?.user.schoolId);

  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">SCHOOLS</p>
          <h1>学校管理</h1>
          <p>登録されている学校の参照と管理を行います。</p>
        </div>
        {superAdmin && (
          <Link className="admin-primary" to="/admin/schools/new">
            学校を登録
          </Link>
        )}
      </div>
      <div className="admin-list">
        {visibleSchools.map((school) => (
          <article className="admin-card" key={school.id}>
            <h2>{school.name}</h2>
            <p>
              {school.code} · {school.address || '住所未登録'} · {school.phone || '電話未登録'}
            </p>
            <small>学校の削除は運用スクリプトのみで行えます。</small>
            {manager && (
              <Link className="admin-row-action" to="/admin/schools/edit" search={{ schoolId: school.id }}>
                学校情報を編集
              </Link>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
