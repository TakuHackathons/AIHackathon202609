import assert from 'node:assert/strict';
import test from 'node:test';
import { importRows, parseCsvText } from '../server/src/admin/csv';

test('CSV parser handles quoted commas, escaped quotes and CRLF', () => {
  assert.deepEqual(parseCsvText('name,description\r\nA,"one,two"\r\nB,"say ""hello"""\r\n'), [
    ['name', 'description'],
    ['A', 'one,two'],
    ['B', 'say "hello"'],
  ]);
});

test('CSV row import keeps valid rows and reports failed row numbers', async () => {
  const saved: string[] = [];
  const result = await importRows([{ name: 'A' }, { name: '' }, { name: 'C' }], async (row) => {
    if (!row.name) throw new Error('name is required.');
    saved.push(row.name);
  });
  assert.deepEqual(saved, ['A', 'C']);
  assert.deepEqual(result, { imported: 2, errors: ['Row 3: name is required.'] });
});
