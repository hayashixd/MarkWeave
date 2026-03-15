import { describe, it, expect } from 'vitest';
import {
  sortLinesAsc,
  sortLinesDesc,
  removeDuplicateLines,
  trimLeading,
  trimTrailing,
  toUpperCase,
  toLowerCase,
  toFullWidth,
  toHalfWidth,
  TEXT_TRANSFORM_COMMANDS,
} from './text-transform';

describe('text-transform', () => {
  // =========================================================================
  // sortLinesAsc
  // =========================================================================
  describe('sortLinesAsc', () => {
    it('sorts lines alphabetically', () => {
      expect(sortLinesAsc('c\na\nb')).toBe('a\nb\nc');
    });

    it('sorts Japanese text with locale', () => {
      const result = sortLinesAsc('さしすせそ\nあいうえお\nかきくけこ');
      expect(result).toBe('あいうえお\nかきくけこ\nさしすせそ');
    });

    it('handles single line', () => {
      expect(sortLinesAsc('hello')).toBe('hello');
    });

    it('handles empty string', () => {
      expect(sortLinesAsc('')).toBe('');
    });

    it('handles lines with whitespace', () => {
      expect(sortLinesAsc('  b\na\n  c')).toBe('  b\n  c\na');
    });
  });

  // =========================================================================
  // sortLinesDesc
  // =========================================================================
  describe('sortLinesDesc', () => {
    it('sorts lines in descending order', () => {
      expect(sortLinesDesc('a\nb\nc')).toBe('c\nb\na');
    });

    it('handles identical lines', () => {
      expect(sortLinesDesc('a\na\na')).toBe('a\na\na');
    });
  });

  // =========================================================================
  // removeDuplicateLines
  // =========================================================================
  describe('removeDuplicateLines', () => {
    it('removes duplicate lines keeping first occurrence', () => {
      expect(removeDuplicateLines('a\nb\na\nc\nb')).toBe('a\nb\nc');
    });

    it('preserves order of first occurrences', () => {
      expect(removeDuplicateLines('c\nb\na\nc\nb\na')).toBe('c\nb\na');
    });

    it('handles no duplicates', () => {
      expect(removeDuplicateLines('a\nb\nc')).toBe('a\nb\nc');
    });

    it('handles all identical lines', () => {
      expect(removeDuplicateLines('a\na\na')).toBe('a');
    });

    it('handles empty lines as duplicates', () => {
      expect(removeDuplicateLines('a\n\nb\n\nc')).toBe('a\n\nb\nc');
    });
  });

  // =========================================================================
  // trimLeading
  // =========================================================================
  describe('trimLeading', () => {
    it('removes leading spaces', () => {
      expect(trimLeading('  hello\n  world')).toBe('hello\nworld');
    });

    it('removes leading tabs', () => {
      expect(trimLeading('\thello\n\tworld')).toBe('hello\nworld');
    });

    it('removes mixed leading whitespace', () => {
      expect(trimLeading('\t hello\n \tworld')).toBe('hello\nworld');
    });

    it('does not modify lines without leading whitespace', () => {
      expect(trimLeading('hello\nworld')).toBe('hello\nworld');
    });

    it('preserves trailing whitespace', () => {
      expect(trimLeading('  hello  ')).toBe('hello  ');
    });
  });

  // =========================================================================
  // trimTrailing
  // =========================================================================
  describe('trimTrailing', () => {
    it('removes trailing spaces', () => {
      expect(trimTrailing('hello  \nworld  ')).toBe('hello\nworld');
    });

    it('removes trailing tabs', () => {
      expect(trimTrailing('hello\t\nworld\t')).toBe('hello\nworld');
    });

    it('preserves leading whitespace', () => {
      expect(trimTrailing('  hello  ')).toBe('  hello');
    });
  });

  // =========================================================================
  // toUpperCase / toLowerCase
  // =========================================================================
  describe('toUpperCase', () => {
    it('converts to uppercase', () => {
      expect(toUpperCase('hello World')).toBe('HELLO WORLD');
    });

    it('handles already uppercase', () => {
      expect(toUpperCase('ABC')).toBe('ABC');
    });

    it('handles empty string', () => {
      expect(toUpperCase('')).toBe('');
    });
  });

  describe('toLowerCase', () => {
    it('converts to lowercase', () => {
      expect(toLowerCase('HELLO World')).toBe('hello world');
    });
  });

  // =========================================================================
  // toFullWidth / toHalfWidth
  // =========================================================================
  describe('toFullWidth', () => {
    it('converts ASCII to full-width', () => {
      expect(toFullWidth('ABC')).toBe('ＡＢＣ');
    });

    it('converts half-width space to full-width', () => {
      expect(toFullWidth('A B')).toBe('Ａ\u3000Ｂ');
    });

    it('converts numbers and symbols', () => {
      expect(toFullWidth('123')).toBe('１２３');
      expect(toFullWidth('!?')).toBe('！？');
    });

    it('does not affect Japanese characters', () => {
      expect(toFullWidth('あいう')).toBe('あいう');
    });
  });

  describe('toHalfWidth', () => {
    it('converts full-width to ASCII', () => {
      expect(toHalfWidth('ＡＢＣ')).toBe('ABC');
    });

    it('converts full-width space to half-width', () => {
      expect(toHalfWidth('Ａ\u3000Ｂ')).toBe('A B');
    });

    it('does not affect Japanese characters', () => {
      expect(toHalfWidth('あいう')).toBe('あいう');
    });

    it('roundtrips correctly with toFullWidth', () => {
      const original = 'Hello, World! 123';
      expect(toHalfWidth(toFullWidth(original))).toBe(original);
    });
  });

  // =========================================================================
  // TEXT_TRANSFORM_COMMANDS
  // =========================================================================
  describe('TEXT_TRANSFORM_COMMANDS', () => {
    it('has 9 commands', () => {
      expect(TEXT_TRANSFORM_COMMANDS).toHaveLength(9);
    });

    it('all commands have unique IDs', () => {
      const ids = TEXT_TRANSFORM_COMMANDS.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all commands have a transform function', () => {
      for (const cmd of TEXT_TRANSFORM_COMMANDS) {
        expect(typeof cmd.transform).toBe('function');
      }
    });

    it('each transform function works', () => {
      for (const cmd of TEXT_TRANSFORM_COMMANDS) {
        const result = cmd.transform('test');
        expect(typeof result).toBe('string');
      }
    });
  });
});
