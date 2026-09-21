# よりそいAI相談室

学習・進路・学校生活の相談に、3Dキャラクターが応えるチャットサービスです。

## ローカル環境の起動

Node.js、pnpm、Dockerを用意します。すべてプロジェクトルートで実行します。

    pnpm install

server/.dev.vars.example を server/.dev.vars としてコピーし、server/.dev.vars の `SEED_SUPER_ADMIN_PASSWORD` に、初回ログイン用の十分に長いパスワードを設定します。続けてマイグレーションと seed を実行します。

    pnpm --filter live-ai-supporter-server db:migrate:local
    pnpm --filter live-ai-supporter-server db:seed -- --local

seed は `SEED_SCHOOL_NAME` と `SEED_SCHOOL_CODE` の学校、学校に所属しない運用者 `super_admin` を作成します。Passkey 登録前だけ、`SEED_SUPER_ADMIN_USERNAME` と `SEED_SUPER_ADMIN_PASSWORD` でログインできます。二度目以降の実行では既存データを変更しません。
VOICEVOXを起動します。

    docker pull voicevox/voicevox_engine:cpu-latest
    docker run --rm --name yorisoi-voicevox -p 127.0.0.1:50021:50021 voicevox/voicevox_engine:cpu-latest

別のターミナルでWorkerとWebを起動します。

    pnpm dev:server
    pnpm dev:web

相談画面は http://localhost:3000 、教員管理画面は http://localhost:3000/admin/ です。

## 教員管理

管理画面はPasskey認証を使います。初回だけ、管理者から伝えられたユーザー名と初回パスワードでログインし、Passkeyを登録します。登録後はパスワードでログインできません。

| role | 操作できる範囲 |
| --- | --- |
| super_admin | 全学校の登録・編集、全教員の管理 |
| admin | 所属学校の編集、所属学校の教員の招待・編集・削除・Passkeyリセット |
| general | 自分の教員情報とPasskeyの管理 |

学校を登録すると、その学校の最初のadmin教員も同時に作成されます。教員は最大10個のPasskeyを登録でき、設定画面から追加・削除できます。端末紛失時のPasskeyリセットは同じ学校の管理者、またはsuper adminが行います。

相談内容・要約は管理画面へ保存・公開しません。保存によるトークン削減や精度向上が確認できる設計ではないため、会話を永続化していません。

学校の削除は管理画面にはありません。誤操作を避けるため、運用スクリプトだけで削除します。

    pnpm --filter live-ai-supporter-server delete:school -- <school-id> --local
    pnpm --filter live-ai-supporter-server delete:school -- <school-id> --remote

## Cloudflare D1とデプロイ

Workerを初めてデプロイする前にD1を作成し、server/wrangler.jsonc の d1_databases[0].database_id に作成結果のIDを設定します。

    pnpm --filter live-ai-supporter-server exec wrangler d1 create empathy-ai-companion-admin
    pnpm --filter live-ai-supporter-server db:migrate:remote
    pnpm --filter live-ai-supporter-server db:seed -- --remote
    pnpm --filter live-ai-supporter-server exec wrangler secret put ORCAROUTER_API_KEY
    pnpm --filter live-ai-supporter-server exec wrangler secret put VOICEVOX_API_ROOT_URL
    pnpm deploy:cloudflare

本番では ADMIN_ORIGIN を管理画面の完全なHTTPSオリジンに設定します。Passkeyはこのオリジンとドメインに結び付くため、登録後にドメインを変更する場合は新しいPasskeyの登録が必要です。

## テスト・ビルド

    pnpm lint
    pnpm test
    pnpm build
    pnpm deploy:check
