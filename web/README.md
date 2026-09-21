# Live AI Supporter / Web

TanStack Start + Vite + React + three.js / VRMによる操作・録画画面です。起動方法とAPI設定は[ルートREADME](../README.md)を参照してください。

## SSGと配信

`pnpm build:web` はTanStack Startの `prerender.enabled: true` で画面を静的HTMLに変換します。出力先は `web/dist/client` です。VRMや画面録画などのブラウザAPIは、ハイドレーション後のeffectやクリック時に実行します。

Cloudflareには `server/wrangler.jsonc` の1プロジェクトとしてデプロイします。

- フロント: `web/dist/client` のHTML・JS・CSS・VRMをWorkers Static Assetsから配信。
- バックエンド: `/api` と `/api/*` を既存の `server/src/index.ts`（Hono）が処理。
- `web/dist/server` はビルド時のプリレンダリング用で、デプロイ対象に含めません。
- API呼び出しは同一オリジンの `/api/*` を使用。フロント側にAPIキーを渡す必要はありません。
- TanStack Startのserver functionsやサーバー専用ルートは使用していません。新しいAPIはHonoへ追加します。

## ファイル

- `src/routes/__root.tsx`: HTML、メタデータ、スタイル、Jotai Provider。
- `src/routes/index.tsx`: トップページのルート。
- `src/screens/Studio.tsx`: 録画・コメント読み上げUI。
- `src/router.tsx`: ルーター。
- `src/routeTree.gen.ts`: 自動生成ルート定義。コミット対象ですが手動編集はしません。
- `vite.config.ts`: SSG・開発サーバー・HonoへのAPIプロキシ。
- `scripts/verify-static-build.mjs`: ビルド成果物に画面HTMLと必要なアセットがあることを検証。

新しい静的ルートは `src/routes` に追加すればビルド時に自動検出されます。動的パラメーター付きルートは `vite.config.ts` の `pages` で生成対象を指定してください。

## 開発

VOICEVOX・Hono・Webの準備と起動コマンドは、[ルートREADMEのローカル環境の起動手順](../README.md#ローカル環境の起動)にまとめています。そちらの順序で起動してください。

参考: [TanStack Start Static Prerendering](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering)
