'use client';

import { useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAtom } from 'jotai';
import { VrmViewer } from '../compoments/vrmViewer';
import { ViewerContext } from '../features/vrmViewer/viewerContext';
import { IconButton } from '../compoments/iconButton';
import { SpeakerSelector } from '../compoments/speakerSelector';
import { MessageWindow } from '../compoments/messageWindow';
import { HistoryPanel } from '../compoments/historyPanel';
import { VrmSelector } from '../compoments/vrmSelector';
import { BackgroundSelector } from '../compoments/backgroundSelector';
import { AiProviderSelector } from '../compoments/aiProviderSelector';
import { LocaleToggle } from '../compoments/localeToggle';
import { loadSpeackers, speakCharacterStream } from '../features/speak-character';
import { speakersAtom, selectedSpeakerAtom, selectedSpeakerNameAtom } from '../lib/speakersAtom';
import { historyAtom } from '../lib/historyAtom';
import { aiProviderAtom, getApiPath } from '../lib/aiProviderAtom';
import { localeAtom, useTranslations } from '../lib/i18n';
import { EmotionType } from '../features/vrmViewer/model';

export default function Home() {
  const { viewer } = useContext(ViewerContext);

  const [speakers, setSpeakers] = useAtom(speakersAtom);
  const [selectedSpeaker, setSelectedSpeaker] = useAtom(selectedSpeakerAtom);
  const [selectedSpeakerName] = useAtom(selectedSpeakerNameAtom);
  const [, setHistory] = useAtom(historyAtom);
  const [aiProvider] = useAtom(aiProviderAtom);
  const [locale] = useAtom(localeAtom);
  const t = useTranslations();

  const [userMessage, setUserMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>('neutral');
  const [backgroundUrl, setBackgroundUrl] = useState<string>('');

  // 入力エリアの高さを計測して HistoryPanel に渡す
  const inputAreaRef = useRef<HTMLDivElement>(null);
  const [inputAreaHeight, setInputAreaHeight] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ResizeObserver で入力エリア高さを追跡
  useEffect(() => {
    const el = inputAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setInputAreaHeight(el.offsetHeight);
    });
    ro.observe(el);
    setInputAreaHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    (async () => {
      const speakerList = speakers ?? (await loadSpeackers());
      if (!speakers) setSpeakers(speakerList);
      // localStorage に保存済みの名前があれば復元、なければ「ずんだもん」→先頭
      const defaultSpeaker =
        (selectedSpeakerName ? speakerList.find((s: any) => s.name === selectedSpeakerName) : null) ??
        speakerList.find((s: any) => s.name === 'ずんだもん') ??
        speakerList[0] ??
        null;
      setSelectedSpeaker(defaultSpeaker);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // textarea 高さ自動調整
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [userMessage]);

  const onSendClick = useCallback(async () => {
    if (!selectedSpeaker || !userMessage.trim() || isProcessing) return;

    const sentMessage = userMessage.trim();
    const entryId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setIsProcessing(true);
    setMessageText('');
    setCurrentEmotion('neutral');
    setUserMessage('');

    // ── 「あなた」側を pending 状態で即座に履歴に追加 ──
    setHistory((prev) => [
      ...prev,
      {
        id: entryId,
        timestamp: Date.now(),
        userMessage: sentMessage,
        speakerName: selectedSpeaker.name,
        emotion: 'neutral',
        replyText: '',
        pending: true,
      },
    ]);

    let fullReply = '';
    let finalEmotion: EmotionType = 'neutral';

    try {
      const groqChatResponse = await fetch(getApiPath(aiProvider), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: sentMessage, locale }),
      });

      if (!groqChatResponse.ok) {
        console.error(`${aiProvider} API error:`, groqChatResponse.status, await groqChatResponse.text());
        // エラー時は pending エントリを削除
        setHistory((prev) => prev.filter((e) => e.id !== entryId));
        return;
      }

      await speakCharacterStream(
        selectedSpeaker,
        groqChatResponse,
        viewer,
        (emotion) => {
          setCurrentEmotion(emotion);
          finalEmotion = emotion;
        },
        (delta) => {
          fullReply += delta;
          setMessageText((prev) => prev + delta);
        },
      );

      // ── pending エントリを完成した内容で更新 ──
      setHistory((prev) => prev.map((e) => (e.id === entryId ? { ...e, emotion: finalEmotion, replyText: fullReply, pending: false } : e)));
    } finally {
      setIsProcessing(false);
    }
  }, [selectedSpeaker, userMessage, isProcessing, viewer, setHistory]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSendClick();
    }
  };

  const onVrmChange = (url: string) => {
    viewer.loadVrm(url);
  };

  return (
    <div className="font-M_PLUS_2">
      {/* 背景画像（常に表示、backgroundUrl が空文字でなければ） */}
      {backgroundUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: -20,
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      <VrmViewer />
      <LocaleToggle />

      {/* 入力エリア高さを渡して履歴パネルが被らないようにする */}
      <HistoryPanel inputAreaHeight={inputAreaHeight} />

      {/* メッセージウィンドウ */}
      <div
        style={{
          position: 'absolute',
          bottom: inputAreaHeight + 12,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(680px, 92vw)',
          zIndex: 30,
        }}
      >
        <MessageWindow text={messageText} emotion={currentEmotion} isProcessing={isProcessing} />
      </div>

      {/* 入力エリア */}
      <div ref={inputAreaRef} style={inputAreaOuterStyle}>
        <div style={inputAreaInnerStyle}>
          {/* ツールバー: ラベル+プルダウンを横一直線に並べる */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
            <div style={selectorGroupStyle}>
              <span style={selectorLabelStyle}>{t.labelBackground}</span>
              <BackgroundSelector onBackgroundChange={setBackgroundUrl} />
            </div>
            <div style={selectorGroupStyle}>
              <span style={selectorLabelStyle}>{t.labelVrm}</span>
              <VrmSelector onVrmChange={onVrmChange} />
            </div>
            <div style={selectorGroupStyle}>
              <span style={selectorLabelStyle}>{t.labelAi}</span>
              <AiProviderSelector />
            </div>
            <div style={selectorGroupStyle}>
              <span style={selectorLabelStyle}>{t.labelVoice}</span>
              <SpeakerSelector currentEmotion={currentEmotion} isProcessing={isProcessing} />
            </div>
          </div>

          {/* 下段: テキスト入力 */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <IconButton
              iconName="24/Microphone"
              style={{ backgroundColor: 'rgb(255,97,127)', flexShrink: 0 }}
              className="bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled"
              isProcessing={isProcessing}
              disabled={isProcessing}
              onClick={onSendClick}
            />

            <textarea
              ref={textareaRef}
              placeholder={t.inputPlaceholder}
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={isProcessing}
              rows={2}
              style={textareaStyle}
            />

            <IconButton
              iconName="24/Send"
              style={{ backgroundColor: 'rgb(255,97,127)', flexShrink: 0 }}
              className="bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled"
              isProcessing={isProcessing}
              disabled={userMessage.trim().length <= 0 || isProcessing}
              onClick={onSendClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const inputAreaOuterStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 20,
  backgroundColor: 'rgb(251,226,202)',
  color: '#000000',
};

const inputAreaInnerStyle: React.CSSProperties = {
  marginLeft: 'auto',
  marginRight: 'auto',
  maxWidth: '56rem',
  padding: '10px 16px 12px',
};

const textareaStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  color: 'rgb(81,64,98)',
  fontSize: '15px',
  lineHeight: '1.6',
  fontWeight: 600,
  paddingLeft: '14px',
  paddingRight: '14px',
  paddingTop: '10px',
  paddingBottom: '10px',
  borderRadius: '12px',
  width: '100%',
  border: 'none',
  outline: 'none',
  resize: 'none',
  minHeight: '52px',
  maxHeight: '120px',
  overflowY: 'auto',
  fontFamily: 'inherit',
};

const selectorGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: '5px',
};

const selectorLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  color: 'rgb(120, 90, 60)',
  letterSpacing: '0.08em',
  paddingLeft: '2px',
};
