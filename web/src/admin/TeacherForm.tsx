import type { School, TeacherFormValue } from './types';

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
      <input
        type="email"
        placeholder="メールアドレス"
        value={value.email}
        onChange={(event) => onChange({ ...value, email: event.target.value })}
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
        <option value="general">一般教員</option>
        <option value="admin">管理者</option>
      </select>
    </div>
  );
}
