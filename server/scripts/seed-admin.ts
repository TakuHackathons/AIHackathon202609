import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { passwordHash } from '../src/admin/security';

const [target] = process.argv.slice(2);
if (!['--local', '--remote'].includes(target)) throw new Error('Use --local or --remote.');

function localValues() {
  const path = resolve(process.cwd(), '.dev.vars');
  if (!existsSync(path)) return new Map<string, string>();
  return new Map(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .flatMap((line) => {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')] as const] : [];
      }),
  );
}
const values = localValues();
const value = (name: string, fallback = '') => process.env[name] ?? values.get(name) ?? fallback;
const required = (name: string) => {
  const result = value(name);
  if (!result) throw new Error(`${name} must be set in server/.dev.vars or the environment.`);
  return result;
};
const literal = (input: string | number) => `'${String(input).replaceAll("'", "''")}'`;

async function main() {
  const now = Date.now();
  const schoolId = '8a965872-2a55-4c4e-87cf-fdf58d484d8c';
  const superAdminId = 'c16ba58e-688a-4da2-b8df-775c2b1166c5';
  const schoolName = value('SEED_SCHOOL_NAME', 'Sample School');
  const schoolCode = value('SEED_SCHOOL_CODE', 'SAMPLE-SCHOOL');
  const superAdminUsername = required('SEED_SUPER_ADMIN_USERNAME').toLowerCase();
  const superAdminName = required('SEED_SUPER_ADMIN_NAME');
  const superAdminPassword = required('SEED_SUPER_ADMIN_PASSWORD');
  const password = await passwordHash(superAdminPassword);

  const command = `
INSERT OR IGNORE INTO schools (id, name, code, address, phone, created_at, updated_at)
VALUES (${literal(schoolId)}, ${literal(schoolName)}, ${literal(schoolCode)}, '', '', ${now}, ${now});
INSERT OR IGNORE INTO users (id, school_id, username, name, role, password_hash, password_expires_at, auth_version, created_at, updated_at)
VALUES (${literal(superAdminId)}, NULL, ${literal(superAdminUsername)}, ${literal(superAdminName)}, 'super_admin', ${literal(password)}, ${now + 7 * 86_400_000}, 0, ${now}, ${now});
`;
  execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', target!, '--command', command], {
    cwd: new URL('../', import.meta.url),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  console.log(`Seeded ${schoolName} and super admin ${superAdminUsername}.`);
}
void main();
