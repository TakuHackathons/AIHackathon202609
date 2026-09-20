import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import { atom } from 'jotai';
import { EmotionType } from '../features/vrmViewer/model';

export type HistoryEntry = {
  id: string;
  timestamp: number;
  userMessage: string;
  speakerName: string;
  emotion: EmotionType;
  replyText: string;
  /** true の間はAI返答が未完了（あなた側だけ先行表示） */
  pending?: boolean;
};

const historyStorage = createJSONStorage<HistoryEntry[]>(() => {
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

/** 会話履歴（localStorage永続化） */
export const historyAtom = atomWithStorage<HistoryEntry[]>('ai_vtuber_history', [], historyStorage, {
  getOnInit: true,
});

/** 履歴パネル表示状態（デフォルト非表示） */
export const historyPanelOpenAtom = atom<boolean>(false);
