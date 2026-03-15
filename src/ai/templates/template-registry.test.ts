import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerTemplate,
  unregisterTemplate,
  getTemplate,
  isCustomTemplate,
  listTemplates,
  searchTemplates,
  fillTemplate,
  getMissingRequired,
  type AiTemplate,
} from './template-registry';

const makeTemplate = (overrides: Partial<AiTemplate> = {}): AiTemplate => ({
  id: 'test-template',
  name: 'Test Template',
  description: 'A test template',
  category: 'general',
  tags: ['test', 'sample'],
  content: 'Hello {{NAME}}, welcome to {{PLACE}}!',
  placeholders: [
    { key: 'NAME', label: 'Name', description: 'Your name', type: 'text', required: true },
    { key: 'PLACE', label: 'Place', description: 'Location', type: 'text', required: false, defaultValue: 'World' },
  ],
  ...overrides,
});

describe('template-registry', () => {
  beforeEach(() => {
    // Cleanup: unregister all test templates
    for (const t of listTemplates()) {
      unregisterTemplate(t.id);
    }
  });

  // =========================================================================
  // register / unregister / get
  // =========================================================================
  describe('register/unregister/get', () => {
    it('registers and retrieves a template', () => {
      const t = makeTemplate();
      registerTemplate(t);
      expect(getTemplate('test-template')).toBe(t);
    });

    it('unregisters a template', () => {
      registerTemplate(makeTemplate());
      unregisterTemplate('test-template');
      expect(getTemplate('test-template')).toBeUndefined();
    });

    it('returns undefined for non-existent template', () => {
      expect(getTemplate('nonexistent')).toBeUndefined();
    });

    it('overwrites on duplicate registration', () => {
      registerTemplate(makeTemplate());
      const t2 = makeTemplate({ name: 'Updated' });
      registerTemplate(t2);
      expect(getTemplate('test-template')!.name).toBe('Updated');
    });
  });

  // =========================================================================
  // isCustomTemplate
  // =========================================================================
  describe('isCustomTemplate', () => {
    it('returns true for custom- prefix', () => {
      expect(isCustomTemplate('custom-my-template')).toBe(true);
    });

    it('returns false for other prefixes', () => {
      expect(isCustomTemplate('builtin-blog')).toBe(false);
      expect(isCustomTemplate('test-template')).toBe(false);
    });
  });

  // =========================================================================
  // listTemplates
  // =========================================================================
  describe('listTemplates', () => {
    it('lists all registered templates', () => {
      registerTemplate(makeTemplate({ id: 'a', category: 'blog' }));
      registerTemplate(makeTemplate({ id: 'b', category: 'code' }));
      expect(listTemplates()).toHaveLength(2);
    });

    it('filters by category', () => {
      registerTemplate(makeTemplate({ id: 'a', category: 'blog' }));
      registerTemplate(makeTemplate({ id: 'b', category: 'code' }));
      expect(listTemplates('blog')).toHaveLength(1);
      expect(listTemplates('blog')[0]!.id).toBe('a');
    });

    it('returns empty array when no match', () => {
      registerTemplate(makeTemplate({ id: 'a', category: 'blog' }));
      expect(listTemplates('meeting')).toHaveLength(0);
    });
  });

  // =========================================================================
  // searchTemplates
  // =========================================================================
  describe('searchTemplates', () => {
    beforeEach(() => {
      registerTemplate(makeTemplate({ id: 'blog1', name: 'ブログ構成案', tags: ['blog', 'writing'] }));
      registerTemplate(makeTemplate({ id: 'code1', name: 'Code Review', description: 'Review code quality', tags: ['code'] }));
    });

    it('searches by name', () => {
      const results = searchTemplates('ブログ');
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('blog1');
    });

    it('searches by description', () => {
      const results = searchTemplates('Review code');
      expect(results).toHaveLength(1);
    });

    it('searches by tag', () => {
      const results = searchTemplates('writing');
      expect(results).toHaveLength(1);
    });

    it('is case-insensitive', () => {
      const results = searchTemplates('CODE');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty for no match', () => {
      expect(searchTemplates('nonexistent')).toHaveLength(0);
    });
  });

  // =========================================================================
  // fillTemplate
  // =========================================================================
  describe('fillTemplate', () => {
    it('replaces placeholders with values', () => {
      const t = makeTemplate();
      const result = fillTemplate(t, { NAME: 'Alice', PLACE: 'Tokyo' });
      expect(result).toBe('Hello Alice, welcome to Tokyo!');
    });

    it('uses default values for missing keys', () => {
      const t = makeTemplate();
      const result = fillTemplate(t, { NAME: 'Alice' });
      expect(result).toBe('Hello Alice, welcome to World!');
    });

    it('uses empty string when no value and no default', () => {
      const t = makeTemplate();
      const result = fillTemplate(t, {});
      expect(result).toBe('Hello , welcome to World!');
    });

    it('replaces multiple occurrences of same key', () => {
      const t = makeTemplate({ content: '{{NAME}} is {{NAME}}' });
      const result = fillTemplate(t, { NAME: 'Bob' });
      expect(result).toBe('Bob is Bob');
    });
  });

  // =========================================================================
  // getMissingRequired
  // =========================================================================
  describe('getMissingRequired', () => {
    it('returns unfilled required placeholders', () => {
      const t = makeTemplate();
      const missing = getMissingRequired(t, {});
      expect(missing).toHaveLength(1);
      expect(missing[0]!.key).toBe('NAME');
    });

    it('returns empty when all required are filled', () => {
      const t = makeTemplate();
      const missing = getMissingRequired(t, { NAME: 'Alice' });
      expect(missing).toHaveLength(0);
    });

    it('does not include optional placeholders', () => {
      const t = makeTemplate();
      const missing = getMissingRequired(t, {});
      expect(missing.every((p) => p.required)).toBe(true);
    });

    it('does not include required placeholders with default values', () => {
      const t = makeTemplate({
        placeholders: [
          { key: 'X', label: 'X', description: '', type: 'text', required: true, defaultValue: 'default' },
        ],
      });
      const missing = getMissingRequired(t, {});
      expect(missing).toHaveLength(0);
    });
  });
});
