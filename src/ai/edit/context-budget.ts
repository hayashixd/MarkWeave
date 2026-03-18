import type { BuiltPrompt, ContextBudget } from './types';

const JAPANESE_CHAR_REGEX = /[\u3000-\u9FFF\uF900-\uFAFF]/g;

export function estimateTokens(text: string): number {
  const japaneseChars = (text.match(JAPANESE_CHAR_REGEX) ?? []).length;
  const otherChars = text.length - japaneseChars;
  return Math.ceil(japaneseChars * 1.5 + otherChars * 0.4);
}

export function calculateBudget(
  systemPromptText: string,
  documentText: string,
  referencesTokens: number,
  reservedForOutput: number,
  modelMaxTokens: number,
): ContextBudget {
  const systemPrompt = estimateTokens(systemPromptText);
  const document = estimateTokens(documentText);
  const used = systemPrompt + document + referencesTokens + reservedForOutput;
  const available = Math.max(0, modelMaxTokens - used);

  return {
    modelMaxTokens,
    systemPrompt,
    references: referencesTokens,
    document,
    reservedForOutput,
    available,
  };
}

export function validateBudget(
  prompt: BuiltPrompt,
  maxTokens: number,
  modelLimit: number,
): { ok: boolean; level: 'green' | 'yellow' | 'orange' | 'red'; message?: string } {
  const total = prompt.estimatedInputTokens + maxTokens;

  if (total > modelLimit * 0.9) {
    return {
      ok: false,
      level: 'red',
      message: `コンテキスト上限に近すぎます（推定 ${total.toLocaleString()} / ${modelLimit.toLocaleString()} トークン）。参考資料を減らしてください。`,
    };
  }

  if (total > modelLimit * 0.75) {
    return {
      ok: true,
      level: 'orange',
      message: `参考資料を減らすか、要約して送信できます。`,
    };
  }

  if (total > modelLimit * 0.5) {
    return {
      ok: true,
      level: 'yellow',
      message: `コンテキストの ${Math.round((total / modelLimit) * 100)}% を使用します。精度が低下する可能性があります。`,
    };
  }

  return { ok: true, level: 'green' };
}
