import { Link } from '@tanstack/react-router';
import { useAdmin } from '../AdminContext';
import { useAdminI18n } from '../i18n';
export default function SchoolsPage() {
  const { me, schools, manager, superAdmin } = useAdmin();
  const { t } = useAdminI18n();
  const visibleSchools = schools.filter((school) => superAdmin || school.id === me?.user.schoolId);
  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">{t('kicker.schools')}</p>
          <h1>{t('schools.title')}</h1>
          <p>{t('schools.description')}</p>
        </div>
        {superAdmin && (
          <Link className="admin-primary" to="/admin/schools/new">
            {t('schools.add')}
          </Link>
        )}
      </div>
      <div className="admin-list">
        {visibleSchools.map((school) => (
          <article className="admin-card" key={school.id}>
            <h2>{school.name}</h2>
            <p className="school-code">
              {t('schools.code')}: <code>{school.code}</code>
              <button type="button" onClick={() => void navigator.clipboard.writeText(school.code)}>
                {t('common.copy')}
              </button>
            </p>
            <p>
              {school.address || t('schools.addressMissing')} · {school.phone || t('schools.phoneMissing')}
            </p>
            <small>{t('schools.codeHelp')}</small>
            {manager && (
              <Link className="admin-row-action" to="/admin/schools/edit" search={{ schoolId: school.id }}>
                {t('schools.edit')}
              </Link>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
