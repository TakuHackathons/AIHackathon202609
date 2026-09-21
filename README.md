# Empathy AI Companion

教育機関向けのAI相談サービスです。利用者が入力した相談にAIが回答し、3DキャラクターがVOICEVOXの音声で読み上げます。教員向け管理画面では、学校と教員の情報を管理できます。

## ローカル環境の起動

プロジェクトルートで依存パッケージをインストールします。

```sh
pnpm install
```

`server/.env.example`を`server/.env`へコピーし、必要な環境変数を設定します。

D1のマイグレーションとseedを実行します。

```sh
pnpm --filter empathy-ai-companion-server db:migrate:local
pnpm --filter empathy-ai-companion-server db:seed:local
```

ローカルD1を作り直す場合は、次のコマンドで削除、マイグレーション、seedを順に実行します。

```sh
pnpm --filter empathy-ai-companion-server db:migrate:reset
pnpm --filter empathy-ai-companion-server db:seed:local
```

VOICEVOXを起動します。

```sh
docker pull voicevox/voicevox_engine:cpu-latest
docker run --rm --name empathy-ai-companion-voicevox -p 127.0.0.1:50021:50021 voicevox/voicevox_engine:cpu-latest
```

別々のターミナルでWorkerとWebを起動します。

```sh
pnpm dev:server
pnpm dev:web
```

Web画面に表示されたURLを開きます。教員向け管理画面は同じURLの`/admin/`です。

## seedの初期データ

一般利用画面で入力する学校コードは次の値です。

| 項目       | 値              |
| ---------- | --------------- |
| 学校名     | `Sample School` |
| 学校コード | `SAMPLE-SCHOOL` |

管理画面へログインするsuper adminは次の値です。

| 項目       | 値                             |
| ---------- | ------------------------------ |
| ユーザー名 | `super-admin`                  |
| パスワード | `initial-super-admin-password` |

パスキーを登録すると、このパスワードではログインできなくなります。

## 管理権限

| role          | 操作範囲                         |
| ------------- | -------------------------------- |
| `super_admin` | 全学校の登録・編集と全教員の管理 |
| `admin`       | 所属学校と所属教員の管理         |
| `general`     | 自分の教員情報とパスキーの管理   |

学校の削除は管理画面から実行できません。運用スクリプトを使用します。

```sh
pnpm --filter empathy-ai-companion-server delete:school -- <school-id> --local
pnpm --filter empathy-ai-companion-server delete:school -- <school-id> --remote
```

## Cloudflareへのデプロイ

```sh
pnpm --filter empathy-ai-companion-server exec wrangler d1 create empathy-ai-companion-admin
pnpm --filter empathy-ai-companion-server db:migrate:remote
pnpm --filter empathy-ai-companion-server db:seed:remote
pnpm --filter empathy-ai-companion-server exec wrangler secret put ORCAROUTER_API_KEY
pnpm --filter empathy-ai-companion-server exec wrangler secret put VOICEVOX_API_ROOT_URL
pnpm deploy:cloudflare
```

## 確認コマンド

```sh
pnpm lint
pnpm test
pnpm build
pnpm deploy:check
```
