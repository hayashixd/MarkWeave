import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDocumentTemplateStore } from './documentTemplateStore';

// plugin-store をモック
vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('documentTemplateStore', () => {
  beforeEach(() => {
    useDocumentTemplateStore.setState({
      templates: [],
      loaded: false,
    });
  });

  // =========================================================================
  // getAllTemplates
  // =========================================================================
  describe('getAllTemplates', () => {
    it('returns 4 built-in templates when no user templates', () => {
      const all = useDocumentTemplateStore.getState().getAllTemplates();
      expect(all.length).toBe(4);
      expect(all.every((t) => t.id.startsWith('builtin-'))).toBe(true);
    });

    it('returns built-in + user templates', () => {
      useDocumentTemplateStore.setState({
        templates: [{
          id: 'user-1',
          name: 'My Template',
          content: '# Custom',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        }],
      });
      const all = useDocumentTemplateStore.getState().getAllTemplates();
      expect(all.length).toBe(5);
    });
  });

  // =========================================================================
  // addTemplate
  // =========================================================================
  describe('addTemplate', () => {
    it('adds a user template', async () => {
      await useDocumentTemplateStore.getState().addTemplate({
        name: 'Test',
        content: '# Test',
      });
      const templates = useDocumentTemplateStore.getState().templates;
      expect(templates).toHaveLength(1);
      expect(templates[0]!.name).toBe('Test');
      expect(templates[0]!.id).toBeTruthy();
    });
  });

  // =========================================================================
  // updateTemplate
  // =========================================================================
  describe('updateTemplate', () => {
    it('updates a user template', async () => {
      await useDocumentTemplateStore.getState().addTemplate({
        name: 'Original',
        content: '# Original',
      });
      const id = useDocumentTemplateStore.getState().templates[0]!.id;

      await useDocumentTemplateStore.getState().updateTemplate(id, { name: 'Updated' });
      expect(useDocumentTemplateStore.getState().templates[0]!.name).toBe('Updated');
    });

    it('does not update built-in templates', async () => {
      await useDocumentTemplateStore.getState().updateTemplate('builtin-blog', { name: 'Hacked' });
      const all = useDocumentTemplateStore.getState().getAllTemplates();
      const blog = all.find((t) => t.id === 'builtin-blog')!;
      expect(blog.name).toBe('ブログ記事');
    });
  });

  // =========================================================================
  // deleteTemplate
  // =========================================================================
  describe('deleteTemplate', () => {
    it('deletes a user template', async () => {
      await useDocumentTemplateStore.getState().addTemplate({
        name: 'Temp',
        content: '# Temp',
      });
      const id = useDocumentTemplateStore.getState().templates[0]!.id;

      await useDocumentTemplateStore.getState().deleteTemplate(id);
      expect(useDocumentTemplateStore.getState().templates).toHaveLength(0);
    });

    it('does not delete built-in templates', async () => {
      await useDocumentTemplateStore.getState().deleteTemplate('builtin-blog');
      // built-in templates are not in the store.templates array, they're in getAllTemplates
      const all = useDocumentTemplateStore.getState().getAllTemplates();
      expect(all.find((t) => t.id === 'builtin-blog')).toBeTruthy();
    });
  });

  // =========================================================================
  // expandTemplate
  // =========================================================================
  describe('expandTemplate', () => {
    it('replaces {{date}} placeholder', () => {
      const template = {
        id: 'test',
        name: 'Test',
        content: 'Date: {{date}}',
        createdAt: '',
        updatedAt: '',
      };
      const result = useDocumentTemplateStore.getState().expandTemplate(template);
      expect(result).toMatch(/Date: \d{4}-\d{2}-\d{2}/);
    });

    it('replaces {{filename}} placeholder', () => {
      const template = {
        id: 'test',
        name: 'Test',
        content: 'File: {{filename}}',
        createdAt: '',
        updatedAt: '',
      };
      const result = useDocumentTemplateStore.getState().expandTemplate(template, 'my-doc.md');
      expect(result).toBe('File: my-doc.md');
    });

    it('replaces {{datetime}} placeholder', () => {
      const template = {
        id: 'test',
        name: 'Test',
        content: '{{datetime}}',
        createdAt: '',
        updatedAt: '',
      };
      const result = useDocumentTemplateStore.getState().expandTemplate(template);
      // ISO 8601 format
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it('removes {{cursor}} placeholder', () => {
      const template = {
        id: 'test',
        name: 'Test',
        content: 'Before {{cursor}} After',
        createdAt: '',
        updatedAt: '',
      };
      const result = useDocumentTemplateStore.getState().expandTemplate(template);
      expect(result).toBe('Before  After');
    });

    it('replaces multiple occurrences of same placeholder', () => {
      const template = {
        id: 'test',
        name: 'Test',
        content: '{{date}} and {{date}}',
        createdAt: '',
        updatedAt: '',
      };
      const result = useDocumentTemplateStore.getState().expandTemplate(template);
      const parts = result.split(' and ');
      expect(parts[0]).toBe(parts[1]);
    });

    it('uses "untitled" as default filename', () => {
      const template = {
        id: 'test',
        name: 'Test',
        content: '{{filename}}',
        createdAt: '',
        updatedAt: '',
      };
      const result = useDocumentTemplateStore.getState().expandTemplate(template);
      expect(result).toBe('untitled');
    });
  });
});
