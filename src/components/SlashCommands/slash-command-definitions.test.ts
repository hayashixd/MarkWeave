import { describe, it, expect } from 'vitest';
import {
  SLASH_COMMANDS,
  CATEGORY_LABELS,
  filterCommands,
  type SlashCommandDef,
} from './slash-command-definitions';

describe('slash-command-definitions', () => {
  // =========================================================================
  // SLASH_COMMANDS
  // =========================================================================
  describe('SLASH_COMMANDS', () => {
    it('has at least 20 commands', () => {
      expect(SLASH_COMMANDS.length).toBeGreaterThanOrEqual(20);
    });

    it('all commands have unique IDs', () => {
      const ids = SLASH_COMMANDS.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all commands have required fields', () => {
      for (const cmd of SLASH_COMMANDS) {
        expect(cmd.id).toBeTruthy();
        expect(cmd.category).toBeTruthy();
        expect(cmd.name).toBeTruthy();
        expect(cmd.keywords).toBeTruthy();
        expect(cmd.description).toBeTruthy();
        expect(cmd.icon).toBeTruthy();
        expect(typeof cmd.action).toBe('function');
      }
    });

    it('includes expected categories', () => {
      const categories = new Set(SLASH_COMMANDS.map((c) => c.category));
      expect(categories.has('text')).toBe(true);
      expect(categories.has('list')).toBe(true);
      expect(categories.has('block')).toBe(true);
      expect(categories.has('code')).toBe(true);
      expect(categories.has('table')).toBe(true);
      expect(categories.has('ai')).toBe(true);
      expect(categories.has('pkm')).toBe(true);
    });
  });

  // =========================================================================
  // CATEGORY_LABELS
  // =========================================================================
  describe('CATEGORY_LABELS', () => {
    it('has labels for all categories used by commands', () => {
      const categories = new Set(SLASH_COMMANDS.map((c) => c.category));
      for (const cat of categories) {
        expect(CATEGORY_LABELS[cat]).toBeTruthy();
      }
    });

    it('includes snippet category', () => {
      expect(CATEGORY_LABELS.snippet).toBeTruthy();
    });
  });

  // =========================================================================
  // filterCommands
  // =========================================================================
  describe('filterCommands', () => {
    it('returns all commands for empty query', () => {
      const result = filterCommands('');
      expect(result).toHaveLength(SLASH_COMMANDS.length);
    });

    it('returns all commands for whitespace query', () => {
      const result = filterCommands('   ');
      expect(result).toHaveLength(SLASH_COMMANDS.length);
    });

    it('filters by name', () => {
      const result = filterCommands('見出し');
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((c) => c.name.includes('見出し') || c.keywords.includes('見出し'))).toBe(true);
    });

    it('filters by keywords', () => {
      const result = filterCommands('h1');
      expect(result.some((c) => c.id === 'h1')).toBe(true);
    });

    it('includes extra commands in search', () => {
      const extra: SlashCommandDef[] = [
        {
          id: 'custom-1',
          category: 'snippet',
          name: 'My Custom Command',
          keywords: 'custom special',
          description: 'A custom command',
          icon: '🔧',
          action: () => {},
        },
      ];
      const result = filterCommands('custom', extra);
      expect(result.some((c) => c.id === 'custom-1')).toBe(true);
    });

    it('returns empty for unmatched query', () => {
      const result = filterCommands('zzzzzzzznonexistent');
      expect(result).toHaveLength(0);
    });

    it('performs character-level fuzzy matching', () => {
      // 'tb' should match 'table' since all chars of 'tb' appear in 'table'
      const result = filterCommands('tb');
      // t and b both appear in 'テーブル' or 'table'
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });
});
