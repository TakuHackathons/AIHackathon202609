# Live AI Supporter

YouTube Liveの新着コメントをVOICEVOXで読み上げ、VRMのリップシンクと連動させて画面録画する、VTuber配信支援ツールです。初期サンプルはずんだもんです。

## 起動

pnpm、VOICEVOX Engineと、フロントをビルドするためのNode.jsを用意してください。採用したTanStack Startの依存パッケージは、ビルド環境にNode.js 22.12以上を要求します。デプロイ後は静的フロントとHonoをCloudflare Workersで配信し、Node.jsサーバーは使用しません。

1. `pnpm install`
2. VOICEVOX Engineを起動（標準: `http://127.0.0.1:50021`）。
3. `server/.dev.vars.example` を `server/.dev.vars` にコピー。既存ファイルがある場合は上書きせず、`YOUTUBE_API_KEY` と `VOICEVOX_API_ROOT_URL` を設定します。Google CloudでYouTube Data API v3を有効にしたAPIキーを使用します。キーはサーバー側だけで扱います。
4. `pnpm dev`（WebをビルドしてローカルAPI・Webサーバーを起動）。
5. Chrome / Edgeで `http://127.0.0.1:8787` を開きます。
6. 「音声テスト」でVOICEVOX・VRMの口の動きを確認します。
7. 配信中のYouTube動画URLまたは動画IDを入力し「録画・読み上げ開始」。画面共有の選択でこのアプリのタブを選びます。
8. 「停止」またはブラウザの共有終了で録画を終了し「録画ファイルを保存」でダウンロードします。

画面共有の許可にはブラウザでのクリックが必要です。音声はアプリ内の再生音を録画に直接追加するため、「タブの音声を共有」は不要です。マイクや他アプリの音は録音しません。

## 今回の範囲

- Webのボタンからスクリーンレコードとコメント読み上げを開始・停止。
- YouTube Liveの `activeLiveChatId` を解決し、API指定の `pollingIntervalMillis` を守ってコメントを継続取得。
- 開始前の履歴は読み上げず、新着のテキストコメント・Super Chat本文を取得順に読み上げ。最大500文字。
- 最大50件の待機キュー。混雑時には古い待機コメントを除外し、件数を表示。
- サンプルのVRMはずんだもんのみ。VOICEVOXはずんだもん・ノーマル（スタイルID 3）。待機アニメーション、まばたき、リップシンクを利用。
- 通信や音声合成の失敗、配信終了時は処理を停止し、途中までの録画を保存可能にします。再接続は手動で開始してください。
- 録画データは停止までメモリ上に保持するため、短時間の試作検証向けです。長時間運用ではファイルへの逐次保存が必要です。

**YouTubeへの映像送信・配信枠の作成や開始、録画済みYouTube動画のコメント再生は未実装です。** YouTube側で配信中の動画に接続し、ローカルに画面を録画します。LLMによる返答生成は今回の読み上げ経路では使用しません。

## 構成

- `packages/core`: UI・実行環境に依存しないセッション、コメント型、URL解析、キュー処理。取得と音声再生はポートとして注入するため、CLIや別UIで再利用可能。
- `server/src/routes/live.ts`: YouTube / VOICEVOXアダプターとHTTP API。
- `web/src/routes`, `web/src/router.tsx`: TanStack StartのルートとSSG用のHTML構成。
- `web/src/features/live`: ブラウザの画面録画アダプター。
- `web/src/features/vrmViewer`, `lipSync`: VRM表示・音声再生。
- `web/src/screens/Studio.tsx`: 現在の操作UI。CLI自体は未実装です。
- 既存のGroq/Geminiルートは将来のAI応答向けに保持しています（この機能にはキー不要）。

API:
- `GET /api/live/resolve?video=<URLまたはID>`
- `GET /api/live/comments?liveChatId=...&pageToken=...`
- `POST /api/live/speech` JSON: `{"text":"こんにちは"}` → WAV

開発用Web単体の `pnpm dev:web` はAPIをローカル8787番へ転送します。別ターミナルで `pnpm dev` を起動してください。通常は8787番の統合サーバーだけで試せます。API認証は未実装です。


## Cloudflare Workersへのデプロイ

フロントとAPIは `server/wrangler.jsonc` の **live-ai-supporter** という1つのWorkerにまとめます。

- `pnpm build:web`: TanStack StartのSSGで `web/dist/client/index.html` とJS/CSS・VRMを生成。
- Workerの静的アセット: `web/dist/client`。
- `/api` と `/api/*`: 既存のHonoが処理。
- `web/dist/server`: プリレンダリング用ビルド。デプロイしません。

```sh
# 公開せず、SSG生成とWorkerのパッケージングを確認
pnpm deploy:check

# Cloudflareにログイン後、同じWorkerに設定
pnpm --filter live-ai-supporter-server exec wrangler secret put YOUTUBE_API_KEY
pnpm --filter live-ai-supporter-server exec wrangler secret put VOICEVOX_API_ROOT_URL

# フロントとHonoをまとめてデプロイ
pnpm deploy:cloudflare
```

`server/.dev.vars` はローカル用で、本番にはアップロードされません。本番の `VOICEVOX_API_ROOT_URL` はWorkerから到達できるエンジンのURLを設定してください。開発PCの `localhost:50021` はCloudflareから接続できません。既存のGroq/Gemini APIも使う場合は対応するキーも設定します。

## 検証

```sh
pnpm lint
pnpm test
pnpm build
```

実サービスでの確認にはYouTube APIキー、配信中の動画、VOICEVOX Engine、画面共有の許可が必要です。

## 参考

- [YouTube Live chat API](https://developers.google.com/youtube/v3/live/docs/liveChatMessages/list)
- [VOICEVOX Engine API](https://voicevox.github.io/voicevox_engine/api/)
- [画面共有API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)

キャラクター・音声・モデルの利用条件はそれぞれの配布元の条件に従ってください。画面には `VOICEVOX:ずんだもん` を表示します。
