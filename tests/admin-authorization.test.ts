import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessSchool,
  canGrantRole,
  canManageSchoolData,
  canSetPasskeyPassword,
  canWriteCourse,
} from '../server/src/admin/authorization';
const superAdmin = { id: 1, role: 'super_admin' as const, schoolId: null };
const adminA = { id: 2, role: 'admin' as const, schoolId: 10 };
const generalA = { id: 3, role: 'general' as const, schoolId: 10 };
const generalB = { id: 4, role: 'general' as const, schoolId: 20 };
test('school scope isolates admin and general users', () => {
  assert.equal(canAccessSchool(superAdmin, 20), true);
  assert.equal(canAccessSchool(adminA, 10), true);
  assert.equal(canAccessSchool(adminA, 20), false);
  assert.equal(canAccessSchool(generalA, 20), false);
});
test('only super admin can grant admin role', () => {
  assert.equal(canGrantRole(superAdmin, 'admin'), true);
  assert.equal(canGrantRole(adminA, 'admin'), false);
  assert.equal(canGrantRole(adminA, 'general'), true);
});
test('passkey registration passwords follow role and school scope', () => {
  const adminB = { id: 5, role: 'admin' as const, schoolId: 20 };
  assert.equal(canSetPasskeyPassword(superAdmin, adminA), true);
  assert.equal(canSetPasskeyPassword(superAdmin, generalB), true);
  assert.equal(canSetPasskeyPassword(adminA, generalA), true);
  assert.equal(canSetPasskeyPassword(adminA, generalB), false);
  assert.equal(canSetPasskeyPassword(adminA, adminB), false);
  assert.equal(canSetPasskeyPassword(adminA, adminA), false);
  assert.equal(canSetPasskeyPassword(generalA, adminA), false);
  assert.equal(canSetPasskeyPassword(adminA, superAdmin), false);
});
test('school data mutations require manager in the same school', () => {
  assert.equal(canManageSchoolData(adminA, 10), true);
  assert.equal(canManageSchoolData(adminA, 20), false);
  assert.equal(canManageSchoolData(generalA, 10), false);
});
test('general teachers can update only assigned courses', () => {
  assert.equal(canWriteCourse(adminA, 10, []), true);
  assert.equal(canWriteCourse(generalA, 10, [3]), true);
  assert.equal(canWriteCourse(generalA, 10, [4]), false);
  assert.equal(canWriteCourse(generalB, 10, [4]), false);
});
