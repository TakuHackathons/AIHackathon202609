import { Link, Outlet } from '@tanstack/react-router';
import { AdminAuth } from './AdminAuth';
import { AdminProvider, useAdmin } from './AdminContext';
import { AdminLocaleProvider, AdminLocaleSwitch, useAdminI18n, type AdminTranslationKey } from './i18n';
import './Admin.css';

const navigation = [
  { to: '/admin', label: 'nav.dashboard', exact: true },
  { to: '/admin/schools', label: 'nav.schools' },
  { to: '/admin/teachers', label: 'nav.teachers' },
  { to: '/admin/facilities', label: 'nav.facilities' },
  { to: '/admin/students', label: 'nav.students' },
  { to: '/admin/courses', label: 'nav.courses' },
  { to: '/admin/attendance', label: 'nav.attendance' },
  { to: '/admin/resources', label: 'nav.resources' },
  { to: '/admin/settings', label: 'nav.settings' },
] as const;

function AdminFrame() {
  const { me, loading, error, notice, logout, run } = useAdmin();
  const { t } = useAdminI18n();
  if (loading)
    return (
      <main className="admin-shell">
        <p className="admin-loading">{t('layout.loading')}</p>
      </main>
    );
  if (!me || me.enrollmentRequired) return <AdminAuth />;
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link to="/">
          <span>Empathy AI Companion</span>
          <small>{t('layout.teacherAdmin')}</small>
        </Link>
        <div>
          <span>
            {me.user.name} · {t(`role.${me.user.role}`)}
          </span>
          <AdminLocaleSwitch />
          <button onClick={() => void run(logout)}>{t('layout.logout')}</button>
        </div>
      </header>
      <div className="admin-layout">
        <nav className="admin-sidebar" aria-label={t('nav.title')}>
          <strong>{t('nav.title')}</strong>
          {navigation.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={'exact' in item ? { exact: item.exact } : undefined}
              activeProps={{ className: 'active' }}
            >
              {t(item.label as AdminTranslationKey)}
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
    <AdminLocaleProvider>
      <AdminProvider>
        <AdminFrame />
      </AdminProvider>
    </AdminLocaleProvider>
  );
}
