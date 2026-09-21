import type { TeacherFormValue } from './types';
import type { School } from './types';

type Props = {
  value: TeacherFormValue;
  schools: School[];
  creating: boolean;
  showSchool: boolean;
  onChange: (value: TeacherFormValue) => void;
};

export function TeacherForm({ value, schools, creating, showSchool, onChange }: Props) {
  return (
    <div className="admin-grid">
      <input required placeholder="氏名" value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} />
      {creating && (
        <input
          required
          placeholder="ユーザー名"
          value={value.username}
          onChange={(event) => onChange({ ...value, username: event.target.value })}
        />
      )}
      <input placeholder="メールアドレス" value={value.email} onChange={(event) => onChange({ ...value, email: event.target.value })} />
      <input
        placeholder="部署・学年"
        value={value.department}
        onChange={(event) => onChange({ ...value, department: event.target.value })}
      />
      <input placeholder="担当教科" value={value.subjects} onChange={(event) => onChange({ ...value, subjects: event.target.value })} />
      <input
        placeholder="担当・役割"
        value={value.responsibilities}
        onChange={(event) => onChange({ ...value, responsibilities: event.target.value })}
      />
      {showSchool && (
        <select required value={value.schoolId || ''} onChange={(event) => onChange({ ...value, schoolId: Number(event.target.value) })}>
          <option value="">所属する学校</option>
          {schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name}
            </option>
          ))}
        </select>
      )}
      <select value={value.role} onChange={(event) => onChange({ ...value, role: event.target.value as TeacherFormValue['role'] })}>
        <option value="general">一般</option>
        <option value="admin">管理者</option>
      </select>
    </div>
  );
}
