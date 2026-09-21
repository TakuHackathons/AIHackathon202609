import OpenAI from 'openai';
import { buildBotInstructions, getBotConfig } from '../config/bot';
import type { Bindings } from '../bindings';
import type { ChatMessage } from '../../../packages/core/src/index';

function createRequest(env: Bindings, message: string, history: ChatMessage[] = []) {
  const config = getBotConfig(env);
  const client = new OpenAI({ apiKey: config.orcaRouterApiKey, baseURL: config.orcaRouterBaseUrl, maxRetries: 1, timeout: 60000 });
  return {
    client,
    request: {
      model: config.model,
      instructions: buildBotInstructions(config),
      input: [...history, { role: 'user' as const, content: message }],
      max_output_tokens: 1600,
    },
  };
}
export async function createOrcaAnswer(env: Bindings, message: string, history: ChatMessage[] = [], signal?: AbortSignal): Promise<string> {
  const { client, request } = createRequest(env, message, history);
  const response = await client.responses.create({ ...request, stream: false }, { signal });
  return response.output_text;
}
export async function createOrcaStream(env: Bindings, message: string, history: ChatMessage[] = [], signal?: AbortSignal) {
  const { client, request } = createRequest(env, message, history);
  return client.responses.create({ ...request, stream: true }, { signal });
}
