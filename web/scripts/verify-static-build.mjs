import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const client = fileURLToPath(new URL('../dist/client/', import.meta.url));
const html = readFileSync(path.join(client, 'index.html'), 'utf8');
// Verify real page HTML, not just an empty SPA shell.
assert.ok(html.includes('<h1>よりそいAI相談室</h1>'));
assert.ok(html.includes('相談中'));
assert.ok(html.includes('VOICEVOX:ずんだもん'));
assert.ok(html.includes('<html lang="ja">'));
assert.ok(!html.includes('/_next/'));
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
assert.ok(
  assets.some((asset) => asset.endsWith('.js')),
  'Missing hydration JavaScript',
);
assert.ok(
  assets.some((asset) => asset.endsWith('.css')),
  'Missing stylesheet',
);
for (const asset of assets) assert.ok(existsSync(path.join(client, asset.slice(1))), 'Missing asset: ' + asset);
const manifest = JSON.parse(readFileSync(path.join(client, 'assets-manifest.json'), 'utf8'));
assert.deepEqual(
  manifest.vrm.map((model) => model.path),
  ['/vrm/Zundamon_VRM_10.vrm'],
);
assert.ok(existsSync(path.join(client, 'vrm/Zundamon_VRM_10.vrm')));
const { config, error } = ts.parseConfigFileTextToJson(
  'wrangler.jsonc',
  readFileSync(new URL('../../server/wrangler.jsonc', import.meta.url), 'utf8'),
);
assert.equal(error, undefined, 'Invalid Wrangler JSONC');
assert.equal(config.assets.directory, '../web/dist/client');
assert.ok(config.assets.run_worker_first.includes('/api/*'));
console.log('SSG verified: page HTML, hydration assets, sample VRM, and Hono routing.');
