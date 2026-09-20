import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import { buildUrl } from '../utils/buildUrl';

export type BackgroundEntry = {
  label: string;
  url: string;
};

type BgManifestEntry = { label: string; path: string };
type AssetsManifest = { vrm: never[]; backgrounds: BgManifestEntry[] };

export async function loadDefaultBackgroundList(): Promise<BackgroundEntry[]> {
  try {
    const res = await fetch(buildUrl('/assets-manifest.json'), { cache: 'no-store' });
    const manifest: AssetsManifest = await res.json();
    return manifest.backgrounds.map((b) => ({
      label: b.label,
      url: buildUrl(b.path),
    }));
  } catch (e) {
    console.error('Failed to load assets-manifest.json', e);
    return [];
  }
}

/** 背景画像一覧 */
export const backgroundListAtom = atom<BackgroundEntry[]>([]);

/** 現在選択中の背景 */
export const selectedBackgroundAtom = atom<BackgroundEntry | null>(null);

// ----------------------------------------------------------------
// localStorage に保存するのはパス文字列のみ
// ----------------------------------------------------------------

const noopStorage = {
  length: 0,
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
} as unknown as Storage;

const persistStorage = createJSONStorage<string | null>(() => (typeof window === 'undefined' ? noopStorage : localStorage));

/** 選択中背景のパスを永続化する atom */
export const selectedBackgroundPathAtom = atomWithStorage<string | null>('selected_bg_path', null, persistStorage, { getOnInit: true });
