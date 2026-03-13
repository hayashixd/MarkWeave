import { describe, it, expect } from 'vitest';
import { buildWordList, getSuggestions } from './word-completer';

describe('word-completer', () => {
  // =========================================================================
  // buildWordList
  // =========================================================================
  describe('buildWordList', () => {
    it('extracts words from text with correct counts', () => {
      const map = buildWordList('hello world hello');
      expect(map.get('hello')).toBe(2);
      expect(map.get('world')).toBe(1);
    });

    it('excludes single character words', () => {
      const map = buildWordList('a bc def');
      expect(map.has('a')).toBe(false);
      expect(map.has('bc')).toBe(true);
      expect(map.has('def')).toBe(true);
    });

    it('handles Japanese text', () => {
      const map = buildWordList('テスト テスト 日本語');
      expect(map.get('テスト')).toBe(2);
      expect(map.get('日本語')).toBe(1);
    });

    it('handles mixed Japanese and English', () => {
      const map = buildWordList('React開発 React テスト');
      expect(map.has('React')).toBe(true);
      expect(map.has('テスト')).toBe(true);
    });

    it('returns empty map for empty string', () => {
      const map = buildWordList('');
      expect(map.size).toBe(0);
    });

    it('returns empty map for only single chars', () => {
      const map = buildWordList('a b c d');
      expect(map.size).toBe(0);
    });

    it('handles special Unicode characters like 々〆', () => {
      const map = buildWordList('時々 いろいろ');
      expect(map.has('時々')).toBe(true);
    });

    it('handles multiline text', () => {
      const map = buildWordList('hello\nworld\nhello');
      expect(map.get('hello')).toBe(2);
      expect(map.get('world')).toBe(1);
    });
  });

  // =========================================================================
  // getSuggestions
  // =========================================================================
  describe('getSuggestions', () => {
    const wordMap = new Map<string, number>([
      ['function', 5],
      ['filter', 3],
      ['forEach', 2],
      ['find', 4],
      ['finally', 1],
      ['factory', 1],
    ]);

    it('returns suggestions matching prefix', () => {
      const results = getSuggestions(wordMap, 'fi');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.word.toLowerCase().startsWith('fi'))).toBe(true);
    });

    it('sorts by frequency descending', () => {
      const results = getSuggestions(wordMap, 'f');
      expect(results[0]!.word).toBe('function'); // count=5
      expect(results[1]!.word).toBe('find');      // count=4
    });

    it('sorts alphabetically when frequencies are equal', () => {
      const results = getSuggestions(wordMap, 'fa');
      const sameFreq = results.filter((r) => r.count === 1);
      for (let i = 1; i < sameFreq.length; i++) {
        expect(sameFreq[i]!.word >= sameFreq[i - 1]!.word).toBe(true);
      }
    });

    it('excludes exact prefix match', () => {
      const results = getSuggestions(wordMap, 'function');
      expect(results.find((r) => r.word === 'function')).toBeUndefined();
    });

    it('returns empty for empty prefix', () => {
      expect(getSuggestions(wordMap, '')).toEqual([]);
    });

    it('respects maxResults parameter', () => {
      const results = getSuggestions(wordMap, 'f', 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('is case-insensitive', () => {
      const results = getSuggestions(wordMap, 'F');
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty when no words match', () => {
      const results = getSuggestions(wordMap, 'xyz');
      expect(results).toEqual([]);
    });

    it('works with Japanese prefixes', () => {
      const jpMap = new Map([
        ['テスト', 3],
        ['テーブル', 2],
        ['データ', 1],
      ]);
      const results = getSuggestions(jpMap, 'テ');
      expect(results.length).toBe(2);
    });
  });
});
