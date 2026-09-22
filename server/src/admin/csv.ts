import { fail, type AdminContext } from './security';

export type CsvRow = Record<string, string>;

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else value += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(value.trim());
      value = '';
    } else if (character === '\n') {
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
    } else if (character !== '\r') value += character;
  }
  if (quoted) throw new Error('Unclosed quoted field.');
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export async function csvUpload(c: AdminContext, requiredHeaders: string[], maxRows = 500) {
  const form = await c.req.formData();
  const entry = form.get('file');
  if (!entry || typeof entry === 'string') fail(400, 'CSV file is required.');
  const file = entry as unknown as File;
  if (file.size > 2_000_000) fail(400, 'CSV file must be 2 MB or smaller.');
  let parsed: string[][] = [];
  try {
    parsed = parseCsvText((await file.text()).replace(/^\uFEFF/, ''));
  } catch (error) {
    fail(400, error instanceof Error ? error.message : 'CSV could not be parsed.');
  }
  if (!parsed.length) fail(400, 'CSV is empty.');
  const headers = parsed.shift()!.map((header) => header.trim().toLowerCase());
  const missing = requiredHeaders.filter((header) => !headers.includes(header));
  if (missing.length) fail(400, 'Missing columns: ' + missing.join(', '));
  if (parsed.length > maxRows) fail(400, `CSV can contain at most ${maxRows} data rows.`);
  const rows: CsvRow[] = parsed.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  return { form, rows };
}

export function required(row: CsvRow, key: string, max = 4000) {
  const value = row[key]?.trim() ?? '';
  if (!value || value.length > max) throw new Error(`${key} is required and must be ${max} characters or fewer.`);
  return value;
}

export function optional(row: CsvRow, key: string, max = 4000) {
  const value = row[key]?.trim() ?? '';
  if (value.length > max) throw new Error(`${key} must be ${max} characters or fewer.`);
  return value;
}

export async function importRows(rows: CsvRow[], action: (row: CsvRow) => Promise<void>) {
  const errors: string[] = [];
  let imported = 0;
  for (const [index, row] of rows.entries()) {
    try {
      await action(row);
      imported += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed.';
      errors.push(`Row ${index + 2}: ${message}`);
    }
  }
  return { imported, errors };
}
