import { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { historyAtom, historyPanelOpenAtom, HistoryEntry } from '../lib/historyAtom';
import { EmotionType } from '../features/vrmViewer/model';
import { useTranslations } from '../lib/i18n';

const EMOTION_EMOJI: Record<EmotionType, string> = {
  neutral: '😐',
  happy: '😊',
  angry: '😠',
  sad: '😢',
  relaxed: '😌',
};

const EMOTION_BG: Record<EmotionType, string> = {
  neutral: 'rgba(160,140,200,0.18)',
  happy: 'rgba(249,213,110,0.18)',
  angry: 'rgba(249,112,112,0.18)',
  sad: 'rgba(122,176,232,0.18)',
  relaxed: 'rgba(136,224,176,0.18)',
};

const EMOTION_ACCENT: Record<EmotionType, string> = {
  neutral: 'rgba(180,150,220,0.5)',
  happy: 'rgba(249,213,110,0.6)',
  angry: 'rgba(249,112,112,0.6)',
  sad: 'rgba(122,176,232,0.6)',
  relaxed: 'rgba(136,224,176,0.6)',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

type Props = {
  /** 入力エリアの高さ（px）。履歴パネルの bottom をこの値に合わせる */
  inputAreaHeight: number;
};

export function HistoryPanel({ inputAreaHeight }: Props) {
  const t = useTranslations();
  const emotionLabel: Record<EmotionType, string> = {
    neutral: t.emotionNeutral,
    happy: t.emotionHappy,
    angry: t.emotionAngry,
    sad: t.emotionSad,
    relaxed: t.emotionRelaxed,
  };
  const [isOpen, setIsOpen] = useAtom(historyPanelOpenAtom);
  const [history, setHistory] = useAtom(historyAtom);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新エントリ追加 / pending 更新時に末尾へスクロール
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isOpen]);

  const onClear = () => {
    if (window.confirm(t.historyClearConfirm)) {
      setHistory([]);
    }
  };

  // パネルの上端・下端をビューポートにクランプ
  const panelTop = 0;
  const panelBottom = inputAreaHeight; // 入力エリア分だけ底から空ける

  return (
    <>
      {/* ── トグルタブ（常に表示、入力エリアの上端より上の中央） ── */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        style={{
          position: 'fixed',
          // 入力エリアより上の空間の縦中央
          top: `calc(50% - ${inputAreaHeight / 2}px)`,
          right: isOpen ? '320px' : '0px',
          transform: 'translateY(-50%)',
          zIndex: 50,
          backgroundColor: 'rgba(30,18,50,0.92)',
          border: '1px solid rgba(180,140,220,0.6)',
          borderRight: 'none',
          borderRadius: '6px 0 0 6px',
          color: '#e8d9f5',
          padding: '12px 6px',
          cursor: 'pointer',
          fontSize: '11px',
          letterSpacing: '0.1em',
          writingMode: 'vertical-rl',
          transition: 'right 0.3s ease',
          boxShadow: '-2px 0 12px rgba(140,80,220,0.2)',
        }}
        title={isOpen ? t.historyToggleTitleClose : t.historyToggleTitleOpen}
      >
        {isOpen ? t.historyToggleClose : t.historyToggleOpen}
      </button>

      {/* ── 履歴パネル本体 ── */}
      <div
        style={{
          position: 'fixed',
          top: panelTop,
          right: 0,
          bottom: panelBottom, // ← 入力エリアに被らない
          width: '320px',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(12,6,28,0.96)',
          borderLeft: '1px solid rgba(160,120,220,0.4)',
          boxShadow: '-4px 0 24px rgba(100,50,180,0.25)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
        }}
      >
        {/* ヘッダー */}
        <div
          style={{
            padding: '14px 16px 12px',
            borderBottom: '1px solid rgba(160,120,220,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{ color: '#c8b8e8', fontWeight: 700, fontSize: '14px', letterSpacing: '0.1em' }}>{t.historyTitle}</span>
          <span style={{ color: 'rgba(180,150,220,0.5)', fontSize: '12px' }}>{t.historyCount(history.length)}</span>
        </div>

        {/* エントリ一覧 */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 0',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(160,120,220,0.3) transparent',
          }}
        >
          {history.length === 0 ? (
            <p style={{ color: 'rgba(180,150,220,0.4)', textAlign: 'center', fontSize: '13px', marginTop: '40px' }}>{t.historyEmpty}</p>
          ) : (
            history.map((entry: HistoryEntry) => (
              <div
                key={entry.id}
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid rgba(160,120,220,0.1)',
                }}
              >
                {/* タイムスタンプのみ */}
                <div style={{ marginBottom: '5px' }}>
                  <span style={{ color: 'rgba(180,150,220,0.45)', fontSize: '11px' }}>{formatTime(entry.timestamp)}</span>
                </div>

                {/* ユーザー入力バブル */}
                <div
                  style={{
                    backgroundColor: 'rgba(80,50,120,0.35)',
                    borderRadius: '4px 14px 14px 14px',
                    padding: '6px 10px',
                    marginBottom: '6px',
                    color: '#e0d0ff',
                    fontSize: '13px',
                    lineHeight: '1.55',
                    wordBreak: 'break-all',
                  }}
                >
                  {/* 吹き出しヘッダー: "あなた" */}
                  <span style={{ color: 'rgba(180,150,220,0.55)', fontSize: '10px', display: 'block', marginBottom: '3px' }}>
                    {t.historyYou}
                  </span>
                  {entry.userMessage}
                </div>

                {/* AI返答バブル（pending中はローディング表示） */}
                <div
                  style={{
                    backgroundColor: entry.pending ? 'rgba(40,24,70,0.4)' : (EMOTION_BG[entry.emotion] ?? 'rgba(40,24,70,0.5)'),
                    borderRadius: '14px 4px 14px 14px',
                    padding: '6px 10px',
                    color: '#f0e8ff',
                    fontSize: '13px',
                    lineHeight: '1.55',
                    wordBreak: 'break-all',
                    transition: 'background-color 0.3s',
                  }}
                >
                  {/* 吹き出しヘッダー: スピーカー名 + 感情 */}
                  <span
                    style={{
                      fontSize: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      marginBottom: '3px',
                      color: entry.pending ? 'rgba(200,170,255,0.4)' : EMOTION_ACCENT[entry.emotion],
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{entry.speakerName}</span>
                    {!entry.pending && (
                      <span>
                        {EMOTION_EMOJI[entry.emotion]} {emotionLabel[entry.emotion]}
                      </span>
                    )}
                  </span>
                  {entry.pending ? (
                    <span style={{ color: 'rgba(200,170,255,0.4)', fontSize: '12px' }}>
                      {t.historyGenerating}
                      <span style={{ animation: 'blink 1s step-end infinite' }}>…</span>
                    </span>
                  ) : (
                    entry.replyText
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* フッター: クリアボタン */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(160,120,220,0.2)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClear}
            disabled={history.length === 0}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: history.length === 0 ? 'rgba(80,60,100,0.2)' : 'rgba(180,60,80,0.25)',
              border: `1px solid ${history.length === 0 ? 'rgba(120,100,150,0.2)' : 'rgba(220,80,100,0.4)'}`,
              borderRadius: '6px',
              color: history.length === 0 ? 'rgba(160,140,180,0.4)' : 'rgba(255,160,170,0.9)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: history.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {t.historyClear}
          </button>
        </div>
      </div>
    </>
  );
}
