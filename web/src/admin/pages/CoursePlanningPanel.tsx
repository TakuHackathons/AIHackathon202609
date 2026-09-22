import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';

type Period = { id: number; periodNumber: number; name: string; startsAt: string; endsAt: string };
type Facility = { id: number; name: string };
type Detail = {
  schedules: Array<{ id: number; weekday: number; periodId: number; facilityId: number | null; validFrom: string; validTo: string }>;
  sessions: Array<{ id: number; sessionDate: string; startsAt: string; endsAt: string; status: string }>;
};

export default function CoursePlanningPanel({ courseId, schoolId }: { courseId: number; schoolId: number }) {
  const { run, setNotice } = useAdmin();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [schedule, setSchedule] = useState({ weekday: 1, periodId: 0, facilityId: 0, validFrom: '', validTo: '', locationNote: '' });
  const [session, setSession] = useState({ sessionDate: '', startsAt: '', endsAt: '', facilityId: 0, locationNote: '' });

  const load = async () => {
    const [course, periodData, facilityData] = await Promise.all([
      adminApi('courses/' + courseId),
      adminApi('periods?schoolId=' + schoolId),
      adminApi('facilities?schoolId=' + schoolId),
    ]);
    setDetail(course);
    setPeriods(periodData.periods);
    setFacilities(facilityData.facilities);
  };

  useEffect(() => {
    void load();
  }, [courseId, schoolId]);

  const addSchedule = () =>
    run(async () => {
      await adminApi('courses/' + courseId + '/schedules', {
        method: 'POST',
        body: JSON.stringify({ ...schedule, facilityId: schedule.facilityId || null }),
      });
      setNotice('Schedule saved.');
      await load();
    });

  const addSession = () =>
    run(async () => {
      await adminApi('courses/' + courseId + '/sessions', {
        method: 'POST',
        body: JSON.stringify({ ...session, facilityId: session.facilityId || null }),
      });
      setNotice('Course session saved.');
      await load();
    });

  return (
    <section className="admin-card course-planning">
      <h2>Schedule and course sessions</h2>
      <div className="admin-grid">
        <select value={schedule.weekday} onChange={(event) => setSchedule({ ...schedule, weekday: Number(event.target.value) })}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
            <option key={day} value={index}>
              {day}
            </option>
          ))}
        </select>
        <select required value={schedule.periodId} onChange={(event) => setSchedule({ ...schedule, periodId: Number(event.target.value) })}>
          <option value={0}>Period</option>
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.periodNumber} {period.name}
            </option>
          ))}
        </select>
        <select value={schedule.facilityId} onChange={(event) => setSchedule({ ...schedule, facilityId: Number(event.target.value) })}>
          <option value={0}>No facility</option>
          {facilities.map((facility) => (
            <option key={facility.id} value={facility.id}>
              {facility.name}
            </option>
          ))}
        </select>
        <input type="date" value={schedule.validFrom} onChange={(event) => setSchedule({ ...schedule, validFrom: event.target.value })} />
        <input type="date" value={schedule.validTo} onChange={(event) => setSchedule({ ...schedule, validTo: event.target.value })} />
        <button disabled={!schedule.periodId} onClick={() => void addSchedule()}>
          Add recurring schedule
        </button>
      </div>
      <div className="compact-list">
        {detail?.schedules.map((item) => (
          <span key={item.id}>
            weekday {item.weekday} / period {item.periodId} / {item.validFrom} - {item.validTo}
          </span>
        ))}
      </div>
      <hr />
      <div className="admin-grid">
        <input type="date" value={session.sessionDate} onChange={(event) => setSession({ ...session, sessionDate: event.target.value })} />
        <input type="time" value={session.startsAt} onChange={(event) => setSession({ ...session, startsAt: event.target.value })} />
        <input type="time" value={session.endsAt} onChange={(event) => setSession({ ...session, endsAt: event.target.value })} />
        <select value={session.facilityId} onChange={(event) => setSession({ ...session, facilityId: Number(event.target.value) })}>
          <option value={0}>No facility</option>
          {facilities.map((facility) => (
            <option key={facility.id} value={facility.id}>
              {facility.name}
            </option>
          ))}
        </select>
        <button disabled={!session.sessionDate || !session.startsAt || !session.endsAt} onClick={() => void addSession()}>
          Add course session
        </button>
      </div>
      <div className="compact-list">
        {detail?.sessions.map((item) => (
          <span key={item.id}>
            {item.sessionDate} {item.startsAt} - {item.endsAt} / {item.status}
          </span>
        ))}
      </div>
    </section>
  );
}
