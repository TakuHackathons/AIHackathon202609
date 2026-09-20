import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

export type SpeakerStyle = {
  id: number;
  name: string;
  type?: string;
};

export type Speaker = {
  name: string;
  speaker_uuid: string;
  styles: SpeakerStyle[];
  version?: string;
};

// ----------------------------------------------------------------
// ローカルストレージキャッシュ（有効期間 12 時間）
// ----------------------------------------------------------------

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

type SpeakersCache = {
  data: Speaker[];
  cachedAt: number;
};

/**
 * speakers のキャッシュを localStorage に保存する atom。
 * null = 未取得 or 期限切れ
 *
 * Next.js SSG では build 時に localStorage が存在しないため、
 * createJSONStorage の getItem をブラウザ側のみ実行させる。
 */
const speakersCacheStorage = createJSONStorage<SpeakersCache | null>(() => {
  // SSR / build 時は noop ストレージを返す
  if (typeof window === 'undefined') {
    return {
      length: 0,
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
    } as unknown as Storage;
  }
  return localStorage;
});

const speakersCacheAtom = atomWithStorage<SpeakersCache | null>('voicevox_speakers_cache', null, speakersCacheStorage, {
  getOnInit: true, // マウント直後に localStorage から読み込む
});

// ----------------------------------------------------------------
// 公開 atom
// ----------------------------------------------------------------

/**
 * Voicevox スピーカー一覧。
 * 読み取り時にキャッシュ期限を検証し、期限切れなら null を返す派生 atom。
 */
export const speakersAtom = atom(
  (get) => {
    const cache = get(speakersCacheAtom);
    if (!cache) return null;
    const isExpired = Date.now() - cache.cachedAt > CACHE_TTL_MS;
    return isExpired ? null : cache.data;
  },
  (_get, set, speakers: Speaker[]) => {
    set(speakersCacheAtom, { data: speakers, cachedAt: Date.now() });
  },
);

/** 現在選択中のスピーカー（キャラクター） */
export const selectedSpeakerAtom = atom<Speaker | null>(null);

/**
 * 現在の感情に対応する VoiceVox スタイル ID を返す派生 atom（読み取り専用）。
 *
 * 感情 → VoiceVox スタイル名 のマッピング優先順:
 *   happy   → あまあま > ノーマル
 *   angry   → ツンツン > ノーマル
 *   sad     → ささやき > ヒソヒソ > ノーマル
 *   relaxed → ノーマル
 *   neutral → ノーマル
 *
 * 対応するスタイルが見つからない場合は先頭スタイルを使う。
 */
export const EMOTION_TO_STYLE_NAMES: Record<string, string[]> = {
  happy: ['あまあま', 'ノーマル'],
  angry: ['ツンツン', 'ノーマル'],
  sad: ['ささやき', 'ヒソヒソ', 'ノーマル'],
  relaxed: ['ノーマル', 'あまあま'],
  neutral: ['ノーマル'],
};

export function resolveStyleId(speaker: Speaker, emotion: string): number {
  const candidates = EMOTION_TO_STYLE_NAMES[emotion] ?? ['ノーマル'];
  for (const name of candidates) {
    const found = speaker.styles.find((s) => s.name === name);
    if (found) return found.id;
  }
  // どれにも一致しなければ先頭スタイルを使う
  return speaker.styles[0]?.id ?? 0;
}

export function resolveStyleName(speaker: Speaker, emotion: string): string {
  const candidates = EMOTION_TO_STYLE_NAMES[emotion] ?? ['ノーマル'];
  for (const name of candidates) {
    const found = speaker.styles.find((s) => s.name === name);
    if (found) return found.name;
  }
  return speaker.styles[0]?.name ?? 'ノーマル';
}

// ----------------------------------------------------------------
// 選択中スピーカー名を localStorage に永続化する atom
// ----------------------------------------------------------------

const _noopStorage = {
  length: 0,
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
} as unknown as Storage;

const _speakerPersistStorage = createJSONStorage<string | null>(() => (typeof window === 'undefined' ? _noopStorage : localStorage));

/** 選択中スピーカーの name を永続化する atom */
export const selectedSpeakerNameAtom = atomWithStorage<string | null>('selected_speaker_name', null, _speakerPersistStorage, {
  getOnInit: true,
});
