import { describe, it, expect, vi } from 'vitest';
import { loadAllTemplates, getTemplateById } from './template-registry';
import { BUILTIN_TEMPLATES } from './templates/builtin';
import type { AiEditTemplate } from './types';

// ── loadUserTemplates のモック ─────────────────────────────────────────────────

vi.mock('./template-storage', () => ({
  loadUserTemplates: vi.fn(async () => []),
}));

import { loadUserTemplates } from './template-storage';

function makeUserTemplate(id: string): AiEditTemplate {
  return {
    id,
    name: `User ${id}`,
    icon: 'test',
    description: 'desc',
    source: 'user',
    persona: 'p',
    task: 't',
    constraints: [],
    outputFormat: 'o',
    autoSelect: { requiresSelection: true, priority: 1 },
  };
}

// ── loadAllTemplates ──────────────────────────────────────────────────────────

describe('loadAllTemplates', () => {
  it('ユーザーテンプレートがないとき組み込みテンプレートだけ返す', async () => {
    vi.mocked(loadUserTemplates).mockResolvedValue([]);
    const all = await loadAllTemplates();
    expect(all).toEqual(BUILTIN_TEMPLATES);
  });

  it('組み込みテンプレートが結果の先頭に来る', async () => {
    vi.mocked(loadUserTemplates).mockResolvedValue([makeUserTemplate('user-1')]);
    const all = await loadAllTemplates();
    expect(all[0]!.id).toBe(BUILTIN_TEMPLATES[0]!.id);
  });

  it('ユーザーテンプレートが組み込みの後に続く', async () => {
    const userTmpl = makeUserTemplate('user-1');
    vi.mocked(loadUserTemplates).mockResolvedValue([userTmpl]);
    const all = await loadAllTemplates();
    expect(all[all.length - 1]!.id).toBe('user-1');
  });

  it('組み込み + ユーザーの合計数が正しい', async () => {
    const userTemplates = [makeUserTemplate('u1'), makeUserTemplate('u2')];
    vi.mocked(loadUserTemplates).mockResolvedValue(userTemplates);
    const all = await loadAllTemplates();
    expect(all).toHaveLength(BUILTIN_TEMPLATES.length + 2);
  });
});

// ── getTemplateById ───────────────────────────────────────────────────────────

describe('getTemplateById', () => {
  const allTemplates: AiEditTemplate[] = [
    ...BUILTIN_TEMPLATES,
    makeUserTemplate('user-custom'),
  ];

  it('存在する組み込み ID でテンプレートを返す', () => {
    const tmpl = getTemplateById(allTemplates, 'builtin-proofread');
    expect(tmpl).toBeDefined();
    expect(tmpl!.id).toBe('builtin-proofread');
  });

  it('存在するユーザー ID でテンプレートを返す', () => {
    const tmpl = getTemplateById(allTemplates, 'user-custom');
    expect(tmpl).toBeDefined();
    expect(tmpl!.id).toBe('user-custom');
  });

  it('存在しない ID で undefined を返す', () => {
    const tmpl = getTemplateById(allTemplates, 'nonexistent-id');
    expect(tmpl).toBeUndefined();
  });

  it('空の ID で undefined を返す', () => {
    const tmpl = getTemplateById(allTemplates, '');
    expect(tmpl).toBeUndefined();
  });

  it('空のテンプレートリストで undefined を返す', () => {
    const tmpl = getTemplateById([], 'builtin-proofread');
    expect(tmpl).toBeUndefined();
  });
});
