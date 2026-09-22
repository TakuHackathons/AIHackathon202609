import { useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { useAdminI18n } from '../i18n';
type AcademicTerm = { id: number; name: string; startsOn: string; endsOn: string };
type Period = { id: number; periodNumber: number; name: string; startsAt: string; endsAt: string };
export default function AcademicSetupPanel({
  schoolId,
  terms,
  periods,
  reload,
}: {
  schoolId: number;
  terms: AcademicTerm[];
  periods: Period[];
  reload: () => Promise<void>;
}) {
  const { run, setNotice } = useAdmin();
  const { t } = useAdminI18n();
  const [term, setTerm] = useState({ name: '', startsOn: '', endsOn: '' });
  const [period, setPeriod] = useState({ periodNumber: 1, name: '', startsAt: '', endsAt: '' });
  const addTerm = () =>
    run(async () => {
      await adminApi('academic-terms', { method: 'POST', body: JSON.stringify({ ...term, schoolId }) });
      setTerm({ name: '', startsOn: '', endsOn: '' });
      setNotice(t('courses.termSaved'));
      await reload();
    });
  const addPeriod = () =>
    run(async () => {
      await adminApi('periods', { method: 'POST', body: JSON.stringify({ ...period, schoolId }) });
      setPeriod({ periodNumber: period.periodNumber + 1, name: '', startsAt: '', endsAt: '' });
      setNotice(t('courses.periodSaved'));
      await reload();
    });
  return (
    <details className="admin-card academic-setup">
      <summary>{t('courses.academicSetup')}</summary>
      <div className="admin-grid academic-setup-grid">
        <form
          className="admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            void addTerm();
          }}
        >
          <h2>{t('courses.addTerm')}</h2>
          <input
            required
            placeholder={t('courses.termName')}
            value={term.name}
            onChange={(event) => setTerm({ ...term, name: event.target.value })}
          />
          <label>
            {t('courses.startDate')}
            <input required type="date" value={term.startsOn} onChange={(event) => setTerm({ ...term, startsOn: event.target.value })} />
          </label>
          <label>
            {t('courses.endDate')}
            <input required type="date" value={term.endsOn} onChange={(event) => setTerm({ ...term, endsOn: event.target.value })} />
          </label>
          <button className="admin-primary">{t('courses.addTerm')}</button>
          <div className="compact-list">
            {terms.map((item) => (
              <span key={item.id}>
                {item.name}: {item.startsOn} - {item.endsOn}
              </span>
            ))}
          </div>
        </form>
        <form
          className="admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            void addPeriod();
          }}
        >
          <h2>{t('courses.addPeriod')}</h2>
          <input
            required
            min={1}
            type="number"
            placeholder={t('courses.periodNumber')}
            value={period.periodNumber}
            onChange={(event) => setPeriod({ ...period, periodNumber: Number(event.target.value) })}
          />
          <input
            placeholder={t('courses.periodName')}
            value={period.name}
            onChange={(event) => setPeriod({ ...period, name: event.target.value })}
          />
          <label>
            {t('courses.startTime')}
            <input
              required
              type="time"
              value={period.startsAt}
              onChange={(event) => setPeriod({ ...period, startsAt: event.target.value })}
            />
          </label>
          <label>
            {t('courses.endTime')}
            <input required type="time" value={period.endsAt} onChange={(event) => setPeriod({ ...period, endsAt: event.target.value })} />
          </label>
          <button className="admin-primary">{t('courses.addPeriod')}</button>
          <div className="compact-list">
            {periods.map((item) => (
              <span key={item.id}>
                {item.periodNumber}. {item.name || t('courses.periodName')}: {item.startsAt} - {item.endsAt}
              </span>
            ))}
          </div>
        </form>
      </div>
    </details>
  );
}
