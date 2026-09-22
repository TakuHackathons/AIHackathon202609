import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type Hour = { weekday: number; opensAt: string; closesAt: string };
type Exception = { id: number; date: string; status: string; opensAt: string | null; closesAt: string | null; note: string };
type Detail = { hours: Hour[]; exceptions: Exception[] };

export default function FacilityOperationsPanel({ facilityId }: { facilityId: number }) {
  const { run, setNotice } = useAdmin();
  const [hours, setHours] = useState(days.map((_, weekday) => ({ weekday, opensAt: '09:00', closesAt: '17:00', closed: true })));
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [form, setForm] = useState({ date: '', status: 'closed', opensAt: '', closesAt: '', note: '' });

  const load = async () => {
    const detail = (await adminApi('facilities/' + facilityId)) as Detail;
    setExceptions(detail.exceptions);
    setHours(
      days.map((_, weekday) => {
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
      setNotice('Business hours saved.');
      await load();
    });
  const addException = () =>
    run(async () => {
      await adminApi('facilities/' + facilityId + '/exceptions', { method: 'POST', body: JSON.stringify(form) });
      setForm({ date: '', status: 'closed', opensAt: '', closesAt: '', note: '' });
      setNotice('Business exception saved.');
      await load();
    });
  const deleteException = (id: number) =>
    run(async () => {
      await adminApi('facilities/' + facilityId + '/exceptions/' + id, { method: 'DELETE' });
      await load();
    });

  return (
    <section className="admin-card course-planning">
      <h2>Business hours</h2>
      <div className="business-hours-grid">
        {hours.map((hour, index) => (
          <div className="business-hour-row" key={hour.weekday}>
            <strong>{days[hour.weekday]}</strong>
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
              Open
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
        Save business hours
      </button>
      <hr />
      <h2>Date-specific exception</h2>
      <div className="admin-grid">
        <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
        <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="restricted">Restricted</option>
        </select>
        <input type="time" value={form.opensAt} onChange={(event) => setForm({ ...form, opensAt: event.target.value })} />
        <input type="time" value={form.closesAt} onChange={(event) => setForm({ ...form, closesAt: event.target.value })} />
        <input placeholder="Note" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
        <button disabled={!form.date} onClick={() => void addException()}>
          Add exception
        </button>
      </div>
      <div className="compact-list">
        {exceptions.map((item) => (
          <span key={item.id}>
            {item.date} / {item.status} {item.opensAt ?? ''}-{item.closesAt ?? ''} {item.note}
            <button className="danger" onClick={() => void deleteException(item.id)}>
              Delete
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}
