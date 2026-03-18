import { describe, it, expect } from 'vitest';
import { autoSelectTemplate } from './auto-select';
import { BUILTIN_TEMPLATES } from './templates/builtin';
import type { AiEditTemplate } from './types';

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function makeTemplate(
  id: string,
  requiresSelection: boolean,
  priority: number,
  cursorPosition?: 'end' | 'any',
): AiEditTemplate {
  return {
    id,
    name: id,
    icon: 'test',
    description: 'test',
    source: 'builtin',
    persona: 'persona',
    task: 'task',
    constraints: [],
    outputFormat: 'output',
    autoSelect: { requiresSelection, priority, cursorPosition },
  };
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe('autoSelectTemplate', () => {
  describe('選択あり（hasSelection=true）', () => {
    it('requiresSelection=true のテンプレートだけを候補にする', () => {
      const templates = [
        makeTemplate('needs-sel', true, 1),
        makeTemplate('no-sel', false, 0),
      ];
      const result = autoSelectTemplate(templates, {
        hasSelection: true,
        selectionLength: 10,
        cursorAtEnd: false,
      });
      expect(result.id).toBe('needs-sel');
    });

    it('requiresSelection=false のテンプレートは除外する', () => {
      const templates = [
        makeTemplate('continue', false, 1),
        makeTemplate('proofread', true, 2),
      ];
      const result = autoSelectTemplate(templates, {
        hasSelection: true,
        selectionLength: 5,
        cursorAtEnd: false,
      });
      expect(result.id).toBe('proofread');
    });

    it('複数候補があれば priority の低い値（高優先度）を選ぶ', () => {
      const templates = [
        makeTemplate('low-pri', true, 3),
        makeTemplate('high-pri', true, 1),
        makeTemplate('mid-pri', true, 2),
      ];
      const result = autoSelectTemplate(templates, {
        hasSelection: true,
        selectionLength: 5,
        cursorAtEnd: false,
      });
      expect(result.id).toBe('high-pri');
    });
  });

  describe('選択なし（hasSelection=false）', () => {
    it('requiresSelection=false のテンプレートだけを候補にする', () => {
      const templates = [
        makeTemplate('needs-sel', true, 1),
        makeTemplate('no-sel', false, 1),
      ];
      const result = autoSelectTemplate(templates, {
        hasSelection: false,
        selectionLength: 0,
        cursorAtEnd: false,
      });
      expect(result.id).toBe('no-sel');
    });

    it('cursorPosition=end かつ cursorAtEnd=true のとき候補に含む', () => {
      const templates = [
        makeTemplate('continue', false, 1, 'end'),
      ];
      const result = autoSelectTemplate(templates, {
        hasSelection: false,
        selectionLength: 0,
        cursorAtEnd: true,
      });
      expect(result.id).toBe('continue');
    });

    it('cursorPosition=end かつ cursorAtEnd=false のとき候補から除外する', () => {
      const templates = [
        makeTemplate('continue', false, 1, 'end'),
        makeTemplate('fallback', false, 2),
      ];
      const result = autoSelectTemplate(templates, {
        hasSelection: false,
        selectionLength: 0,
        cursorAtEnd: false,
      });
      expect(result.id).toBe('fallback');
    });

    it('cursorPosition=any は cursorAtEnd に関わらず候補に含む', () => {
      const templates = [makeTemplate('any-pos', false, 1, 'any')];
      const resultAtEnd = autoSelectTemplate(templates, {
        hasSelection: false,
        selectionLength: 0,
        cursorAtEnd: true,
      });
      const resultMiddle = autoSelectTemplate(templates, {
        hasSelection: false,
        selectionLength: 0,
        cursorAtEnd: false,
      });
      expect(resultAtEnd.id).toBe('any-pos');
      expect(resultMiddle.id).toBe('any-pos');
    });
  });

  describe('フォールバック', () => {
    it('候補がゼロの場合は templates[0] を返す', () => {
      const templates = [
        makeTemplate('first', true, 1),
        makeTemplate('second', true, 2),
      ];
      // 選択なし → requiresSelection=true テンプレートは全除外 → fallback
      const result = autoSelectTemplate(templates, {
        hasSelection: false,
        selectionLength: 0,
        cursorAtEnd: false,
      });
      expect(result.id).toBe('first');
    });
  });

  describe('組み込みテンプレートとの統合', () => {
    it('選択ありなら 校正（priority=1）が自動選択される', () => {
      const result = autoSelectTemplate(BUILTIN_TEMPLATES, {
        hasSelection: true,
        selectionLength: 20,
        cursorAtEnd: false,
      });
      expect(result.id).toBe('builtin-proofread');
    });

    it('選択なし＋カーソル末尾なら 続きを書く が選ばれる', () => {
      const result = autoSelectTemplate(BUILTIN_TEMPLATES, {
        hasSelection: false,
        selectionLength: 0,
        cursorAtEnd: true,
      });
      expect(result.id).toBe('builtin-continue');
    });
  });
});
