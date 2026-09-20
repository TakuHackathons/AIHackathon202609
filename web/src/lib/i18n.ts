import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import { useAtomValue } from 'jotai';

export type Locale = 'ja' | 'en';

// ----------------------------------------------------------------
// 翻訳テキスト定義
// ----------------------------------------------------------------

export const translations = {
  ja: {
    // ツールバーラベル
    labelBackground: '背景',
    labelVrm: 'VRM',
    labelAi: 'AI',
    labelVoice: 'ボイス',

    // 入力エリア
    inputPlaceholder: '聞きたいことをいれてね\n（Shift+Enterで改行）',

    // VRM セレクター
    vrmAddOption: '＋ VRMファイルを追加...',
    vrmModalTitle: 'VRMファイルを追加',
    vrmDropZoneMain: 'VRMファイルをドロップ',
    vrmDropZoneSub: 'またはクリックしてファイルを選択',
    vrmDropZoneFormat: '対応形式: .vrm',
    vrmModalCancel: 'キャンセル',

    // スピーカーセレクター 感情ラベル
    emotionNeutral: 'ノーマル',
    emotionHappy: 'うれしい',
    emotionAngry: 'おこ',
    emotionSad: 'かなしい',
    emotionRelaxed: 'おだやか',

    // 履歴パネル
    historyToggleOpen: '◀ 履歴',
    historyToggleClose: '▶ 閉じる',
    historyToggleTitleOpen: '履歴を開く',
    historyToggleTitleClose: '履歴を閉じる',
    historyTitle: '💬 会話履歴',
    historyCount: (n: number) => `${n}件`,
    historyEmpty: 'まだ会話がありません',
    historyYou: 'あなた',
    historyGenerating: '返答を生成中',
    historyClear: '🗑 履歴をクリア',
    historyClearConfirm: '会話履歴をすべて削除しますか？',
  },
  en: {
    // ツールバーラベル
    labelBackground: 'BG',
    labelVrm: 'VRM',
    labelAi: 'AI',
    labelVoice: 'Voice',

    // 入力エリア
    inputPlaceholder: 'Ask me anything\n(Shift+Enter for new line)',

    // VRM セレクター
    vrmAddOption: '+ Add VRM file...',
    vrmModalTitle: 'Add VRM File',
    vrmDropZoneMain: 'Drop VRM file here',
    vrmDropZoneSub: 'or click to select a file',
    vrmDropZoneFormat: 'Supported format: .vrm',
    vrmModalCancel: 'Cancel',

    // スピーカーセレクター 感情ラベル
    emotionNeutral: 'Normal',
    emotionHappy: 'Happy',
    emotionAngry: 'Angry',
    emotionSad: 'Sad',
    emotionRelaxed: 'Relaxed',

    // 履歴パネル
    historyToggleOpen: '◀ History',
    historyToggleClose: '▶ Close',
    historyToggleTitleOpen: 'Open history',
    historyToggleTitleClose: 'Close history',
    historyTitle: '💬 Chat History',
    historyCount: (n: number) => `${n} entries`,
    historyEmpty: 'No conversations yet',
    historyYou: 'You',
    historyGenerating: 'Generating response',
    historyClear: '🗑 Clear History',
    historyClearConfirm: 'Delete all conversation history?',
  },
} as const;

export type Translations = {
  labelBackground: string;
  labelVrm: string;
  labelAi: string;
  labelVoice: string;
  inputPlaceholder: string;
  vrmAddOption: string;
  vrmModalTitle: string;
  vrmDropZoneMain: string;
  vrmDropZoneSub: string;
  vrmDropZoneFormat: string;
  vrmModalCancel: string;
  emotionNeutral: string;
  emotionHappy: string;
  emotionAngry: string;
  emotionSad: string;
  emotionRelaxed: string;
  historyToggleOpen: string;
  historyToggleClose: string;
  historyToggleTitleOpen: string;
  historyToggleTitleClose: string;
  historyTitle: string;
  historyCount: (n: number) => string;
  historyEmpty: string;
  historyYou: string;
  historyGenerating: string;
  historyClear: string;
  historyClearConfirm: string;
};

// ----------------------------------------------------------------
// locale atom（localStorage 永続化）
// デフォルト: ブラウザ言語が日本語なら 'ja'、それ以外は 'en'
// ----------------------------------------------------------------

function detectDefaultLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const lang = navigator.language ?? '';
  return lang.startsWith('ja') ? 'ja' : 'en';
}

const noopStorage = {
  length: 0,
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
} as unknown as Storage;

const localeStorage = createJSONStorage<Locale>(() => (typeof window === 'undefined' ? noopStorage : localStorage));

export const localeAtom = atomWithStorage<Locale>(
  'selected_locale',
  // 初回のみ実行されるデフォルト値（SSR時は 'en'、ブラウザ側で上書き）
  'en',
  localeStorage,
  { getOnInit: true },
);

// ----------------------------------------------------------------
// フック: useLocale() → 翻訳オブジェクトを返す
// ----------------------------------------------------------------

export function useTranslations(): Translations {
  const locale = useAtomValue(localeAtom);
  return translations[locale];
}
