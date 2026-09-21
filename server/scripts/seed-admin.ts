import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { passwordHash } from '../src/admin/security';

const [target] = process.argv.slice(2);
if (!['--local', '--remote'].includes(target)) throw new Error('Use --local or --remote.');

const seed = {
  schoolId: '8a965872-2a55-4c4e-87cf-fdf58d484d8c',
  schoolName: 'Sample School',
  schoolCode: 'SAMPLE-SCHOOL',
  superAdminId: 'c16ba58e-688a-4da2-b8df-775c2b1166c5',
  superAdminUsername: 'super-admin',
  superAdminName: 'Operations Admin',
  superAdminPassword: 'initial-super-admin-password',
};
const literal = (input: string | number) => `'${String(input).replaceAll("'", "''")}'`;

async function main() {
  const now = Date.now();
  const password = await passwordHash(seed.superAdminPassword);
  const command = `
INSERT OR IGNORE INTO schools (id, name, code, address, phone, created_at, updated_at)
VALUES (${literal(seed.schoolId)}, ${literal(seed.schoolName)}, ${literal(seed.schoolCode)}, '', '', ${now}, ${now});
INSERT OR IGNORE INTO users (id, school_id, username, name, role, password_hash, password_expires_at, auth_version, created_at, updated_at)
VALUES (${literal(seed.superAdminId)}, NULL, ${literal(seed.superAdminUsername)}, ${literal(seed.superAdminName)}, 'super_admin', ${literal(password)}, ${now + 7 * 86_400_000}, 0, ${now}, ${now});
`;
  const sqlFile = resolve(process.cwd(), '.seed-admin.sql');
  writeFileSync(sqlFile, command, 'utf8');
  try {
    execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', target!, '--file', '.seed-admin.sql'], {
      cwd: new URL('../', import.meta.url),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
  } finally {
    rmSync(sqlFile, { force: true });
  }
  console.log(`Seeded ${seed.schoolName} and super admin ${seed.superAdminUsername}.`);
}
void main();