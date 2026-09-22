import { and, eq, inArray, lte, or, gt, isNull, desc } from 'drizzle-orm';
import type { Bindings } from '../bindings';
import { database } from '../db';
import { facilities, facilityBusinessExceptions, facilityBusinessHours, facilityStatusOverrides, schools } from '../db/schema';

export type FacilityStatus = {
  status: 'open' | 'closed' | 'restricted';
  source: 'override' | 'exception' | 'business_hours';
  reason: string;
};

function localParts(epoch: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(epoch);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: get('year') + '-' + get('month') + '-' + get('day'),
    time: get('hour') + ':' + get('minute'),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
  };
}

export async function facilityStatuses(env: Bindings, rows: Array<typeof facilities.$inferSelect>, at = Date.now()) {
  if (!rows.length) return new Map<number, FacilityStatus>();
  const db = database(env);
  const facilityIds = rows.map((row) => row.id);
  const schoolIds = [...new Set(rows.map((row) => row.schoolId))];
  const [schoolRows, hours, exceptions, overrides] = await Promise.all([
    db.select().from(schools).where(inArray(schools.id, schoolIds)),
    db.select().from(facilityBusinessHours).where(inArray(facilityBusinessHours.facilityId, facilityIds)),
    db.select().from(facilityBusinessExceptions).where(inArray(facilityBusinessExceptions.facilityId, facilityIds)),
    db
      .select()
      .from(facilityStatusOverrides)
      .where(
        and(
          inArray(facilityStatusOverrides.facilityId, facilityIds),
          lte(facilityStatusOverrides.startsAt, at),
          or(isNull(facilityStatusOverrides.endsAt), gt(facilityStatusOverrides.endsAt, at)),
        ),
      )
      .orderBy(desc(facilityStatusOverrides.startsAt)),
  ]);
  const timezones = new Map(schoolRows.map((school) => [school.id, school.timezone]));
  const result = new Map<number, FacilityStatus>();

  for (const facility of rows) {
    const local = localParts(at, timezones.get(facility.schoolId) ?? 'Asia/Tokyo');
    const override = overrides.find((row) => row.facilityId === facility.id);
    if (override) {
      result.set(facility.id, { status: override.status, source: 'override', reason: override.reason });
      continue;
    }
    const exception = exceptions.find((row) => row.facilityId === facility.id && row.date === local.date);
    if (exception) {
      const inTime =
        exception.opensAt === null || exception.closesAt === null || (exception.opensAt <= local.time && local.time < exception.closesAt);
      result.set(facility.id, {
        status: inTime ? exception.status : 'closed',
        source: 'exception',
        reason: exception.note,
      });
      continue;
    }
    const open = hours.some(
      (row) => row.facilityId === facility.id && row.weekday === local.weekday && row.opensAt <= local.time && local.time < row.closesAt,
    );
    result.set(facility.id, { status: open ? 'open' : 'closed', source: 'business_hours', reason: '' });
  }
  return result;
}
