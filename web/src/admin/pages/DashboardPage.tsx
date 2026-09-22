import { Link } from '@tanstack/react-router';
import { useAdmin } from '../AdminContext';
import { useAdminI18n } from '../i18n';
export default function DashboardPage() {
  const { me, schools, teachers, superAdmin } = useAdmin();
  const { t } = useAdminI18n();
  const visibleSchools = schools.filter((school) => superAdmin || school.id === me?.user.schoolId);
  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">{t('kicker.dashboard')}</p>
          <h1>{t('dashboard.title')}</h1>
          <p>{t('dashboard.description')}</p>
        </div>
      </div>
      <div className="admin-summary-grid">
        <Link className="admin-summary-card" to="/admin/schools">
          <span>{t('dashboard.schools')}</span>
          <strong>{visibleSchools.length}</strong>
          <small>{t('dashboard.schoolCount')}</small>
        </Link>
        <Link className="admin-summary-card" to="/admin/teachers">
          <span>{t('dashboard.teachers')}</span>
          <strong>{teachers.length}</strong>
          <small>{t('dashboard.teacherCount')}</small>
        </Link>
        <Link className="admin-summary-card" to="/admin/settings">
          <span>{t('dashboard.signedIn')}</span>
          <strong className="admin-summary-name">{me?.user.name}</strong>
          <small>{me ? t(`role.${me.user.role}`) : ''}</small>
        </Link>
      </div>
    </section>
  );
}
