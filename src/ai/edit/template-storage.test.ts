import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadUserTemplates, saveUserTemplate, deleteUserTemplate } from './template-storage';
import type { AiEditTemplate } from './types';

// ── @tauri-apps/plugin-store のモック ─────────────────────────────────────────

const storeData: Record<string, unknown> = {};

const mockStore = {
  get: vi.fn(async (key: string) => storeData[key] ?? null),
  set: vi.fn(async (key: string, value: unknown) => { storeData[key] = value; }),
  save: vi.fn(async () => {}),
};

vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn(async () => mockStore),
}));

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function makeTemplate(id: string): AiEditTemplate {
  return {
    id,
    name: `Template ${id}`,
    icon: 'test',
    description: 'test description',
    source: 'user',
    persona: 'persona',
    task: 'task',
    constraints: [{ text: 'constraint 1', defaultEnabled: true }],
    outputFormat: 'output format',
    autoSelect: { requiresSelection: true, priority: 1 },
  };
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe('template-storage', () => {
  beforeEach(() => {
    // ストアをリセット
    for (const key of Object.keys(storeData)) {
      delete storeData[key];
    }
    vi.clearAllMocks();
    mockStore.get.mockImplementation(async (key: string) => storeData[key] ?? null);
    mockStore.set.mockImplementation(async (key: string, value: unknown) => { storeData[key] = value; });
  });

  // ── loadUserTemplates ───────────────────────────────────────────────────────

  describe('loadUserTemplates', () => {
    it('ストアが空のとき空配列を返す', async () => {
      const templates = await loadUserTemplates();
      expect(templates).toEqual([]);
    });

    it('保存済みテンプレートを返す', async () => {
      storeData['templates'] = [makeTemplate('t1'), makeTemplate('t2')];
      const templates = await loadUserTemplates();
      expect(templates).toHaveLength(2);
      expect(templates[0]!.id).toBe('t1');
    });
  });

  // ── saveUserTemplate ────────────────────────────────────────────────────────

  describe('saveUserTemplate', () => {
    it('新規テンプレートが保存される', async () => {
      const tmpl = makeTemplate('new-1');
      await saveUserTemplate(tmpl);

      const saved = storeData['templates'] as AiEditTemplate[];
      expect(saved).toHaveLength(1);
      expect(saved[0]!.id).toBe('new-1');
    });

    it('source が user に強制される', async () => {
      const tmpl = { ...makeTemplate('x'), source: 'builtin' as const };
      await saveUserTemplate(tmpl);

      const saved = storeData['templates'] as AiEditTemplate[];
      expect(saved[0]!.source).toBe('user');
    });

    it('id が空のとき user-{uuid} 形式の id が付与される', async () => {
      const tmpl = { ...makeTemplate(''), id: '' };
      await saveUserTemplate(tmpl);

      const saved = storeData['templates'] as AiEditTemplate[];
      expect(saved[0]!.id).toMatch(/^user-/);
    });

    it('同じ id のテンプレートを保存すると上書きされる', async () => {
      const tmpl1 = { ...makeTemplate('dup'), name: 'First' };
      const tmpl2 = { ...makeTemplate('dup'), name: 'Second' };

      await saveUserTemplate(tmpl1);
      await saveUserTemplate(tmpl2);

      const saved = storeData['templates'] as AiEditTemplate[];
      expect(saved).toHaveLength(1);
      expect(saved[0]!.name).toBe('Second');
    });

    it('複数テンプレートを順番に保存できる', async () => {
      await saveUserTemplate(makeTemplate('a'));
      await saveUserTemplate(makeTemplate('b'));
      await saveUserTemplate(makeTemplate('c'));

      const saved = storeData['templates'] as AiEditTemplate[];
      expect(saved).toHaveLength(3);
      expect(saved.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    });

    it('保存後に store.save() が呼ばれる', async () => {
      await saveUserTemplate(makeTemplate('x'));
      expect(mockStore.save).toHaveBeenCalledOnce();
    });
  });

  // ── deleteUserTemplate ──────────────────────────────────────────────────────

  describe('deleteUserTemplate', () => {
    it('指定した id のテンプレートが削除される', async () => {
      storeData['templates'] = [makeTemplate('keep'), makeTemplate('del')];
      await deleteUserTemplate('del');

      const saved = storeData['templates'] as AiEditTemplate[];
      expect(saved).toHaveLength(1);
      expect(saved[0]!.id).toBe('keep');
    });

    it('存在しない id を削除しても他のテンプレートは変わらない', async () => {
      storeData['templates'] = [makeTemplate('a')];
      await deleteUserTemplate('nonexistent');

      const saved = storeData['templates'] as AiEditTemplate[];
      expect(saved).toHaveLength(1);
      expect(saved[0]!.id).toBe('a');
    });

    it('空リストに対して削除しても空のまま', async () => {
      // storeData['templates'] が存在しない場合
      await deleteUserTemplate('any-id');
      const saved = storeData['templates'] as AiEditTemplate[];
      expect(saved).toEqual([]);
    });

    it('削除後に store.save() が呼ばれる', async () => {
      storeData['templates'] = [makeTemplate('t')];
      await deleteUserTemplate('t');
      expect(mockStore.save).toHaveBeenCalledOnce();
    });
  });
});
