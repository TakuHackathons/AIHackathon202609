# Live AI Supporter

YouTube Liveの新着コメントをVOICEVOXで読み上げ、VRMのリップシンクと連動させて画面録画する、VTuber配信支援ツールです。初期サンプルはずんだもんです。

## ローカル環境の起動手順（Windows / PowerShell）

以下のコマンドは、特記がない限り**このREADMEがあるプロジェクトルート**で実行してください。Docker版VOICEVOX、Hono、Webをそれぞれ別のPowerShellで起動します。起動したターミナルは使用中に閉じないでください。

| ターミナル | サービス | ポート | 起動コマンド |
| --- | --- | --- | --- |
| A | VOICEVOX Engine（CPU版） | 50021 | 下記の `docker run` |
| B | Hono API / SSGファイル配信 | 8787 | `pnpm dev:server` |
| C | TanStack Start / Vite（編集を即時反映） | 3000 | `pnpm dev:web` |
| D | 接続確認用 | — | `Invoke-RestMethod` など |

ブラウザからの音声リクエストは **3000番のWeb → 8787番のHono → 50021番のVOICEVOX** の順で処理されます。`pnpm dev:web` だけではHonoもVOICEVOXも起動しません。

### 1. 必要なツールを用意する（初回のみ）

- [Node.js](https://nodejs.org/ja/download)をインストールします。採用したTanStack Startは**開発・ビルド環境**にNode.js 22.12以上を要求します。Cloudflare上でNode.jsサーバーを動かすという意味ではありません。
- [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/)をインストールし、起動します。Linuxコンテナを使用してください。VOICEVOXのデスクトップ版を使う場合はDocker不要です（手順4の補足参照）。

PowerShellでバージョンとDockerの起動を確認します。

```powershell
node --version
npm --version

# pnpmが未インストールの場合だけ実行
npm install --global pnpm@11

pnpm --version
docker version
```

`docker version` でClientとServerの両方が表示されることを確認してください。Serverへの接続エラーが出る場合はDocker Desktopの起動完了を待ちます。

### 2. プロジェクトへ移動して依存関係をインストールする（初回・依存更新時）

```powershell
# 自分のチェックアウト先に置き換えてください
Set-Location 'C:\path\to\AIHackathon202609'

pnpm install
```

以降、新しいターミナルを開いた場合も、まず同じプロジェクトルートに移動してください。

### 3. サーバーの環境変数を設定する（初回・設定変更時）

既存設定を上書きしないよう、ファイルがない場合だけ作成します。

```powershell
if (-not (Test-Path -LiteralPath 'server/.dev.vars')) {
    Copy-Item -LiteralPath 'server/.dev.vars.example' -Destination 'server/.dev.vars'
}

notepad server/.dev.vars
```

エディタで以下の値を設定し、保存してください。ローカルVOICEVOXを使う場合は、既存設定が別のURLを指していないかも確認します。

```dotenv
VOICEVOX_API_ROOT_URL=http://127.0.0.1:50021
YOUTUBE_API_KEY=取得したYouTube_Data_API_v3のAPIキー
```

YouTubeのAPIキーは[Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com)でYouTube Data API v3を有効化し、「APIとサービス → 認証情報」で作成します。キーは `server/.dev.vars` にだけ設定します。**「音声テスト」だけならYouTube APIキーは不要**です。Groq/Geminiのキーも今回のコメント読み上げには不要です。

`server/.dev.vars` を変更した場合は、ターミナルBのHonoを `Ctrl+C` で停止して起動し直してください。

### 4. VOICEVOX Engineを起動する（ターミナルA）

初回のみイメージを取得します。

```powershell
docker pull voicevox/voicevox_engine:cpu-latest
```

続いて起動します。GPUは不要です。このターミナルは開いたままにします。

```powershell
docker run --rm --name live-ai-supporter-voicevox -p 127.0.0.1:50021:50021 voicevox/voicevox_engine:cpu-latest
```

初回はダウンロード・エンジン初期化に時間がかかります。別のPowerShell（ターミナルD）から確認してください。

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:50021/version'
```

バージョン文字列が返れば起動完了です。APIの画面は `http://127.0.0.1:50021/docs` で開けます。このDockerコマンドは[VOICEVOX Engine公式の起動方法](https://github.com/VOICEVOX/voicevox_engine#docker-イメージ)に基づいています。

**Dockerを使わない場合:** [VOICEVOXデスクトップ版](https://voicevox.hiroshiba.jp/)をインストールし、スタートメニューから起動してください。エディタと一緒にエンジンも起動します。起動後は同じ `/version` の確認コマンドを実行します。この場合、上記の `docker pull` / `docker run` は実行せず、VOICEVOXアプリを開いたままにしてください。両方を同時に起動すると50021番が競合します。

### 5. Honoバックエンドを起動する（ターミナルB）

プロジェクトルートで実行し、ターミナルを開いたままにします。

```powershell
pnpm dev:server
```

このコマンドは `pnpm build:web` でSSGファイルを生成してから、WranglerでHonoを起動します。`Ready on http://127.0.0.1:8787` と表示されるまで待ってください。ローカル開発にCloudflareへのログインは不要です。

ターミナルDから確認します。

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api'
```

`status: ok` が返ればHonoは起動しています。SSGファイルを生成済みで再ビルドが不要な場合だけ、代わりに `pnpm --filter live-ai-supporter-server dev` でも起動できます。初回はアセット不足を避けるため `pnpm dev:server` を使ってください。

### 6. Webフロントエンドを起動する（ターミナルC）

プロジェクトルートで実行し、ターミナルを開いたままにします。

```powershell
pnpm dev:web
```

起動後、Chrome / Edgeで **http://localhost:3000** を開きます。`http://127.0.0.1:3000` でもアクセスできます。ソースの編集はViteが反映します。`/api/*` は8787番のHonoへ転送されます。

### 7. 音声と録画を確認する

1. ブラウザでVRMの読み込み完了を待ち、「音声テスト」を押します。ずんだもんの声と口の動きを確認してください。
2. YouTube側で配信中・チャット有効な動画のURLまたは動画IDを入力します。
3. 「録画・読み上げ開始」を押し、画面共有の選択でこのアプリのタブを選びます。
4. YouTubeに新しいコメントを投稿し、読み上げを確認します。開始前のコメント履歴は読み上げません。
5. 「停止」を押し、「録画ファイルを保存」でダウンロードします。

画面共有の許可にはブラウザでのクリックが必要です。音声はアプリ内の再生音を録画に直接追加するため、「タブの音声を共有」は不要です。マイクや他アプリの音は録音しません。

ブラウザ操作前に音声APIだけ確認する場合は、ターミナルDで以下を実行します。生成したWAVは一時フォルダーへ保存します。

```powershell
$speechBody = @{ text = 'こんにちは。音声テストなのだ。' } | ConvertTo-Json -Compress
$speechBytes = [System.Text.Encoding]::UTF8.GetBytes($speechBody)
$voiceTestFile = Join-Path ([System.IO.Path]::GetTempPath()) 'live-ai-supporter-voice-test.wav'

Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/api/live/speech' -Method Post -ContentType 'application/json; charset=utf-8' -Body $speechBytes -OutFile $voiceTestFile

# 保存した音声を既定のプレーヤーで再生
Invoke-Item -LiteralPath $voiceTestFile
```

### 8. 終了と次回の起動

録画中なら先にブラウザの「停止」とファイル保存を行います。そのあと、ターミナルCとBをそれぞれ `Ctrl+C` で停止します。Docker版VOICEVOXは別ターミナルで停止します。

```powershell
docker stop live-ai-supporter-voicevox
```

`--rm` 付きで起動しているため、停止時にコンテナは削除されます。ダウンロード済みイメージは残ります。デスクトップ版を使った場合はVOICEVOXアプリを終了します。

次回はDocker Desktopを起動し、以下の順で実行します。設定変更がなければコピーやキー入力は不要です。

```powershell
# ターミナルA: VOICEVOX（デスクトップ版の場合はアプリを起動）
docker run --rm --name live-ai-supporter-voicevox -p 127.0.0.1:50021:50021 voicevox/voicevox_engine:cpu-latest

# ターミナルB: プロジェクトルートで実行
pnpm dev:server

# ターミナルC: プロジェクトルートで実行
pnpm dev:web
```

上の3つは**同じターミナルにまとめて貼らず、それぞれ別のターミナルで実行**してください。

### SSGの配信状態だけ確認する場合

手順1〜5まで行い、`http://127.0.0.1:8787` を開きます。手順6のViteは不要です。HonoがAPIを処理し、同じWorkerがSSGファイルを配信する本番相当の構成です。`pnpm dev` は `pnpm dev:server` の別名であり、3000番のViteやVOICEVOXを同時起動するコマンドではありません。

### 接続エラーの切り分け

| 症状 | 確認・対処 |
| --- | --- |
| 3000番の `/api/live/speech` が502 | まず `Invoke-RestMethod http://127.0.0.1:8787/api` を実行。接続できなければターミナルBでHonoを起動します。 |
| Honoは動くが音声APIが502 | `Invoke-RestMethod http://127.0.0.1:50021/version` を実行。VOICEVOXの起動と `VOICEVOX_API_ROOT_URL` を確認します。 |
| YouTube接続時に503 | `server/.dev.vars` の `YOUTUBE_API_KEY` を設定し、Honoを再起動します。 |
| `web/dist/client` が見つからない | `pnpm dev:server` でSSGをビルドしてから起動します。 |
| Dockerコンテナ名が使用済み | `docker ps -a --filter name=live-ai-supporter-voicevox` で確認。起動中ならそのまま使用します。停止して作り直すなら `docker stop live-ai-supporter-voicevox` の後で手順4を実行します。 |
| 50021番が使用済み | VOICEVOXデスクトップ版とDocker版のどちらか一方だけを起動します。 |
| 3000番・8787番が使用済み | 既存の開発サーバーのターミナルを確認し、不要な方を `Ctrl+C` で停止します。 |

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
