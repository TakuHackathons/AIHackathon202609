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
          <p>登録済みの学校と、一般利用画面で入力する学校コードを確認できます。</p>
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
            <p className="school-code">
              学校コード: <code>{school.code}</code>
              <button type="button" onClick={() => void navigator.clipboard.writeText(school.code)}>
                コピー
              </button>
            </p>
            <p>
              {school.address || '住所未登録'} ・ {school.phone || '電話番号未登録'}
            </p>
            <small>この学校コードを一般利用画面で入力します。</small>
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
