import Head from 'next/head';
import { useContext, useEffect, useRef, useState } from 'react';
import { VrmViewer } from '../compoments/vrmViewer';
import { ViewerContext } from '../features/vrmViewer/viewerContext';
import { LiveSession, videoIdFromInput, type CommentPage } from '../../../packages/core/src/index';
import { ScreenRecording } from '../features/live/recording';
import { buildUrl } from '../utils/buildUrl';

async function api(path: string, init?: RequestInit) {
  const response = await fetch(buildUrl('/api/live/' + path), init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'APIリクエストに失敗しました: ' + response.status);
  }
  return response;
}
export default function Home() {
  const { viewer } = useContext(ViewerContext);
  const [video, setVideo] = useState('');
  const [status, setStatus] = useState('待機中');
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [caption, setCaption] = useState('コメントが届くと、ここに表示されます。');
  const [queue, setQueue] = useState(0);
  const [dropped, setDropped] = useState(0);
  const [download, setDownload] = useState('');
  const [filename, setFilename] = useState('recording.webm');
  const session = useRef<LiveSession | null>(null);
  const recording = useRef<ScreenRecording | null>(null);
  const pending = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const stopping = useRef(false);
  const mounted = useRef(true);
  const downloadRef = useRef('');
  useEffect(() => {
    mounted.current = true;
    const id = setInterval(() => {
      setReady(!!viewer.model?.vrm && !viewer.error);
      if (viewer.error) setError(viewer.error);
    }, 250);
    const params = new URLSearchParams(location.search);
    if (params.get('video')) setVideo(params.get('video')!);
    return () => {
      mounted.current = false;
      clearInterval(id);
      pending.current?.abort();
      session.current?.stop();
      viewer.model?.stopSpeaking();
      void recording.current?.stop();
      if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
    };
  }, [viewer]);

  async function stop() {
    if (stopping.current) return;
    stopping.current = true;
    pending.current?.abort();
    session.current?.stop();
    session.current = null;
    viewer.model?.stopSpeaking();
    const current = recording.current;
    recording.current = null;
    if (mounted.current) setStatus('録画を保存しています…');
    try {
      if (current) {
        const blob = await current.stop();
        if (mounted.current) {
          if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
          const url = URL.createObjectURL(blob);
          downloadRef.current = url;
          setDownload(url);
          setFilename(
            'live-ai-supporter-' + new Date().toISOString().replace(/[:.]/g, '-') + (blob.type.includes('mp4') ? '.mp4' : '.webm'),
          );
        }
      }
    } finally {
      stopping.current = false;
      busy.current = false;
      if (mounted.current) {
        setActive(false);
        setStatus('停止しました');
      }
    }
  }
  async function start() {
    if (busy.current) return;
    busy.current = true;
    setActive(true);
    setError('');
    setDropped(0);
    const controller = new AbortController();
    pending.current = controller;
    let screen: MediaStream | undefined;
    try {
      const id = videoIdFromInput(video);
      const model = viewer.model;
      if (!model?.vrm) throw new Error('VRMの読み込み完了をお待ちください。');
      if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined')
        throw new Error('画面録画に対応したChrome / EdgeをlocalhostまたはHTTPSで開いてください。');
      // Both calls happen during the button gesture, before any network await.
      const resume = model.resumeAudio();
      const capture = navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      setStatus('録画する画面を選択してください');
      await Promise.all([
        capture.then((value) => {
          screen = value;
        }),
        resume,
      ]);
      if (!screen) throw new Error('画面を取得できませんでした。');
      if (controller.signal.aborted) {
        screen.getTracks().forEach((t) => t.stop());
        return;
      }
      setStatus('YouTubeに接続しています…');
      const resolved = (await (await api('resolve?video=' + encodeURIComponent(id), { signal: controller.signal })).json()) as {
        liveChatId: string;
        title: string;
      };
      if (controller.signal.aborted) {
        screen.getTracks().forEach((t) => t.stop());
        return;
      }
      if (screen.getVideoTracks()[0]?.readyState !== 'live') throw new Error('画面共有が終了しました。開始し直してください。');
      recording.current = new ScreenRecording(
        screen,
        model.recordingStream!,
        () => {
          void stop();
        },
        () => {
          setError('録画中にエラーが発生しました。');
          void stop();
        },
      );
      setStatus('録画・読み上げ中: ' + resolved.title);
      const live = new LiveSession({
        poll: async (token, signal) => {
          const params = new URLSearchParams({ liveChatId: resolved.liveChatId });
          if (token) params.set('pageToken', token);
          return (await api('comments?' + params, { signal })).json() as Promise<CommentPage>;
        },
        speak: async (comment, signal) => {
          const response = await api('speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: comment.text }),
            signal,
          });
          const buffer = await response.arrayBuffer();
          if (signal.aborted) return;
          setCaption(comment.author + '：' + comment.text);
          await model.speak(buffer, 'neutral');
        },
        onQueue: (length, skipped) => {
          if (mounted.current) {
            setQueue(length);
            setDropped(skipped);
          }
        },
        onError: (e) => {
          if (mounted.current) setError(e instanceof Error ? e.message : String(e));
          void stop();
        },
        onEnd: () => {
          void stop();
        },
      });
      session.current = live;
      void live.run();
    } catch (e) {
      screen?.getTracks().forEach((t) => t.stop());
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : String(e));
        await stop();
      }
    }
  }
  async function testVoice() {
    if (busy.current) return;
    busy.current = true;
    setActive(true);
    setError('');
    const controller = new AbortController();
    pending.current = controller;
    try {
      const model = viewer.model;
      if (!model?.vrm) throw new Error('VRMを読み込み中です。');
      await model.resumeAudio();
      const text = 'こんにちは！ライブコメントの読み上げテストなのだ。';
      setCaption(text);
      setStatus('音声テスト中');
      const response = await api('speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      const buffer = await response.arrayBuffer();
      if (!controller.signal.aborted) await model.speak(buffer, 'happy');
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (pending.current === controller) {
        busy.current = false;
        setActive(false);
        setStatus('待機中');
      }
    }
  }
  return (
    <>
      <Head>
        <title>Live AI Supporter</title>
        <meta name="description" content="YouTube LiveのコメントをVTuberが読み上げる配信サポートツール" />
      </Head>
      <main className="studio">
        <VrmViewer />
        <section className="controls">
          <p className="eyebrow">VTUBER LIVE ASSISTANT</p>
          <h1>Live AI Supporter</h1>
          <p>ライブの声を、キャラクターへ。</p>
          <label htmlFor="video">YouTube Live URL / 動画ID</label>
          <input
            id="video"
            value={video}
            disabled={active}
            onChange={(e) => setVideo(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
          />
          <div className="actions">
            <button onClick={() => void start()} disabled={active || !ready || !video.trim()}>
              録画・読み上げ開始
            </button>
            <button className="secondary" onClick={() => void stop()} disabled={!active}>
              停止
            </button>
            <button className="secondary" onClick={() => void testVoice()} disabled={active || !ready}>
              音声テスト
            </button>
          </div>
          <p role="status">{ready ? status : 'ずんだもんを読み込み中…'}</p>
          <p className="detail">
            待機コメント {queue}件 / 混雑時のスキップ {dropped}件
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {download && (
            <a className="download" href={download} download={filename}>
              録画ファイルを保存
            </a>
          )}
          <p className="detail">
            このタブを録画対象に選んでください。音声は自動で録音されます。
            <br />
            開始後の新着コメントを読み上げます。YouTubeへの映像送信は行いません。
          </p>
        </section>
        <section className="caption" aria-live="polite">
          <span>VOICEVOX:ずんだもん</span>
          <p>{caption}</p>
        </section>
      </main>
    </>
  );
}
