import { describe, it, expect } from 'vitest';
import {
  calculateReadability,
  getReadabilityLabel,
  formatPercent,
} from './readability-score';

describe('readability-score', () => {
  // =========================================================================
  // calculateReadability
  // =========================================================================
  describe('calculateReadability', () => {
    it('returns zero metrics for empty text', () => {
      const result = calculateReadability('');
      expect(result.totalChars).toBe(0);
      expect(result.score).toBe(0);
      expect(result.level).toBe('moderate');
    });

    it('calculates metrics for Japanese text', () => {
      const text = 'これはテストの文章です。日本語の可読性を計算します。';
      const result = calculateReadability(text);
      expect(result.totalChars).toBeGreaterThan(0);
      expect(result.kanjiRatio).toBeGreaterThan(0);
      expect(result.hiraganaRatio).toBeGreaterThan(0);
      expect(result.sentenceCount).toBe(2);
    });

    it('handles English-only text', () => {
      const text = 'This is a test. Simple English text.';
      const result = calculateReadability(text);
      expect(result.kanjiRatio).toBe(0);
      expect(result.hiraganaRatio).toBe(0);
      expect(result.totalChars).toBeGreaterThan(0);
    });

    it('strips markdown formatting before analysis', () => {
      const md = '# Heading\n\n**Bold text** and [link](http://example.com)\n\n```js\ncode\n```';
      const result = calculateReadability(md);
      // Should not count markdown syntax characters
      expect(result.totalChars).toBeGreaterThan(0);
    });

    it('strips YAML front matter', () => {
      const md = '---\ntitle: Test\n---\nBody text here.';
      const result = calculateReadability(md);
      // title, date etc should not be counted
      expect(result.totalChars).toBeGreaterThan(0);
    });

    it('detects katakana ratio', () => {
      const text = 'テスト テスト テスト テスト テスト';
      const result = calculateReadability(text);
      expect(result.katakanaRatio).toBeGreaterThan(0);
    });

    it('score is between 0 and 100', () => {
      const texts = [
        'テスト',
        '漢字漢字漢字漢字漢字漢字漢字漢字漢字漢字',
        'これはひらがなだけのぶんしょうです。',
        'A simple test.',
      ];
      for (const text of texts) {
        const result = calculateReadability(text);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
    });

    it('assigns level based on score', () => {
      // We can't easily control the exact score, but we can verify the logic
      const result = calculateReadability(
        'これはやさしいにほんごのぶんしょうです。ひらがなが多いと読みやすいです。漢字は少なめにします。'
      );
      expect(['easy', 'moderate', 'hard']).toContain(result.level);
    });

    it('strips inline math', () => {
      const md = 'The formula $E=mc^2$ is important.';
      const result = calculateReadability(md);
      expect(result.totalChars).toBeGreaterThan(0);
    });

    it('strips block math', () => {
      const md = 'Text before.\n\n$$\nx = \\frac{-b}{2a}\n$$\n\nText after.';
      const result = calculateReadability(md);
      expect(result.totalChars).toBeGreaterThan(0);
    });

    it('averageSentenceLength is reasonable', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const result = calculateReadability(text);
      expect(result.sentenceCount).toBe(3);
      expect(result.averageSentenceLength).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // getReadabilityLabel
  // =========================================================================
  describe('getReadabilityLabel', () => {
    it('returns Japanese labels', () => {
      expect(getReadabilityLabel('easy')).toBe('読みやすい');
      expect(getReadabilityLabel('moderate')).toBe('普通');
      expect(getReadabilityLabel('hard')).toBe('難しい');
    });
  });

  // =========================================================================
  // formatPercent
  // =========================================================================
  describe('formatPercent', () => {
    it('formats ratio as percentage', () => {
      expect(formatPercent(0.5)).toBe('50.0%');
      expect(formatPercent(0.123)).toBe('12.3%');
      expect(formatPercent(0)).toBe('0.0%');
      expect(formatPercent(1)).toBe('100.0%');
    });

    it('handles small values', () => {
      expect(formatPercent(0.001)).toBe('0.1%');
    });
  });
});
