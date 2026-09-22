import { useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';

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
  const [term, setTerm] = useState({ name: '', startsOn: '', endsOn: '' });
  const [period, setPeriod] = useState({ periodNumber: 1, name: '', startsAt: '', endsAt: '' });
  const addTerm = () =>
    run(async () => {
      await adminApi('academic-terms', { method: 'POST', body: JSON.stringify({ ...term, schoolId }) });
      setTerm({ name: '', startsOn: '', endsOn: '' });
      setNotice('Academic term saved.');
      await reload();
    });
  const addPeriod = () =>
    run(async () => {
      await adminApi('periods', { method: 'POST', body: JSON.stringify({ ...period, schoolId }) });
      setPeriod({ periodNumber: period.periodNumber + 1, name: '', startsAt: '', endsAt: '' });
      setNotice('Period saved.');
      await reload();
    });
  return (
    <details className="admin-card academic-setup">
      <summary>Academic terms and periods</summary>
      <div className="admin-grid academic-setup-grid">
        <form
          className="admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            void addTerm();
          }}
        >
          <h2>Add academic term</h2>
          <input required placeholder="Term name" value={term.name} onChange={(event) => setTerm({ ...term, name: event.target.value })} />
          <label>
            Start date
            <input required type="date" value={term.startsOn} onChange={(event) => setTerm({ ...term, startsOn: event.target.value })} />
          </label>
          <label>
            End date
            <input required type="date" value={term.endsOn} onChange={(event) => setTerm({ ...term, endsOn: event.target.value })} />
          </label>
          <button className="admin-primary">Add term</button>
          <div className="compact-list">
            {terms.map((item) => (
              <span key={item.id}>
                {item.name}: {item.startsOn} – {item.endsOn}
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
          <h2>Add period</h2>
          <input
            required
            min={1}
            type="number"
            placeholder="Period number"
            value={period.periodNumber}
            onChange={(event) => setPeriod({ ...period, periodNumber: Number(event.target.value) })}
          />
          <input placeholder="Period name" value={period.name} onChange={(event) => setPeriod({ ...period, name: event.target.value })} />
          <label>
            Start time
            <input
              required
              type="time"
              value={period.startsAt}
              onChange={(event) => setPeriod({ ...period, startsAt: event.target.value })}
            />
          </label>
          <label>
            End time
            <input required type="time" value={period.endsAt} onChange={(event) => setPeriod({ ...period, endsAt: event.target.value })} />
          </label>
          <button className="admin-primary">Add period</button>
          <div className="compact-list">
            {periods.map((item) => (
              <span key={item.id}>
                {item.periodNumber}. {item.name || 'Period'}: {item.startsAt} – {item.endsAt}
              </span>
            ))}
          </div>
        </form>
      </div>
    </details>
  );
}
