/**
 * language-detector.ts のユニットテスト
 *
 * Unicode スクリプト分析 + franc フォールバックの挙動を検証する。
 */
import { describe, it, expect } from 'vitest';
import { detectLanguage } from './language-detector';

describe('detectLanguage', () => {
  // ── 短すぎる入力 ──────────────────────────────────────────────
  it('短すぎるテキスト（3文字未満）は en を返す', () => {
    expect(detectLanguage('')).toBe('en');
    expect(detectLanguage('ab')).toBe('en');
    expect(detectLanguage('  ')).toBe('en');
  });

  // ── 日本語（ひらがな・カタカナ確定） ──────────────────────────
  it('ひらがなを含むテキストは ja を返す', () => {
    expect(detectLanguage('これはテストです')).toBe('ja');
    expect(detectLanguage('今日はいい天気ですね')).toBe('ja');
  });

  it('カタカナを含むテキストは ja を返す', () => {
    expect(detectLanguage('テスト文字列です')).toBe('ja');
    expect(detectLanguage('コンピュータサイエンス')).toBe('ja');
  });

  it('ひらがなとカタカナが混在しても ja を返す', () => {
    expect(detectLanguage('テストのためのデータです')).toBe('ja');
  });

  // ── 韓国語（ハングル確定） ────────────────────────────────────
  it('ハングルを含むテキストは ko を返す', () => {
    expect(detectLanguage('안녕하세요')).toBe('ko');
    expect(detectLanguage('한국어 텍스트입니다')).toBe('ko');
  });

  // ── 英語（franc フォールバック） ─────────────────────────────
  it('英語テキストは en を返す', () => {
    const result = detectLanguage(
      'This is a sample English text for language detection testing purposes.'
    );
    expect(result).toBe('en');
  });

  // ── 漢字比率チェック（CJK 判定） ─────────────────────────────
  it('漢字だけのテキストは ja か zh のいずれかを返す', () => {
    const result = detectLanguage('日本語文章確認');
    expect(['ja', 'zh']).toContain(result);
  });

  // ── エッジケース ─────────────────────────────────────────────
  it('ひらがなと英語の混合では ja を返す（ひらがな優先）', () => {
    expect(detectLanguage('Hello これはテストです')).toBe('ja');
  });

  it('ハングルと英語の混合では ko を返す（ハングル優先）', () => {
    expect(detectLanguage('Hello 안녕하세요')).toBe('ko');
  });

  it('空白のみのテキストは en を返す（短すぎる判定）', () => {
    expect(detectLanguage('   ')).toBe('en');
  });

  it('数字のみのテキストは en か undetermined を返す', () => {
    const result = detectLanguage('1234567890123');
    // franc が undetermined を返す場合は null → 'en' へフォールバック
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});
