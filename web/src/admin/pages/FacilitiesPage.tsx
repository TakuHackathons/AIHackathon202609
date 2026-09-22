import { useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { PageHeading, remove, useSchoolData } from '../educationShared';
import { useAdminI18n, type AdminTranslationKey } from '../i18n';
import FacilityOperationsPanel from './FacilityOperationsPanel';
type Facility = { id: number; name: string; category: string; location: string; description: string; currentStatus?: { status: string } };
const blank = { name: '', category: '', location: '', description: '', manualStatus: '' };
export default function FacilitiesPage() {
  const { manager, run, setNotice } = useAdmin();
  const { t } = useAdminI18n();
  const data = useSchoolData<Facility>('facilities', 'facilities');
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [operationsId, setOperationsId] = useState(0);
  const save = () =>
    run(async () => {
      await adminApi(editingId ? 'facilities/' + editingId : 'facilities', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...form, schoolId: data.schoolId }),
      });
      setForm(blank);
      setEditingId(null);
      setNotice(t('facilities.saved'));
      await data.load();
    });
  const statusLabel = (status: string) => t(`facilities.${status}` as AdminTranslationKey);
  return (
    <section>
      <PageHeading kicker={t('kicker.facilities')} title={t('facilities.title')} description={t('facilities.description')} />
      {data.picker}
      {manager && (
        <form
          className="admin-card admin-form admin-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <input
            required
            placeholder={t('common.name')}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <input
            placeholder={t('facilities.category')}
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          />
          <input
            placeholder={t('facilities.location')}
            value={form.location}
            onChange={(event) => setForm({ ...form, location: event.target.value })}
          />
          <textarea
            placeholder={t('common.description')}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
          <select value={form.manualStatus} onChange={(event) => setForm({ ...form, manualStatus: event.target.value })}>
            <option value="">{t('facilities.automatic')}</option>
            <option value="open">{t('facilities.open')}</option>
            <option value="closed">{t('facilities.closed')}</option>
            <option value="restricted">{t('facilities.restricted')}</option>
          </select>
          <button className="admin-primary">{t('common.save')}</button>
        </form>
      )}
      <div className="admin-list">
        {data.rows.map((facility) => (
          <article className="admin-card" key={facility.id}>
            <div className="admin-record-heading">
              <h2>{facility.name}</h2>
              <span className={'status-badge ' + (facility.currentStatus?.status ?? 'closed')}>
                {statusLabel(facility.currentStatus?.status ?? 'closed')}
              </span>
            </div>
            <p>
              {facility.category} {facility.location}
            </p>
            <p>{facility.description}</p>
            {manager && (
              <div className="admin-actions">
                <button onClick={() => setOperationsId(facility.id)}>{t('facilities.hoursExceptions')}</button>
                <button
                  onClick={() => {
                    setEditingId(facility.id);
                    setForm({
                      ...blank,
                      name: facility.name,
                      category: facility.category,
                      location: facility.location,
                      description: facility.description,
                    });
                  }}
                >
                  {t('common.edit')}
                </button>
                <button
                  className="danger"
                  onClick={() => void run(() => remove('facilities/' + facility.id, data.load, t('common.confirmDelete')))}
                >
                  {t('common.delete')}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {manager && operationsId > 0 && <FacilityOperationsPanel facilityId={operationsId} />}
    </section>
  );
}
