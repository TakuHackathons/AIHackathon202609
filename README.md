# Live AI Supporter

YouTube LiveのコメントをVTuberが読み上げる配信支援ツールです。VOICEVOXで生成した音声に合わせてVRMの口を動かし、画面と音声を録画できます。サンプルキャラクターはずんだもんです。

## ローカル環境の起動

### 必要なもの

- Node.js 22.12以上（TanStack Startの開発・ビルド用）
- pnpm
- Docker（起動しておく）
- ChromeまたはEdge
- YouTube Data API v3のAPIキーと、チャットが有効な配信中の動画

音声とリップシンクだけを試す場合は、YouTubeのAPIキーと動画は不要です。

以下のコマンドは、すべてプロジェクトルートで実行します。

### 1. 依存関係をインストールする

pnpmが未インストールの場合は、先に `npm install --global pnpm@11` を実行してください。

```sh
pnpm install
```

### 2. 環境変数を設定する

`server/.dev.vars.example` をコピーして `server/.dev.vars` を作成し、次の値を設定します。既存のファイルがある場合は、その内容を編集してください。

```dotenv
VOICEVOX_API_ROOT_URL=http://127.0.0.1:50021
YOUTUBE_API_KEY=取得したAPIキー
```

APIキーは[Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com)でYouTube Data API v3を有効にし、「APIとサービス → 認証情報」で作成します。

### 3. VOICEVOXを起動する

ターミナルを3つ使います。まず**ターミナル1**でVOICEVOXのCPU版を起動します。

```sh
docker pull voicevox/voicevox_engine:cpu-latest
docker run --rm --name live-ai-supporter-voicevox -p 127.0.0.1:50021:50021 voicevox/voicevox_engine:cpu-latest
```

ブラウザで http://127.0.0.1:50021/version を開き、バージョンが表示されるまで待ちます。

### 4. バックエンドを起動する

**ターミナル2**で実行します。

```sh
pnpm dev:server
```

Webのビルド後、Honoが http://127.0.0.1:8787 で起動します。http://127.0.0.1:8787/api を開き、`"status": "ok"` が表示されれば準備完了です。

### 5. フロントエンドを起動する

**ターミナル3**で実行します。

```sh
pnpm dev:web
```

ChromeまたはEdgeで **http://localhost:3000** を開いてください。使用中は3つのターミナルを開いたままにします。

### 6. 動作を確認する

1. キャラクターの表示を待ち、「音声テスト」を押します。声が再生され、口が動くことを確認します。
2. 配信中のYouTube動画URLまたは動画IDを入力します。
3. 「録画・読み上げ開始」を押し、画面共有でこのアプリのタブを選びます。
4. YouTubeに新しいコメントを投稿し、キャラクターが読み上げることを確認します。
5. 「停止」を押し、「録画ファイルを保存」で動画をダウンロードします。

読み上げ音声は自動で録画に含まれます。録画はローカルに保存されます。

### 終了・再起動

WebとHonoは、それぞれのターミナルで `Ctrl+C` を押して停止します。VOICEVOXは次のコマンドで停止します。

```sh
docker stop live-ai-supporter-voicevox
```

次回はDockerを起動し、手順3〜5を実行してください。イメージ取得済みなら `docker pull` は省略できます。

## プロジェクト構成

| ディレクトリ | 内容 |
| --- | --- |
| `web/` | TanStack StartのSSGフロントエンド、VRM表示、音声再生、録画 |
| `server/` | HonoによるYouTube・VOICEVOX連携API |
| `packages/core/` | コメント取得・読み上げキューの共通処理 |

フロントエンドの `/api/*` リクエストはHonoへ転送されます。フロントの開発については[web/README.md](web/README.md)を参照してください。

## テスト・ビルド

```sh
pnpm lint
pnpm test
pnpm build
```

## Cloudflare Workersへのデプロイ

`web/dist/client` の静的ファイルとHono APIを、`server/wrangler.jsonc` で定義した1つのWorkerにデプロイします。

```sh
pnpm deploy:check
pnpm --filter live-ai-supporter-server exec wrangler login
pnpm --filter live-ai-supporter-server exec wrangler secret put YOUTUBE_API_KEY
pnpm --filter live-ai-supporter-server exec wrangler secret put VOICEVOX_API_ROOT_URL
pnpm deploy:cloudflare
```

本番の `VOICEVOX_API_ROOT_URL` にはCloudflareから接続できるエンジンのURLを設定してください。`server/.dev.vars` はローカル開発専用です。

## 参考

- [VOICEVOX Engine](https://github.com/VOICEVOX/voicevox_engine)
- [YouTube Live Chat API](https://developers.google.com/youtube/v3/live/docs/liveChatMessages/list)
- [TanStack Start](https://tanstack.com/start/latest/docs/framework/react/overview)

音声・キャラクター・モデルの利用には各配布元の利用条件が適用されます。画面には `VOICEVOX:ずんだもん` を表示しています。
