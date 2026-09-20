/**
 * generate-assets-manifest.ts
 *
 * ビルド前に実行するスクリプト。
 * public/vrm/         以下の .vrm ファイル（GLBからメタ名を抽出）
 * public/backgrounds/ 以下の画像ファイル (.jpg/.jpeg/.png/.webp)
 * をスキャンして public/assets-manifest.json を生成する。
 *
 * 実行: tsx scripts/generate-assets-manifest.ts
 */

import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = path.resolve(__dirname, '../public');
const OUTPUT_PATH = path.join(PUBLIC_DIR, 'assets-manifest.json');
const VRM_DIR = path.join(PUBLIC_DIR, 'vrm');
const BACKGROUNDS_DIR = path.join(PUBLIC_DIR, 'backgrounds');
const VRM_EXTENSIONS = ['.vrm'];
const BG_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// ----------------------------------------------------------------
// VRMファイルからメタ名を抽出
// VRMはGLB形式。先頭のJSONチャンクに extensions.VRMC_vrm.meta.name (VRM1.x)
// または extensions.VRM.meta.title (VRM0.x) が含まれる。
// ----------------------------------------------------------------

function readVrmName(filePath: string, fallback: string): string {
  try {
    const buf = fs.readFileSync(filePath);
    // GLB: magic(4) + version(4) + totalLength(4) + chunkLength(4) + chunkType(4) + chunkData
    const magic = buf.toString('ascii', 0, 4);
    if (magic !== 'glTF') return fallback;

    const chunkLength = buf.readUInt32LE(12);
    const chunkType = buf.toString('ascii', 16, 20);
    if (chunkType !== 'JSON') return fallback;

    const jsonStr = buf.toString('utf-8', 20, 20 + chunkLength);
    const gltf = JSON.parse(jsonStr);

    // VRM 1.x
    const vrm1Name = gltf?.extensions?.VRMC_vrm?.meta?.name;
    if (vrm1Name) return vrm1Name;

    // VRM 0.x
    const vrm0Title = gltf?.extensions?.VRM?.meta?.title;
    if (vrm0Title) return vrm0Title;

    return fallback;
  } catch {
    return fallback;
  }
}

// ファイル名からフォールバック用ラベルを生成
function toLabel(filename: string): string {
  return path
    .basename(filename, path.extname(filename))
    .replace(/[_\-]+/g, ' ')
    .trim();
}

// ----------------------------------------------------------------
// スキャン
// ----------------------------------------------------------------

function scanDir(dir: string, extensions: string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => extensions.includes(path.extname(f).toLowerCase()))
    .sort();
}

const vrmFiles = scanDir(VRM_DIR, VRM_EXTENSIONS);
const bgFiles = scanDir(BACKGROUNDS_DIR, BG_EXTENSIONS);

// ----------------------------------------------------------------
// マニフェスト構築
// ----------------------------------------------------------------

export type VrmManifestEntry = {
  /** VRMメタデータの name（取得できない場合はファイル名ベース） */
  name: string;
  path: string;
};

export type BackgroundManifestEntry = {
  label: string;
  path: string;
};

export type AssetsManifest = {
  generatedAt: string;
  vrm: VrmManifestEntry[];
  backgrounds: BackgroundManifestEntry[];
};

const manifest: AssetsManifest = {
  generatedAt: new Date().toISOString(),
  vrm: vrmFiles.map((f) => {
    const filePath = path.join(VRM_DIR, f);
    const fallback = toLabel(f);
    const name = readVrmName(filePath, fallback);
    return { name, path: `/vrm/${f}` };
  }),
  backgrounds: bgFiles.map((f) => ({
    label: toLabel(f),
    path: `/backgrounds/${f}`,
  })),
};

// ----------------------------------------------------------------
// 出力
// ----------------------------------------------------------------

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(manifest, null, 2), 'utf-8');

console.log(`✅ assets-manifest.json generated`);
console.log(`   VRM        : ${manifest.vrm.length} files`);
manifest.vrm.forEach((v) => console.log(`               ${v.path}  →  "${v.name}"`));
console.log(`   Backgrounds: ${manifest.backgrounds.length} files`);
manifest.backgrounds.forEach((b) => console.log(`               ${b.path}  →  "${b.label}"`));
