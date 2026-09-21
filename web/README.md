# よりそいAI相談室 / Web

TanStack Start + React + three.js / VRMで作る相談画面です。環境変数と起動コマンドは[ルートREADME](../README.md)を参照してください。

## 画面と音声

- `src/screens/Studio.tsx`: 会話履歴、回答ストリーム、音声・字幕、相談の要約。
- `src/features/vrmViewer/`: VRM、待機アニメーション、リップシンク。
- `../packages/core/src/index.ts`: 文分割、SSE解析、音声生成・再生キュー。
- `src/styles.css`: 相談画面のレイアウトとレスポンシブ表示。

ブラウザからHonoの `/api/orca/chat` に会話を送り、返答を逐次表示します。確定した文を `/api/voicevox/speech` に渡し、先行生成した音声を順番に再生します。

## SSGと配信

`pnpm build:web` は画面を静的HTMLに変換し、`web/dist/client` に出力します。VRMや音声のブラウザAPIはハイドレーション後に実行します。

Cloudflareでは静的アセットと `server/src/index.ts` のHonoを同じWorkerで配信します。`web/dist/server` はプリレンダリング専用です。開発中の `/api/*` はViteからHonoへ転送します。

ルートは `src/routes/`、SSGとAPIプロキシは `vite.config.ts` で設定します。`scripts/verify-static-build.mjs` がビルド後のHTML・アセット・APIルーティング設定を検証します。
