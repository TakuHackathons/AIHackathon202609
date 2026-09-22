import { Link, Outlet } from '@tanstack/react-router';
import { AdminAuth } from './AdminAuth';
import { AdminProvider, useAdmin } from './AdminContext';
import { roleLabel } from './types';
import './Admin.css';

const navigation = [
  { to: '/admin', label: '概要', exact: true },
  { to: '/admin/schools', label: '学校管理' },
  { to: '/admin/teachers', label: '教員管理' },
  { to: '/admin/facilities', label: '施設' },
  { to: '/admin/students', label: '学生' },
  { to: '/admin/courses', label: '授業・時間割' },
  { to: '/admin/attendance', label: '出欠・CSV取込' },
  { to: '/admin/resources', label: '資料' },
  { to: '/admin/settings', label: 'アカウント設定' },
] as const;

function AdminFrame() {
  const { me, loading, error, notice, logout, run } = useAdmin();

  if (loading) {
    return (
      <main className="admin-shell">
        <p className="admin-loading">管理画面を準備しています…</p>
      </main>
    );
  }
  if (!me || me.enrollmentRequired) return <AdminAuth />;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link to="/">
          <span>Empathy AI Companion</span>
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
          {navigation.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={'exact' in item ? { exact: item.exact } : undefined}
              activeProps={{ className: 'active' }}
            >
              {item.label}
            </Link>
          ))}
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
