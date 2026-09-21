# よりそいAI相談室

学習・進路・学校生活の相談に、3Dキャラクターが応えるチャットサービスです。OrcaRouterから届く回答を表示しながら、文ごとにVOICEVOXで音声を生成して順番に再生します。キャラクターは音声に合わせて口を動かします。サンプルモデル・音声はずんだもんです。

## ローカル環境の起動

Node.js（使用するViteに対応したバージョン）、pnpm、Dockerを用意し、Dockerを起動してください。AIへの接続にはOrcaRouterのAPIキーが必要です。以下はすべてプロジェクトルートで実行します。

### 1. 依存関係をインストールする

pnpmが未インストールの場合は、先に `npm install --global pnpm@11` を実行します。

```sh
pnpm install
```

### 2. 環境変数を設定する

`server/.dev.vars.example` をコピーして `server/.dev.vars` を作り、次の値を設定します。既存ファイルがある場合は編集してください。

```dotenv
VOICEVOX_API_ROOT_URL=http://127.0.0.1:50021
ORCAROUTER_API_KEY=取得したAPIキー
ORCAROUTER_MODEL=openai/gpt-5
ORCAROUTER_BASE_URL=https://api.orcarouter.ai/v1
```

モデルにはOrcaRouterで利用できるResponses API対応モデルを指定します。APIキーはフロントエンドには設定しません。

### 3. VOICEVOXを起動する

ターミナルを3つ使います。**ターミナル1**でCPU版エンジンを起動します。

```sh
docker pull voicevox/voicevox_engine:cpu-latest
docker run --rm --name live-ai-supporter-voicevox -p 127.0.0.1:50021:50021 voicevox/voicevox_engine:cpu-latest
```

http://127.0.0.1:50021/version を開き、バージョンが表示されるまで待ちます。

### 4. バックエンドを起動する

**ターミナル2**で実行します。

```sh
pnpm dev:server
```

Webのビルド後、Honoが http://127.0.0.1:8787 で起動します。http://127.0.0.1:8787/api で `"status": "ok"` を確認できます。

### 5. フロントエンドを起動する

**ターミナル3**で実行します。

```sh
pnpm dev:web
```

ブラウザで **http://localhost:3000** を開きます。使用中は3つのターミナルを開いたままにしてください。

### 6. 相談して動作を確認する

1. キャラクターの表示を待ち、入力欄に「勉強の計画を一緒に考えて」と入力して送信します。
2. 回答が順次表示され、キャラクターが読み上げながら口を動かすことを確認します。
3. 続けて質問すると、それまでの会話を踏まえた回答が届きます。
4. 音声・字幕は画面上部で切り替えられます。回答中の停止ボタンで生成と再生を止められます。
5. 「相談をまとめる」で要約を作り、コピーして共有できます。

会話は現在の画面内で保持します。ページを再読み込みするとリセットされます。相談内容と直近の会話履歴は回答生成のためOrcaRouterへ、読み上げる文章は設定したVOICEVOXへ送られます。

### 終了・再起動

WebとHonoは各ターミナルで `Ctrl+C` を押して停止します。VOICEVOXは次のコマンドで停止します。

```sh
docker stop live-ai-supporter-voicevox
```

次回はDockerを起動し、手順3〜5を実行します。取得済みなら `docker pull` は省略できます。

## 構成

| ディレクトリ | 内容 |
| --- | --- |
| `web/` | TanStack StartのSSG画面、チャット、VRM表示・リップシンク |
| `server/` | Hono、OrcaRouterの回答ストリーム、VOICEVOX音声合成 |
| `packages/core/` | SSE解析、文分割、音声の先行生成と順次再生 |

音声は文ごとのWAVを先行生成する方式です。回答全文の完成を待たずに再生を始め、最大2文分の生成を進めながら発話順を保ちます。

## テスト・ビルド

```sh
pnpm lint
pnpm test
pnpm build
```

## Cloudflare Workersへのデプロイ

静的フロントエンドとHono APIを、`server/wrangler.jsonc` の1つのWorkerとして配信します。

```sh
pnpm deploy:check
pnpm --filter live-ai-supporter-server exec wrangler login
pnpm --filter live-ai-supporter-server exec wrangler secret put ORCAROUTER_API_KEY
pnpm --filter live-ai-supporter-server exec wrangler secret put ORCAROUTER_MODEL
pnpm --filter live-ai-supporter-server exec wrangler secret put ORCAROUTER_BASE_URL
pnpm --filter live-ai-supporter-server exec wrangler secret put VOICEVOX_API_ROOT_URL
pnpm deploy:cloudflare
```

本番のVOICEVOX URLにはCloudflareから接続できるエンジンを指定します。`server/.dev.vars` はローカル開発専用です。

音声・モデルには各配布元の利用条件が適用されます。画面に `VOICEVOX:ずんだもん` を表示しています。
