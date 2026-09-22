import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAdminLocale } from '../web/src/admin/i18n';

test('admin locale follows the browser and defaults to Japanese', () => {
  assert.equal(resolveAdminLocale(null, ['ja-JP']), 'ja');
  assert.equal(resolveAdminLocale(null, ['en-US']), 'en');
  assert.equal(resolveAdminLocale(null, ['fr-FR']), 'ja');
});

test('saved admin locale overrides the browser language', () => {
  assert.equal(resolveAdminLocale(JSON.stringify('en'), ['ja-JP']), 'en');
  assert.equal(resolveAdminLocale('ja', ['en-US']), 'ja');
});
