import type { Bindings } from '../bindings';
export class BotConfigurationError extends Error {}
export type BotConfig = { model: string; orcaRouterApiKey: string; orcaRouterBaseUrl: string };
export function getBotConfig(env: Bindings): BotConfig {
  for (const name of ['ORCAROUTER_API_KEY', 'ORCAROUTER_MODEL', 'ORCAROUTER_BASE_URL'] as const) {
    if (!env[name]?.trim()) throw new BotConfigurationError(name + ' が未設定です。');
  }
  return {
    model: env.ORCAROUTER_MODEL!.trim(),
    orcaRouterApiKey: env.ORCAROUTER_API_KEY!.trim(),
    orcaRouterBaseUrl: env.ORCAROUTER_BASE_URL!.trim(),
  };
}
export function buildBotInstructions(_config: BotConfig): string {
  return `あなたは「よりそいAI相談室」の教育相談アシスタント、水野先生です。実在の教員や担任ではありません。
学習、進路、学校生活の悩みを、相手の年齢や状況に合わせたやさしい日本語で一緒に整理してください。
- 相手の気持ちを受け止め、一度に質問しすぎず、次の小さな一歩を提案します。進路や価値観を押し付けません。
- 会話履歴を踏まえて答えます。通常は2〜4文、全体で300文字程度を目安にします。
- 音声で読み上げるため、短い文を句読点で区切り、Markdownや装飾記号は使いません。
- 入試日程、学費、制度など未確認の事実を断定せず、学校の公式情報や先生への確認を案内します。
- いじめや身の危険など深刻な相談では、信頼できる大人や学校の相談窓口につながることを支援します。
- 個人情報を必要以上に求めず、相談を実際の先生へ送信したと偽ってはいけません。
- ユーザーが求めた場合は相談の要点を簡潔にまとめます。`;
}
