import OpenAI from 'openai';
import type { Responses } from 'openai/resources/responses/responses';
import { buildBotInstructions, getBotConfig } from '../config/bot';
import type { Bindings } from '../bindings';

function createRequest(env: Bindings, message: string) {
  const config = getBotConfig(env);
  const client = new OpenAI({ apiKey: config.orcaRouterApiKey, baseURL: config.orcaRouterBaseUrl });
  const tools: Responses.Tool[] = [
    {
      type: 'mcp',
      server_label: 'github',
      server_url: config.githubMcpServerUrl,
      headers: { Authorization: `Bearer ${config.githubMcpPat}` },
      require_approval: 'never',
    },
    {
      type: 'mcp',
      server_label: 'documentation',
      server_url: config.exaMcpServerUrl,
      require_approval: 'never',
    },
  ];

  return { client, request: { model: config.model, instructions: buildBotInstructions(config), input: message, tools } };
}

export async function createOrcaAnswer(env: Bindings, message: string): Promise<string> {
  const { client, request } = createRequest(env, message);
  const response = await client.responses.create({ ...request, stream: false });
  return response.output_text;
}

export async function createOrcaStream(env: Bindings, message: string) {
  const { client, request } = createRequest(env, message);
  return client.responses.create({ ...request, stream: true });
}
