import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { useAdminI18n, type AdminTranslationKey } from '../i18n';
type Hour = { weekday: number; opensAt: string; closesAt: string };
type Exception = { id: number; date: string; status: string; opensAt: string | null; closesAt: string | null; note: string };
type Detail = { hours: Hour[]; exceptions: Exception[] };
export default function FacilityOperationsPanel({ facilityId }: { facilityId: number }) {
  const { run, setNotice } = useAdmin();
  const { t } = useAdminI18n();
  const [hours, setHours] = useState(
    Array.from({ length: 7 }, (_, weekday) => ({ weekday, opensAt: '09:00', closesAt: '17:00', closed: true })),
  );
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [form, setForm] = useState({ date: '', status: 'closed', opensAt: '', closesAt: '', note: '' });
  const load = async () => {
    const detail = (await adminApi('facilities/' + facilityId)) as Detail;
    setExceptions(detail.exceptions);
    setHours(
      Array.from({ length: 7 }, (_, weekday) => {
        const value = detail.hours.find((item) => item.weekday === weekday);
        return { weekday, opensAt: value?.opensAt ?? '09:00', closesAt: value?.closesAt ?? '17:00', closed: !value };
      }),
    );
  };
  useEffect(() => {
    void load();
  }, [facilityId]);
  const saveHours = () =>
    run(async () => {
      await adminApi('facilities/' + facilityId + '/hours', { method: 'PUT', body: JSON.stringify({ hours }) });
      setNotice(t('facilities.hoursSaved'));
      await load();
    });
  const addException = () =>
    run(async () => {
      await adminApi('facilities/' + facilityId + '/exceptions', { method: 'POST', body: JSON.stringify(form) });
      setForm({ date: '', status: 'closed', opensAt: '', closesAt: '', note: '' });
      setNotice(t('facilities.exceptionSaved'));
      await load();
    });
  const deleteException = (id: number) =>
    run(async () => {
      await adminApi('facilities/' + facilityId + '/exceptions/' + id, { method: 'DELETE' });
      await load();
    });
  return (
    <section className="admin-card course-planning">
      <h2>{t('facilities.businessHours')}</h2>
      <div className="business-hours-grid">
        {hours.map((hour, index) => (
          <div className="business-hour-row" key={hour.weekday}>
            <strong>{t(`weekday.${hour.weekday}` as AdminTranslationKey)}</strong>
            <label>
              <input
                type="checkbox"
                checked={!hour.closed}
                onChange={(event) => {
                  const next = [...hours];
                  next[index] = { ...hour, closed: !event.target.checked };
                  setHours(next);
                }}
              />{' '}
              {t('facilities.openDay')}
            </label>
            <input
              type="time"
              disabled={hour.closed}
              value={hour.opensAt}
              onChange={(event) => {
                const next = [...hours];
                next[index] = { ...hour, opensAt: event.target.value };
                setHours(next);
              }}
            />
            <input
              type="time"
              disabled={hour.closed}
              value={hour.closesAt}
              onChange={(event) => {
                const next = [...hours];
                next[index] = { ...hour, closesAt: event.target.value };
                setHours(next);
              }}
            />
          </div>
        ))}
      </div>
      <button className="admin-primary" onClick={() => void saveHours()}>
        {t('facilities.saveHours')}
      </button>
      <hr />
      <h2>{t('facilities.dateException')}</h2>
      <div className="admin-grid">
        <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
        <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
          <option value="open">{t('facilities.open')}</option>
          <option value="closed">{t('facilities.closed')}</option>
          <option value="restricted">{t('facilities.restricted')}</option>
        </select>
        <input type="time" value={form.opensAt} onChange={(event) => setForm({ ...form, opensAt: event.target.value })} />
        <input type="time" value={form.closesAt} onChange={(event) => setForm({ ...form, closesAt: event.target.value })} />
        <input placeholder={t('common.note')} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
        <button disabled={!form.date} onClick={() => void addException()}>
          {t('facilities.addException')}
        </button>
      </div>
      <div className="compact-list">
        {exceptions.map((item) => (
          <span key={item.id}>
            {item.date} / {t(`facilities.${item.status}` as AdminTranslationKey)} {item.opensAt ?? ''}-{item.closesAt ?? ''} {item.note}
            <button className="danger" onClick={() => void deleteException(item.id)}>
              {t('common.delete')}
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}
