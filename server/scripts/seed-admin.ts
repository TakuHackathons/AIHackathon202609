// @ts-expect-error Node 22 provides node:sqlite, but the installed type definitions do not yet declare it.
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const directory = resolve(process.cwd(), '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
const files = readdirSync(directory).filter((name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite');
if (files.length !== 1) throw new Error('Could not identify the local D1 SQLite database.');
const database = new DatabaseSync(resolve(directory, files[0]));
try {
  database.exec(readFileSync(resolve(process.cwd(), 'seeds', 'admin.sql'), 'utf8'));
} finally {
  database.close();
}