import type { User } from '../db/schema';

export function canAccessSchool(actor: Pick<User, 'role' | 'schoolId'>, schoolId: number) {
  return actor.role === 'super_admin' || actor.schoolId === schoolId;
}
export function canGrantRole(actor: Pick<User, 'role'>, role: 'admin' | 'general') {
  return actor.role === 'super_admin' || role === 'general';
}
export function canManageSchoolData(actor: Pick<User, 'role' | 'schoolId'>, schoolId: number) {
  return canAccessSchool(actor, schoolId) && actor.role !== 'general';
}
export function canWriteCourse(actor: Pick<User, 'id' | 'role' | 'schoolId'>, schoolId: number, assignedTeacherIds: number[]) {
  return canAccessSchool(actor, schoolId) && (actor.role !== 'general' || assignedTeacherIds.includes(actor.id));
}
