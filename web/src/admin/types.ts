export type Role = 'super_admin' | 'admin' | 'general';

export type Teacher = {
  id: number;
  schoolId: number | null;
  username: string;
  name: string;
  email: string;
  department: string;
  subjects: string;
  responsibilities: string;
  role: Role;
  createdAt: number;
};

export type School = {
  id: number;
  name: string;
  code: string;
  address: string;
  phone: string;
  createdAt: number;
  updatedAt: number;
};

export type Passkey = {
  id: number;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
};

export type CurrentUser = {
  user: Teacher;
  enrollmentRequired: boolean;
};

export type TeacherFormValue = {
  name: string;
  username: string;
  email: string;
  department: string;
  subjects: string;
  responsibilities: string;
  role: Role;
  schoolId: number;
};

export const emptyTeacher: TeacherFormValue = {
  name: '',
  username: '',
  email: '',
  department: '',
  subjects: '',
  responsibilities: '',
  role: 'general',
  schoolId: 0,
};

export const roleLabel: Record<Role, string> = {
  super_admin: 'super admin',
  admin: '管理者',
  general: '一般',
};
