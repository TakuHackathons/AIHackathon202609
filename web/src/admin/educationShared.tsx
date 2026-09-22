import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { adminApi } from './api';
import { useAdmin } from './AdminContext';
export function useSchoolData<T>(path: string, key: string) {
  const { me, schools, superAdmin } = useAdmin();
  const [schoolId, setSchoolId] = useState(me?.user.schoolId ?? schools[0]?.id ?? 0);
  const [rows, setRows] = useState<T[]>([]);
  const load = useCallback(async () => {
    if (!schoolId) return setRows([]);
    const data = await adminApi(path + (path.includes('?') ? '&' : '?') + 'schoolId=' + schoolId);
    setRows((data[key] ?? []) as T[]);
  }, [path, key, schoolId]);
  useEffect(() => {
    void load();
  }, [load]);
  const picker = superAdmin ? (
    <label className="admin-school-picker">
      School
      <select value={schoolId} onChange={(e) => setSchoolId(Number(e.target.value))}>
        <option value={0}>Select school</option>
        {schools.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
    </label>
  ) : null;
  return { schoolId, rows, setRows, load, picker };
}
export function PageHeading({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="admin-page-heading">
      <div>
        <p className="admin-kicker">{kicker}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export async function remove(path: string, reload: () => Promise<void>) {
  if (!window.confirm('Delete this record?')) return;
  await adminApi(path, { method: 'DELETE' });
  await reload();
}
