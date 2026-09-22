import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { useAdminI18n, type AdminTranslationKey } from '../i18n';
type Period = { id: number; periodNumber: number; name: string };
type Facility = { id: number; name: string };
type Detail = {
  schedules: Array<{ id: number; weekday: number; periodId: number; validFrom: string; validTo: string }>;
  sessions: Array<{ id: number; sessionDate: string; startsAt: string; endsAt: string; status: string }>;
};
export default function CoursePlanningPanel({ courseId, schoolId }: { courseId: number; schoolId: number }) {
  const { run, setNotice } = useAdmin();
  const { t } = useAdminI18n();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [schedule, setSchedule] = useState({ weekday: 1, periodId: 0, facilityId: 0, validFrom: '', validTo: '', locationNote: '' });
  const [session, setSession] = useState({ sessionDate: '', startsAt: '', endsAt: '', facilityId: 0, locationNote: '' });
  const load = async () => {
    const [course, p, f] = await Promise.all([
      adminApi('courses/' + courseId),
      adminApi('periods?schoolId=' + schoolId),
      adminApi('facilities?schoolId=' + schoolId),
    ]);
    setDetail(course);
    setPeriods(p.periods);
    setFacilities(f.facilities);
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
      setNotice(t('courses.scheduleSaved'));
      await load();
    });
  const addSession = () =>
    run(async () => {
      await adminApi('courses/' + courseId + '/sessions', {
        method: 'POST',
        body: JSON.stringify({ ...session, facilityId: session.facilityId || null }),
      });
      setNotice(t('courses.sessionSaved'));
      await load();
    });
  return (
    <section className="admin-card course-planning">
      <h2>{t('courses.planning')}</h2>
      <div className="admin-grid">
        <select value={schedule.weekday} onChange={(event) => setSchedule({ ...schedule, weekday: Number(event.target.value) })}>
          {Array.from({ length: 7 }, (_, i) => (
            <option key={i} value={i}>
              {t(`weekday.${i}` as AdminTranslationKey)}
            </option>
          ))}
        </select>
        <select required value={schedule.periodId} onChange={(event) => setSchedule({ ...schedule, periodId: Number(event.target.value) })}>
          <option value={0}>{t('courses.periodName')}</option>
          {periods.map((item) => (
            <option key={item.id} value={item.id}>
              {item.periodNumber} {item.name}
            </option>
          ))}
        </select>
        <select value={schedule.facilityId} onChange={(event) => setSchedule({ ...schedule, facilityId: Number(event.target.value) })}>
          <option value={0}>{t('courses.noFacility')}</option>
          {facilities.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <input type="date" value={schedule.validFrom} onChange={(event) => setSchedule({ ...schedule, validFrom: event.target.value })} />
        <input type="date" value={schedule.validTo} onChange={(event) => setSchedule({ ...schedule, validTo: event.target.value })} />
        <button disabled={!schedule.periodId} onClick={() => void addSchedule()}>
          {t('courses.addRecurring')}
        </button>
      </div>
      <div className="compact-list">
        {detail?.schedules.map((item) => (
          <span key={item.id}>
            {t(`weekday.${item.weekday}` as AdminTranslationKey)} / {item.validFrom} - {item.validTo}
          </span>
        ))}
      </div>
      <hr />
      <div className="admin-grid">
        <input type="date" value={session.sessionDate} onChange={(event) => setSession({ ...session, sessionDate: event.target.value })} />
        <input type="time" value={session.startsAt} onChange={(event) => setSession({ ...session, startsAt: event.target.value })} />
        <input type="time" value={session.endsAt} onChange={(event) => setSession({ ...session, endsAt: event.target.value })} />
        <select value={session.facilityId} onChange={(event) => setSession({ ...session, facilityId: Number(event.target.value) })}>
          <option value={0}>{t('courses.noFacility')}</option>
          {facilities.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button disabled={!session.sessionDate || !session.startsAt || !session.endsAt} onClick={() => void addSession()}>
          {t('courses.addSession')}
        </button>
      </div>
      <div className="compact-list">
        {detail?.sessions.map((item) => (
          <span key={item.id}>
            {item.sessionDate} {item.startsAt} - {item.endsAt} / {t(`status.${item.status}` as AdminTranslationKey)}
          </span>
        ))}
      </div>
    </section>
  );
}
