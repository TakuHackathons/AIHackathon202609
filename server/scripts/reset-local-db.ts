import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sqlFile = resolve(process.cwd(), '.reset-local-db.sql');
const sql = `
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS challenges;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS passkeys;
DROP TABLE IF EXISTS auth_attempts;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS schools;
DROP TABLE IF EXISTS d1_migrations;
PRAGMA foreign_keys = ON;
`;
writeFileSync(sqlFile, sql, 'utf8');
try {
  execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', '--local', '--file', '.reset-local-db.sql'], {
    cwd: new URL('../', import.meta.url),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
} finally {
  rmSync(sqlFile, { force: true });
}
execFileSync('pnpm', ['run', 'db:migrate:local'], {
  cwd: new URL('../', import.meta.url),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});