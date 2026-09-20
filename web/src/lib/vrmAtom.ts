import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import { buildUrl } from '../utils/buildUrl';

export type VrmEntry = {
  label: string;
  url: string;
  isCustom: boolean;
};

type VrmManifestEntry = { name: string; path: string };
type AssetsManifest = { vrm: VrmManifestEntry[]; backgrounds: never[] };

let _defaultVrmList: VrmEntry[] = [];

export async function loadDefaultVrmList(): Promise<VrmEntry[]> {
  if (_defaultVrmList.length > 0) return _defaultVrmList;
  try {
    const res = await fetch(buildUrl('/assets-manifest.json'));
    const manifest: AssetsManifest = await res.json();
    _defaultVrmList = manifest.vrm.map((v) => ({
      label: v.name,
      url: buildUrl(v.path),
      isCustom: false,
    }));
  } catch (e) {
    console.error('Failed to load assets-manifest.json', e);
    _defaultVrmList = [{ label: 'Zundamon VRM 10', url: buildUrl('/vrm/Zundamon_VRM_10.vrm'), isCustom: false }];
  }
  return _defaultVrmList;
}

/** VRM一覧（デフォルト + ユーザー追加分） */
export const vrmListAtom = atom<VrmEntry[]>([]);

/** 現在選択中のVRM */
export const selectedVrmAtom = atom<VrmEntry | null>(null);

// ----------------------------------------------------------------
// localStorage に保存するのはパス文字列のみ（isCustom:false のもの限定）
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

/**
 * 選択中VRMのパスを永続化する atom。
 * isCustom:true のときは書き込まない（null のまま）。
 */
export const selectedVrmPathAtom = atomWithStorage<string | null>('selected_vrm_path', null, persistStorage, { getOnInit: true });
