import { useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import { ViewerContext } from '../features/vrmViewer/viewerContext';
import { VrmViewer } from '../compoments/vrmViewer';
import { readChatStream, SentenceBuffer, SpeechQueue, type ChatMessage } from '../../../packages/core/src/index';

type Message = ChatMessage & { id: number; state: 'complete' | 'pending' | 'stopped' | 'error' };
type SchoolSelection = { schoolCode: string; schoolName: string; studentNumber: string };
const schoolStorageKey = 'empathy-ai-companion.school';
const greeting = 'こんにちは、水野です。勉強のこと、進路のこと、学校でのちょっとした悩み。今日はどんなことを一緒に考えましょうか？';
const initial: Message[] = [{ id: 0, role: 'assistant', content: greeting, state: 'complete' }];
const topics = ['自分に合う進路を考えたい', '勉強のやる気が出ない', '学校生活のことを相談したい'];

function Icon({ name }: { name: 'chat' | 'send' | 'spark' | 'share' | 'stop' | 'arrow' | 'sound' }) {
  const paths = {
    chat: (
      <>
        <path d="M5 4h14v12H9l-4 4z" />
        <path d="M8 8h8M8 12h5" />
      </>
    ),
    send: (
      <>
        <path d="m3 10 18-7-7 18-3-8-8-3Z" />
        <path d="m11 13 10-10" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
      </>
    ),
    share: (
      <>
        <path d="M5 13v7h14v-7M12 16V3m-4 4 4-4 4 4" />
      </>
    ),
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    arrow: <path d="m8 4 8 8-8 8" />,
    sound: (
      <>
        <path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
async function request(path: string, body: unknown, signal?: AbortSignal) {
  const response = await fetch('/api/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || '通信に失敗しました。もう一度お試しください。');
  }
  return response;
}
function historyOf(messages: Message[]): ChatMessage[] {
  let size = 0;
  return messages
    .filter((m) => m.state === 'complete' && m.content)
    .slice(-16)
    .reverse()
    .filter((m) => {
      size += m.content.length;
      return size <= 28000;
    })
    .reverse()
    .map(({ role, content }) => ({ role, content: content.slice(0, 5000) }));
}

export default function Studio() {
  const { viewer } = useContext(ViewerContext);
  const [messages, setMessages] = useState<Message[]>(initial);
  const [input, setInput] = useState('');
  const [audio, setAudio] = useState(true);
  const [subtitles, setSubtitles] = useState(true);
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ready, setReady] = useState(false);
  const [caption, setCaption] = useState(greeting);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [ended, setEnded] = useState(false);
  const [school, setSchool] = useState<SchoolSelection | null>(null);
  const [schoolReady, setSchoolReady] = useState(false);
  const [schoolDialogOpen, setSchoolDialogOpen] = useState(false);
  const [schoolCode, setSchoolCode] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [schoolError, setSchoolError] = useState('');
  const audioEnabled = useRef(true);
  const active = useRef<AbortController | null>(null);
  const summarizing = useRef<AbortController | null>(null);
  const speech = useRef<SpeechQueue | null>(null);
  const nextId = useRef(1);
  const list = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(schoolStorageKey);
      if (saved) {
        const selected = JSON.parse(saved) as SchoolSelection;
        if (!selected.schoolCode || !selected.schoolName) throw new Error('Invalid school selection.');
        setSchool(selected);
      }
    } catch {
      localStorage.removeItem(schoolStorageKey);
    } finally {
      setSchoolReady(true);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => {
      setReady(!!viewer.model?.vrm && !viewer.error);
      if (viewer.error) setError(viewer.error);
    }, 300);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      active.current?.abort();
      summarizing.current?.abort();
      speech.current?.cancel();
    };
  }, [viewer]);
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    viewer.model?.setThinking(thinking);
    return () => viewer.model?.setThinking(false);
  }, [viewer, ready, thinking]);

  function stop() {
    setThinking(false);
    viewer.model?.setThinking(false);
    active.current?.abort();
    speech.current?.cancel();
    speech.current = null;
    viewer.model?.stopSpeaking();
    setSpeaking(false);
  }
  function toggleAudio() {
    audioEnabled.current = !audioEnabled.current;
    setAudio(audioEnabled.current);
    if (!audioEnabled.current) {
      speech.current?.cancel();
      speech.current = null;
      viewer.model?.stopSpeaking();
      setSpeaking(false);
    } else {
      void viewer.model?.resumeAudio().catch(() => setError('音声を有効にできませんでした。もう一度お試しください。'));
    }
  }
  function makeSpeech() {
    return new SpeechQueue({
      synthesize: async (text, signal) => (await request('voicevox/speech', { text }, signal)).arrayBuffer(),
      play: async (buffer, text) => {
        const model = viewer.model;
        if (!model?.vrm) throw new Error('キャラクターの読み込みが完了していません。');
        if (!mounted.current) return;
        setSpeaking(true);
        setCaption(text);
        try {
          await model.speak(buffer, 'relaxed');
        } finally {
          if (mounted.current) setSpeaking(false);
        }
      },
      stop: () => viewer.model?.stopSpeaking(),
      onError: (e) => {
        if (mounted.current)
          setError('音声を再生できませんでした。回答はチャットで確認できます。 ' + (e instanceof Error ? e.message : ''));
      },
    });
  }
  async function send(text = input) {
    text = text.trim();
    if (!text || text.length > 2000 || active.current || ended) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setThinking(true);
    setError('');
    setNotice('');
    setSummary('');
    summarizing.current?.abort();
    const userId = nextId.current++,
      answerId = nextId.current++;
    const history = historyOf(messages);
    setMessages((old) => [
      ...old,
      { id: userId, role: 'user', content: text, state: 'complete' },
      { id: answerId, role: 'assistant', content: '', state: 'pending' },
    ]);
    setInput('');
    // Unlock Web Audio within the user's send gesture.
    const audioReady =
      audioEnabled.current && viewer.model?.vrm
        ? viewer.model.resumeAudio().catch(() => {
            if (mounted.current) setError('音声を開始できませんでした。回答はチャットで確認できます。');
          })
        : Promise.resolve();
    if (audioEnabled.current && !viewer.model?.vrm) setNotice('キャラクターを準備中です。回答はテキストで表示します。');
    const sentences = new SentenceBuffer(100);
    const enqueue = (parts: string[]) => {
      if (!audioEnabled.current || !viewer.model?.vrm || controller.signal.aborted) return;
      speech.current ??= makeSpeech();
      parts.forEach((part) => speech.current?.enqueue(part));
    };
    let output = '';
    let completed = false;
    try {
      await audioReady;
      const response = await request(
        'orca/chat',
        { message: text, history, stream: true, schoolCode: school?.schoolCode, studentNumber: school?.studentNumber },
        controller.signal,
      );
      for await (const event of readChatStream(response, controller.signal)) {
        if (event.type === 'error') throw new Error(event.message);
        if (event.type === 'delta') {
          if (event.text.trim()) setThinking(false);
          output += event.text;
          if (output.length > 12000) throw new Error('回答が長くなったため停止しました。');
          setMessages((old) => old.map((m) => (m.id === answerId ? { ...m, content: output } : m)));
          if (!audioEnabled.current) setCaption(output);
          enqueue(sentences.push(event.text));
        }
        if (event.type === 'done') completed = true;
      }
      enqueue(sentences.flush());
      if (!output.trim()) throw new Error('回答を受け取れませんでした。もう一度送信してください。');
      setMessages((old) => old.map((m) => (m.id === answerId ? { ...m, state: 'complete' } : m)));
      await speech.current?.finish();
    } catch (e) {
      speech.current?.cancel();
      if (mounted.current) {
        setMessages((old) =>
          old.map((m) =>
            m.id === answerId ? { ...m, state: completed ? 'complete' : controller.signal.aborted ? 'stopped' : 'error' } : m,
          ),
        );
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '回答を取得できませんでした。');
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        speech.current = null;
        if (mounted.current) {
          setThinking(false);
          setBusy(false);
          setSpeaking(false);
        }
      }
    }
  }
  async function summarize() {
    if (summaryBusy || busy || !messages.some((m) => m.role === 'user')) return;
    const controller = new AbortController();
    summarizing.current = controller;
    setSummaryBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await request(
        'orca/chat',
        {
          message:
            'ここまでの相談を、本人が先生へ共有できるように、相談したこと・気持ち・次の一歩の順で150文字程度にまとめてください。会話にない内容は加えないでください。',
          history: historyOf(messages),
          stream: false,
          schoolCode: school?.schoolCode,
          studentNumber: school?.studentNumber,
        },
        controller.signal,
      );
      const data = await response.json();
      if (!controller.signal.aborted) setSummary(data.answer || 'まとめを作成できませんでした。');
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'まとめを作成できませんでした。');
    } finally {
      if (summarizing.current === controller) {
        summarizing.current = null;
        if (mounted.current) setSummaryBusy(false);
      }
    }
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(summary);
      setNotice('まとめをコピーしました。内容を確認して、先生への連絡に貼り付けてください。');
    } catch {
      setNotice('コピーできませんでした。まとめの文章を選択してコピーしてください。');
    }
  }
  function end() {
    stop();
    summarizing.current?.abort();
    setEnded(true);
  }
  function restart() {
    setMessages(initial);
    setCaption(greeting);
    setSummary('');
    setError('');
    setNotice('');
    setEnded(false);
  }

  function resetConversationForSchoolChange() {
    stop();
    summarizing.current?.abort();
    setMessages(initial);
    setCaption(greeting);
    setSummary('');
    setEnded(false);
  }
  function openSchoolDialog() {
    setSchoolCode(school?.schoolCode ?? '');
    setStudentNumber(school?.studentNumber ?? '');
    setSchoolError('');
    setSchoolDialogOpen(true);
  }
  async function selectSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSchoolError('');
    try {
      const response = await request('school-context/select', { schoolCode, studentNumber });
      const data = await response.json();
      const selected = { schoolCode: data.school.code, schoolName: data.school.name, studentNumber: data.studentNumber || '' };
      if (school?.schoolCode !== selected.schoolCode || school?.studentNumber !== selected.studentNumber)
        resetConversationForSchoolChange();
      localStorage.setItem(schoolStorageKey, JSON.stringify(selected));
      setSchool(selected);
      setSchoolCode(selected.schoolCode);
      setStudentNumber(selected.studentNumber);
      setSchoolDialogOpen(false);
      setNotice('学校情報を設定しました。これ以降の回答に学校情報を反映します。');
    } catch (cause) {
      setSchoolError(cause instanceof Error ? cause.message : '学校情報を確認できませんでした。');
    }
  }
  function clearSchool() {
    if (school) resetConversationForSchoolChange();
    localStorage.removeItem(schoolStorageKey);
    setSchool(null);
    setSchoolCode('');
    setStudentNumber('');
    setSchoolError('');
    setSchoolDialogOpen(false);
    setNotice('学校情報を解除しました。一般的な相談として回答します。');
  }
  if (!schoolReady) return null;

  return (
    <div className="counsel-app">
      <header className="app-header">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Icon name="chat" />
          </span>
          <h1>よりそいAI相談室</h1>
        </a>
        <div className="header-actions">
          <div className="school-context-summary">
            <span className="selected-school">
              {school ? school.schoolName + (school.studentNumber ? ' / ' + school.studentNumber : '') : '学校情報なし'}
            </span>
            <button type="button" className="school-context-button" onClick={openSchoolDialog}>
              {school ? '学校情報を変更' : '学校・学籍番号を設定'}
            </button>
          </div>
          <label className="toggle-label">
            <span>音声</span>
            <button type="button" className="switch" role="switch" aria-checked={audio} aria-label="音声" onClick={toggleAudio}>
              <span />
            </button>
          </label>
          <label className="toggle-label">
            <span>字幕</span>
            <button
              type="button"
              className="switch"
              role="switch"
              aria-checked={subtitles}
              aria-label="字幕"
              onClick={() => setSubtitles(!subtitles)}
            >
              <span />
            </button>
          </label>
          <button className="end-button" onClick={end} disabled={ended}>
            相談を終了
          </button>
        </div>
      </header>

      {schoolDialogOpen && (
        <div className="school-dialog-backdrop" onMouseDown={() => setSchoolDialogOpen(false)}>
          <section
            className="school-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="school-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="school-dialog-heading">
              <div>
                <span>PERSONALIZE YOUR SUPPORT</span>
                <h2 id="school-dialog-title">学校・学生情報</h2>
              </div>
              <button type="button" aria-label="閉じる" onClick={() => setSchoolDialogOpen(false)}>
                ×
              </button>
            </div>
            <p>
              学校コードを設定すると、登録された時間割・施設・規則などを回答に反映します。学籍番号を入力すると、個人の履修・課題・出欠も参照します。
            </p>
            <form onSubmit={selectSchool}>
              <label>
                学校コード
                <input required autoFocus autoComplete="off" value={schoolCode} onChange={(event) => setSchoolCode(event.target.value)} />
              </label>
              <label>
                学籍番号（任意）
                <input autoComplete="off" value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} />
              </label>
              {schoolError && <p className="feedback error">{schoolError}</p>}
              <div className="school-dialog-actions">
                <button className="school-dialog-save">設定する</button>
                <button type="button" onClick={() => setSchoolDialogOpen(false)}>
                  キャンセル
                </button>
                {school && (
                  <button type="button" className="school-dialog-clear" onClick={clearSchool}>
                    学校情報を解除
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      )}

      <main className="counsel-layout">
        <section className="character-stage" aria-label="AI相談アシスタント">
          <div className="stage-top">
            <span className="character-tag">
              <i />
              AI相談アシスタント 水野先生
            </span>
            <div className="stage-tags">
              <span>表情：{thinking ? '考え中' : speaking ? 'やさしい笑顔' : 'おだやか'}</span>
              <span>モーション：{thinking ? '首をかしげて考え中' : speaking ? 'お話し中' : '待機中'}</span>
            </div>
          </div>
          <VrmViewer />
          {!ready && <p className="model-loading">{viewer.error ? 'キャラクターを表示できませんでした' : '先生をお迎えしています…'}</p>}
          <div className="stage-intro">
            <span>YOUR SPACE TO TALK</span>
            <p>
              話すことから、
              <br />
              少しずつ。
            </p>
          </div>
          <span className="voice-credit">VOICEVOX:ずんだもん</span>
          {ended ? (
            <div className="end-card">
              <Icon name="spark" />
              <h2>お話ししてくれて、ありがとう。</h2>
              <p>また、あなたのペースで話しに来てくださいね。</p>
              <button onClick={restart} disabled={busy || summaryBusy}>
                新しい相談を始める
              </button>
            </div>
          ) : (
            subtitles && (
              <div className="subtitle">
                <span>水野先生 {speaking && <i className="speaking-dot" />}</span>
                <p>{caption}</p>
              </div>
            )
          )}
        </section>

        <aside className="conversation-panel" aria-label="相談チャット">
          <div className="conversation-heading">
            <div>
              <span className="section-eyebrow">COUNSELING ROOM</span>
              <h2>
                {ended ? '相談終了' : '相談中'}
                <i className={busy ? 'status-dot busy' : 'status-dot'} />
              </h2>
            </div>
            <span className="session-tag">あなたのペースで</span>
          </div>
          <p className="ai-note">
            <span>ⓘ</span> 本物の担任ではなく、AI相談アシスタントです。
          </p>
          <div className="message-list" ref={list} role="log" aria-label="会話履歴">
            {messages.map((m) => (
              <div key={m.id} className={'message-row ' + m.role}>
                <div className="bubble">
                  <span className="message-author">{m.role === 'assistant' ? 'AI 水野先生' : 'あなた'}</span>
                  <p>
                    {m.content ||
                      (m.state === 'pending'
                        ? '一緒に考えています…'
                        : m.state === 'stopped'
                          ? '回答を停止しました。'
                          : '回答を取得できませんでした。')}
                  </p>
                  {m.content && (m.state === 'stopped' || m.state === 'error') && <small>回答は途中までです</small>}
                </div>
              </div>
            ))}
            {messages.length === 1 && !ended && (
              <div className="suggestions">
                <p>たとえば、こんなことから</p>
                {topics.map((topic) => (
                  <button key={topic} onClick={() => void send(topic)} disabled={busy}>
                    {topic}
                    <Icon name="arrow" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="conversation-bottom">
            {(error || notice) && (
              <p className={error ? 'feedback error' : 'feedback'} role={error ? 'alert' : 'status'}>
                {error || notice}
              </p>
            )}
            <section className="summary-card">
              <div className="summary-heading">
                <Icon name="spark" />
                <h3>相談内容のまとめ</h3>
              </div>
              <p>{summary || '話したことを整理して、次の一歩につなげましょう。'}</p>
              <div className="summary-actions">
                <button onClick={() => void summarize()} disabled={busy || summaryBusy || !messages.some((m) => m.role === 'user')}>
                  {summaryBusy ? 'まとめています…' : summary ? 'まとめを更新' : '相談をまとめる'}
                </button>
                {summary && (
                  <button onClick={() => void share()}>
                    <Icon name="share" />
                    コピーして共有
                  </button>
                )}
              </div>
            </section>
            <form
              className="composer"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <label className="sr-only" htmlFor="message">
                相談メッセージ
              </label>
              <textarea
                id="message"
                ref={textarea}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={2000}
                disabled={busy || ended}
                placeholder={ended ? '相談は終了しました' : '話したいことを、ここに…'}
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <div className="composer-toolbar">
                <span>{input.length ? input.length + ' / 2000' : 'Enterで送信・Shift + Enterで改行'}</span>
                {busy ? (
                  <button className="send-button" type="button" onClick={stop} aria-label="回答と読み上げを停止">
                    <Icon name="stop" />
                  </button>
                ) : (
                  <button className="send-button" type="submit" disabled={!input.trim() || ended} aria-label="メッセージを送信">
                    <Icon name="send" />
                  </button>
                )}
              </div>
            </form>
            <p className="privacy-note">共有は、あなたが内容を確認してから。</p>
          </div>
        </aside>
      </main>
    </div>
  );
}
