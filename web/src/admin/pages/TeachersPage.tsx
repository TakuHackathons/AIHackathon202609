import { Link } from '@tanstack/react-router';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { roleLabel } from '../types';

export default function TeachersPage() {
  const { teachers, manager, refresh, run, setNotice } = useAdmin();

  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">TEACHERS</p>
          <h1>教員管理</h1>
          <p>教員の所属情報と権限を管理します。</p>
        </div>
        {manager && (
          <Link className="admin-primary" to="/admin/teachers/new">
            教員を招待
          </Link>
        )}
      </div>
      <div className="admin-list">
        {teachers.map((teacher) => (
          <article className="admin-card teacher" key={teacher.id}>
            <div>
              <h2>
                {teacher.name} <small>{roleLabel[teacher.role]}</small>
              </h2>
              <p>@{teacher.username}</p>
            </div>
            {manager && teacher.role !== 'super_admin' && (
              <div className="admin-actions">
                <Link to="/admin/teachers/edit" search={{ teacherId: teacher.id }}>
                  編集
                </Link>
                <button
                  onClick={() =>
                    void run(async () => {
                      const result = await adminApi('teachers/' + teacher.id + '/reset-passkeys', { method: 'POST', body: '{}' });
                      setNotice(teacher.name + 'さんのPasskeyをリセットしました。パスワード: ' + result.temporaryPassword);
                    })
                  }
                >
                  Passkeyをリセット
                </button>
                <button
                  className="danger"
                  onClick={() =>
                    void run(async () => {
                      if (!confirm(teacher.name + 'さんを削除しますか？')) return;
                      await adminApi('teachers/' + teacher.id, { method: 'DELETE' });
                      await refresh();
                    })
                  }
                >
                  削除
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
