import type { Bindings } from '../bindings';

export class BotConfigurationError extends Error {}

export type BotConfig = {
  name: string;
  description: string;
  githubRepository: string;
  documentationUrl: string;
  model: string;
  orcaRouterApiKey: string;
  orcaRouterBaseUrl: string;
  githubMcpServerUrl: string;
  githubMcpPat: string;
  exaMcpServerUrl: string;
};

function required(env: Bindings, name: keyof Bindings): string {
  const value = env[name];
  if (typeof value !== 'string' || !value.trim()) throw new BotConfigurationError(`${String(name)} が未設定です。`);
  return value.trim();
}

export function getBotConfig(env: Bindings): BotConfig {
  return {
    name: required(env, 'BOT_NAME'),
    description: required(env, 'BOT_DESCRIPTION'),
    githubRepository: required(env, 'GITHUB_REPOSITORY'),
    documentationUrl: required(env, 'DOCUMENTATION_URL'),
    model: required(env, 'ORCAROUTER_MODEL'),
    orcaRouterApiKey: required(env, 'ORCAROUTER_API_KEY'),
    orcaRouterBaseUrl: required(env, 'ORCAROUTER_BASE_URL'),
    githubMcpServerUrl: required(env, 'GITHUB_MCP_SERVER_URL'),
    githubMcpPat: required(env, 'GITHUB_MCP_PAT'),
    exaMcpServerUrl: required(env, 'EXA_MCP_SERVER_URL'),
  };
}

export function buildBotInstructions(config: BotConfig): string {
  return `あなたは${config.name}です。${config.description}

回答では次のルールに従ってください。
- ソースコード、README、Release等を確認する場合は GitHub MCP を使う。
- 利用方法、仕様、API等を確認する場合は Exa MCP を使う。
- GitHub では原則として ${config.githubRepository} を対象とする。
- Exa では原則として ${config.documentationUrl} およびその配下を参照する。
- 必要最小限の Tool Call で回答する。
- 情報源から確認できない内容は推測しない。`;
}
