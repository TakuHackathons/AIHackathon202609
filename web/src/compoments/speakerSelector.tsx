import { useAtom } from 'jotai';
import { speakersAtom, selectedSpeakerAtom, selectedSpeakerNameAtom, resolveStyleName, Speaker } from '../lib/speakersAtom';
import { EmotionType } from '../features/vrmViewer/model';
import { useTranslations } from '../lib/i18n';

type Props = {
  /** 現在の感情（合成中スタイル名の表示に使う） */
  currentEmotion: EmotionType;
  /** 合成処理中かどうか（バッジのアニメーション制御） */
  isProcessing: boolean;
};

const EMOTION_COLOR: Record<EmotionType, string> = {
  neutral: 'rgba(140,110,200,0.18)',
  happy: 'rgba(200,150,20,0.15)',
  angry: 'rgba(200,50,60,0.15)',
  sad: 'rgba(40,120,220,0.15)',
  relaxed: 'rgba(20,160,100,0.15)',
};

const EMOTION_BORDER: Record<EmotionType, string> = {
  neutral: 'rgba(100,70,170,0.5)',
  happy: 'rgba(160,110,0,0.5)',
  angry: 'rgba(160,30,40,0.5)',
  sad: 'rgba(20,90,180,0.5)',
  relaxed: 'rgba(10,120,70,0.5)',
};

const EMOTION_TEXT: Record<EmotionType, string> = {
  neutral: '#5a3d8a',
  happy: '#8a6200',
  angry: '#a01820',
  sad: '#1a4e8a',
  relaxed: '#1a6e4a',
};

export function SpeakerSelector({ currentEmotion, isProcessing }: Props) {
  const t = useTranslations();
  const emotionLabel: Record<EmotionType, string> = {
    neutral: t.emotionNeutral,
    happy: t.emotionHappy,
    angry: t.emotionAngry,
    sad: t.emotionSad,
    relaxed: t.emotionRelaxed,
  };
  const [speakers] = useAtom(speakersAtom);
  const [selectedSpeaker, setSelectedSpeaker] = useAtom(selectedSpeakerAtom);
  const [, setSelectedSpeakerName] = useAtom(selectedSpeakerNameAtom);

  if (!speakers || speakers.length === 0) return null;

  const onSpeakerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const speaker = speakers.find((s: Speaker) => s.name === e.target.value) ?? null;
    setSelectedSpeaker(speaker);
    if (speaker) setSelectedSpeakerName(speaker.name);
  };

  // 現在の感情で実際に使われるスタイル名を表示用に解決
  const currentStyleName = selectedSpeaker ? resolveStyleName(selectedSpeaker, currentEmotion) : null;

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
      {/* キャラクター選択（スタイルは表示しない） */}
      <select style={selectStyle} value={selectedSpeaker?.name ?? ''} onChange={onSpeakerChange}>
        {speakers.map((s: Speaker) => (
          <option key={s.speaker_uuid} value={s.name}>
            {s.name}
          </option>
        ))}
      </select>

      {/* 現在の感情 + 合成に使われるスタイル名バッジ */}
      {currentStyleName && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: EMOTION_COLOR[currentEmotion],
            border: `1px solid ${EMOTION_BORDER[currentEmotion]}`,
            borderRadius: '20px',
            padding: '3px 10px',
            fontSize: '12px',
            fontWeight: 600,
            color: EMOTION_TEXT[currentEmotion],
            transition: 'all 0.3s ease',
            opacity: isProcessing ? 1 : 0.7,
          }}
        >
          {/* 処理中はドット点滅、それ以外は感情ラベル */}
          {isProcessing && (
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: EMOTION_TEXT[currentEmotion],
                animation: 'blink 1s step-end infinite',
              }}
            />
          )}
          <span>{emotionLabel[currentEmotion]}</span>
          <span style={{ opacity: 0.6 }}>／</span>
          <span>{currentStyleName}</span>
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  backgroundColor: 'rgba(30, 18, 50, 0.85)',
  color: '#e8d9f5',
  border: '1px solid rgba(180, 140, 220, 0.6)',
  borderRadius: '6px',
  padding: '4px 8px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  outline: 'none',
};
