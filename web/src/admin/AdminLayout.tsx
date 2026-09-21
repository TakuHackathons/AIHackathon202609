import { Link, Outlet } from '@tanstack/react-router';
import { AdminAuth } from './AdminAuth';
import { AdminProvider, useAdmin } from './AdminContext';
import { roleLabel } from './types';
import './Admin.css';

function AdminFrame() {
  const { me, loading, error, notice, logout, run } = useAdmin();

  if (loading)
    return (
      <main className="admin-shell">
        <p className="admin-loading">管理画面を準備しています…</p>
      </main>
    );
  if (!me || me.enrollmentRequired) return <AdminAuth />;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link to="/">
          <span>よりそいAI相談室</span>
          <small>教員管理</small>
        </Link>
        <div>
          <span>
            {me.user.name} · {roleLabel[me.user.role]}
          </span>
          <button onClick={() => void run(logout)}>ログアウト</button>
        </div>
      </header>
      <div className="admin-layout">
        <nav className="admin-sidebar" aria-label="管理メニュー">
          <strong>管理メニュー</strong>
          <Link to="/admin" activeOptions={{ exact: true }} activeProps={{ className: 'active' }}>
            概要
          </Link>
          <Link to="/admin/schools" activeProps={{ className: 'active' }}>
            学校管理
          </Link>
          <Link to="/admin/teachers" activeProps={{ className: 'active' }}>
            教員管理
          </Link>
          <Link to="/admin/settings" activeProps={{ className: 'active' }}>
            アカウント設定
          </Link>
        </nav>
        <div className="admin-content">
          {(error || notice) && <p className={error ? 'admin-error' : 'admin-notice'}>{error || notice}</p>}
          <Outlet />
        </div>
      </div>
    </main>
  );
}

export default function AdminLayout() {
  return (
    <AdminProvider>
      <AdminFrame />
    </AdminProvider>
  );
}
