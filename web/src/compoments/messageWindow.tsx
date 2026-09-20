import { useEffect, useRef } from 'react';
import { EmotionType } from '../features/vrmViewer/model';

type Props = {
  /** 表示するテキスト全文（随時追記される） */
  text: string;
  /** 現在の感情（アイコン表示に使う） */
  emotion: EmotionType;
  /** しゃべり中かどうか（テキストカーソル点滅制御） */
  isProcessing: boolean;
};

const EMOTION_EMOJI: Record<EmotionType, string> = {
  neutral: '😐',
  happy: '😊',
  angry: '😠',
  sad: '😢',
  relaxed: '😌',
};

const EMOTION_COLOR: Record<EmotionType, string> = {
  neutral: '#c8b8e8',
  happy: '#f9d56e',
  angry: '#f97070',
  sad: '#7ab0e8',
  relaxed: '#88e0b0',
};

export function MessageWindow({ text, emotion, isProcessing }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // テキストが増えるたびに末尾へスクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [text]);

  if (!text && !isProcessing) return null;

  const accentColor = EMOTION_COLOR[emotion] ?? EMOTION_COLOR.neutral;

  return (
    <div style={outerStyle}>
      {/* ── 装飾コーナー（四隅） ── */}
      <div style={{ ...cornerStyle, top: -4, left: -4 }} />
      <div style={{ ...cornerStyle, top: -4, right: -4 }} />
      <div style={{ ...cornerStyle, bottom: -4, left: -4 }} />
      <div style={{ ...cornerStyle, bottom: -4, right: -4 }} />

      {/* ── 上部タイトルバー ── */}
      <div style={{ ...titleBarStyle, borderColor: accentColor, color: accentColor }}>
        <span style={{ fontSize: '16px', lineHeight: 1 }}>{EMOTION_EMOJI[emotion]}</span>
        <span style={{ fontSize: '11px', letterSpacing: '0.15em', fontWeight: 700 }}>MESSAGE</span>
        <span style={{ fontSize: '16px', lineHeight: 1 }}>{EMOTION_EMOJI[emotion]}</span>
      </div>

      {/* ── 左右の装飾ライン ── */}
      <div style={{ ...sideLineStyle, left: 0, background: `linear-gradient(to bottom, transparent, ${accentColor}55, transparent)` }} />
      <div style={{ ...sideLineStyle, right: 0, background: `linear-gradient(to bottom, transparent, ${accentColor}55, transparent)` }} />

      {/* ── テキスト本体 ── */}
      <div ref={scrollRef} style={textAreaStyle}>
        <span style={{ color: '#f0e8ff', fontSize: '15px', lineHeight: '1.8', letterSpacing: '0.05em', wordBreak: 'break-all' }}>
          {text}
        </span>
        {/* テキストカーソル */}
        {isProcessing && <span style={cursorStyle}>▼</span>}
      </div>

      {/* ── 下部デコレーション ── */}
      <div style={{ ...bottomDecoStyle, borderColor: accentColor }} />
    </div>
  );
}

// ────────────────────────────────────────────────
// スタイル定義
// ────────────────────────────────────────────────

const outerStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  minHeight: '96px',
  background: 'linear-gradient(180deg, rgba(15,8,35,0.92) 0%, rgba(25,12,55,0.95) 100%)',
  border: '2px solid rgba(160,120,220,0.7)',
  borderRadius: '4px',
  padding: '28px 20px 16px',
  boxShadow: '0 0 24px rgba(140,80,220,0.35), inset 0 0 40px rgba(80,40,140,0.3)',
  backdropFilter: 'blur(4px)',
};

const cornerStyle: React.CSSProperties = {
  position: 'absolute',
  width: '12px',
  height: '12px',
  background: 'rgba(200,160,255,0.9)',
  borderRadius: '1px',
  boxShadow: '0 0 6px rgba(180,120,255,0.8)',
};

const titleBarStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  background: 'rgba(15,8,35,0.95)',
  border: '1px solid',
  borderRadius: '0 0 6px 6px',
  padding: '2px 12px',
  whiteSpace: 'nowrap',
};

const sideLineStyle: React.CSSProperties = {
  position: 'absolute',
  top: '10%',
  width: '2px',
  height: '80%',
};

const textAreaStyle: React.CSSProperties = {
  maxHeight: '88px',
  overflowY: 'auto',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  paddingLeft: '8px',
  paddingRight: '8px',
};

const cursorStyle: React.CSSProperties = {
  display: 'inline-block',
  color: '#c8a0ff',
  fontSize: '10px',
  marginLeft: '4px',
  verticalAlign: 'middle',
  animation: 'blink 1s step-end infinite',
};

const bottomDecoStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '6px',
  left: '20px',
  right: '20px',
  height: '1px',
  borderTop: '1px solid',
  opacity: 0.4,
};
