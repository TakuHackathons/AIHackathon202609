import type { School, TeacherFormValue } from './types';
import { useAdminI18n } from './i18n';
type Props = {
  value: TeacherFormValue;
  schools: School[];
  creating: boolean;
  showSchool: boolean;
  onChange: (value: TeacherFormValue) => void;
};
export function TeacherForm({ value, schools, creating, showSchool, onChange }: Props) {
  const { t } = useAdminI18n();
  return (
    <div className="admin-grid">
      <input
        required
        placeholder={t('teachers.name')}
        value={value.name}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
      />
      {creating && (
        <input
          required
          placeholder={t('auth.username')}
          value={value.username}
          onChange={(event) => onChange({ ...value, username: event.target.value })}
        />
      )}
      <input
        type="email"
        placeholder={t('teachers.email')}
        value={value.email}
        onChange={(event) => onChange({ ...value, email: event.target.value })}
      />
      {showSchool && (
        <select required value={value.schoolId || ''} onChange={(event) => onChange({ ...value, schoolId: Number(event.target.value) })}>
          <option value="">{t('teachers.school')}</option>
          {schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name}
            </option>
          ))}
        </select>
      )}
      <select value={value.role} onChange={(event) => onChange({ ...value, role: event.target.value as TeacherFormValue['role'] })}>
        <option value="general">{t('teachers.general')}</option>
        <option value="admin">{t('teachers.admin')}</option>
      </select>
    </div>
  );
}
