# Server E2E確認

## OrcaRouterのAPI

`POST /api/orca/chat` は、OrcaRouterのResponses APIを通じて質問に回答します。
必要に応じてGitHub MCPでリポジトリ情報を、Exa MCPで公式ドキュメントを確認します。
`stream: true`を指定すると、回答テキストだけをSSEで受け取れます。

## OrcaRouter MCP E2E

以下は、OrcaRouterのAgentに対し、GitHub MCPとExa MCPの接続の動作確認をします。
外部サービスと有効な認証情報を必要とするため、通常のunit testやCIには含めません。

必要なBot、OrcaRouter、GitHub MCP、Exa MCPの環境変数を`server/.env`に設定してください。
その後、別のターミナルで以下を実行し、ローカルAPIサーバーを起動してください。

```bash
pnpm --filter live-ai-supporter-server dev
```

以下を別のターミナルから実行してください。
これにより、HTTPリクエストが送られ、結果を検査できます。

```bash
pnpm --filter live-ai-supporter-server test:orca:e2e
```

以下は補足です。
既定の接続先は`http://localhost:8787`です。
別の環境を使用する場合は、以下のように`ORCA_E2E_BASE_URL`を設定してください。

```bash
ORCA_E2E_BASE_URL=http://localhost:8788 pnpm --filter live-ai-supporter-server test:orca:e2e
```
