import { describe, it, expect } from 'vitest';
import { estimateTokens, calculateBudget, validateBudget } from './context-budget';
import type { BuiltPrompt } from './types';

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function makePrompt(estimatedInputTokens: number): BuiltPrompt {
  return { system: '', user: '', estimatedInputTokens };
}

// ── estimateTokens ────────────────────────────────────────────────────────────

describe('estimateTokens', () => {
  it('空文字列は 0 を返す', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('英数字のみのテキストは 0.4 係数で計算する', () => {
    // "hello" = 5文字 × 0.4 = 2.0 → ceil → 2
    expect(estimateTokens('hello')).toBe(2);
  });

  it('日本語文字は 1.5 係数で計算する', () => {
    // "こんにちは" = 5文字 × 1.5 = 7.5 → ceil → 8
    expect(estimateTokens('こんにちは')).toBe(8);
  });

  it('日英混合テキストは各係数を合算する', () => {
    // "hello" (5英) + "世界" (2日) = 5*0.4 + 2*1.5 = 2.0 + 3.0 = 5.0 → ceil → 5
    expect(estimateTokens('hello世界')).toBe(5);
  });

  it('スペース・記号は英数字扱いで計算する', () => {
    // "   " = 3文字 × 0.4 = 1.2 → ceil → 2
    expect(estimateTokens('   ')).toBe(2);
  });

  it('改行はトークンとして計算する', () => {
    const withNewlines = '\n\n\n';
    expect(estimateTokens(withNewlines)).toBeGreaterThan(0);
  });

  it('CJK 統合漢字（\u4E00-\u9FFF）は日本語判定される', () => {
    // "漢字" = 2文字 × 1.5 = 3.0 → ceil → 3
    expect(estimateTokens('漢字')).toBe(3);
  });

  it('ひらがな・カタカナ（\u3040-\u30FF）は日本語判定される', () => {
    // "あア" = 2文字 × 1.5 = 3.0 → ceil → 3
    expect(estimateTokens('あア')).toBe(3);
  });

  it('ASCII 記号のみのテキストは 0.4 係数', () => {
    // "---" = 3文字 × 0.4 = 1.2 → ceil → 2
    expect(estimateTokens('---')).toBe(2);
  });

  it('大量テキストで正の整数を返す', () => {
    const largeText = 'あ'.repeat(10000) + 'a'.repeat(10000);
    const result = estimateTokens(largeText);
    expect(result).toBeGreaterThan(0);
    expect(Number.isInteger(result)).toBe(true);
  });
});

// ── calculateBudget ───────────────────────────────────────────────────────────

describe('calculateBudget', () => {
  it('各フィールドが正しく計算される', () => {
    const budget = calculateBudget('hello', 'world', 100, 500, 200_000);
    // 'hello' = 2 tok, 'world' = 2 tok
    expect(budget.systemPrompt).toBe(2);
    expect(budget.document).toBe(2);
    expect(budget.references).toBe(100);
    expect(budget.reservedForOutput).toBe(500);
    expect(budget.modelMaxTokens).toBe(200_000);
    expect(budget.available).toBe(200_000 - 2 - 2 - 100 - 500);
  });

  it('available は 0 未満にならない', () => {
    // 使用量がモデル上限を超えても available >= 0
    const budget = calculateBudget('a', 'b', 999_000, 10_000, 200_000);
    expect(budget.available).toBe(0);
  });

  it('空テキストでも正常に動作する', () => {
    const budget = calculateBudget('', '', 0, 0, 200_000);
    expect(budget.systemPrompt).toBe(0);
    expect(budget.document).toBe(0);
    expect(budget.available).toBe(200_000);
  });

  it('references トークンが合算される', () => {
    const budget = calculateBudget('', '', 5000, 4096, 200_000);
    const usedExceptAvailable = budget.systemPrompt + budget.document + budget.references + budget.reservedForOutput;
    expect(usedExceptAvailable + budget.available).toBe(200_000);
  });
});

// ── validateBudget ────────────────────────────────────────────────────────────

describe('validateBudget', () => {
  const LIMIT = 200_000;

  it('使用量が 50% 以下なら level=green・メッセージなし', () => {
    // total = 90_000 (45%)
    const result = validateBudget(makePrompt(85_904), 4096, LIMIT);
    expect(result.ok).toBe(true);
    expect(result.level).toBe('green');
    expect(result.message).toBeUndefined();
  });

  it('使用量が 50% 超 75% 以下なら level=yellow', () => {
    // total = 120_000 (60%)
    const result = validateBudget(makePrompt(115_904), 4096, LIMIT);
    expect(result.ok).toBe(true);
    expect(result.level).toBe('yellow');
    expect(result.message).toContain('%');
  });

  it('使用量が 75% 超 90% 以下なら level=orange', () => {
    // total = 160_000 (80%)
    const result = validateBudget(makePrompt(155_904), 4096, LIMIT);
    expect(result.ok).toBe(true);
    expect(result.level).toBe('orange');
  });

  it('使用量が 90% 超なら level=red かつ ok=false', () => {
    // total = 185_000 (92.5%)
    const result = validateBudget(makePrompt(180_904), 4096, LIMIT);
    expect(result.ok).toBe(false);
    expect(result.level).toBe('red');
    expect(result.message).toBeTruthy();
  });

  it('ちょうど 50% は green', () => {
    // total = 100_000 (50%)
    const result = validateBudget(makePrompt(95_904), 4096, LIMIT);
    expect(result.level).toBe('green');
  });

  it('50% + 1 は yellow', () => {
    // total = 100_001 (50.0005%)
    const result = validateBudget(makePrompt(95_905), 4096, LIMIT);
    expect(result.level).toBe('yellow');
  });

  it('ちょうど 75% は yellow', () => {
    // total = 150_000 (75%)
    const result = validateBudget(makePrompt(145_904), 4096, LIMIT);
    expect(result.level).toBe('yellow');
  });

  it('75% + 1 は orange', () => {
    const result = validateBudget(makePrompt(145_905), 4096, LIMIT);
    expect(result.level).toBe('orange');
  });

  it('ちょうど 90% は orange', () => {
    // total = 180_000 (90%)
    const result = validateBudget(makePrompt(175_904), 4096, LIMIT);
    expect(result.level).toBe('orange');
    expect(result.ok).toBe(true);
  });

  it('90% + 1 は red', () => {
    const result = validateBudget(makePrompt(175_905), 4096, LIMIT);
    expect(result.level).toBe('red');
    expect(result.ok).toBe(false);
  });

  it('yellow メッセージには使用率（%）が含まれる', () => {
    const result = validateBudget(makePrompt(115_904), 4096, LIMIT);
    expect(result.level).toBe('yellow');
    expect(result.message).toMatch(/\d+%/);
  });

  it('red メッセージには推定トークン数が含まれる', () => {
    const result = validateBudget(makePrompt(180_904), 4096, LIMIT);
    expect(result.message).toContain('185,000');
  });
});
