/**
 * 学校削除用の運用スクリプトです。管理画面からの学校削除は実装していません。
 *
 * 実行例:
 *   pnpm --filter live-ai-supporter-server delete:school -- <school-id> --local
 *   pnpm --filter live-ai-supporter-server delete:school -- <school-id> --remote
 */
import { execFileSync } from 'node:child_process';

const [schoolId, target] = process.argv.slice(2);
if (!schoolId || !/^[0-9a-f-]{36}$/i.test(schoolId) || !['--local', '--remote'].includes(target)) {
  throw new Error('学校IDと --local または --remote を指定してください。');
}
const command = `DELETE FROM schools WHERE id = '${schoolId.replaceAll("'", "''")}';`;
execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', target, '--command', command], {
  cwd: new URL('../', import.meta.url),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
