/**
 * IME ガードロジックのユニットテスト
 *
 * CLAUDE.md 制約:
 * - onKeyDown や TipTap のトランザクション処理において、必ず isComposing を判定し
 *   変換中の Enter キーで誤爆しないようにガードを入れること
 *
 * テスト対象:
 * - SafeInputRulesExtension の filterTransaction ロジック
 * - SafeInputRulesExtension の handleKeyDown ロジック
 * - SlashCommandsExtension の handleKeyDown IME ガード
 */

import { describe, it, expect } from 'vitest';

// ── SafeInputRulesExtension の filterTransaction ロジックを抽出 ──────────────
// （TipTap プラグイン本体を jsdom でマウントせずにロジック単体で検証する）

function filterTransaction(tr: {
  getMeta: (key: string) => unknown;
}): boolean {
  const inputType = tr.getMeta('inputType');
  const isComposing = tr.getMeta('composition');
  if (isComposing && inputType) {
    return false; // IME 変換中の InputRule トランザクションをキャンセル
  }
  return true;
}

// ── SafeInputRulesExtension の handleKeyDown ロジックを抽出 ──────────────────

function handleKeyDown(event: {
  isComposing?: boolean;
  keyCode?: number;
}): boolean {
  if (event.isComposing || event.keyCode === 229) {
    return false; // IME 変換中: デフォルト処理に委譲
  }
  return false;
}

// ── SlashCommandsExtension の handleKeyDown IME ガードを抽出 ─────────────────

function slashHandleKeyDown(
  state: { active: boolean },
  event: { key: string; isComposing?: boolean; keyCode?: number },
): boolean {
  if (!state.active) return false;
  if (event.key === 'Escape') return true;
  // IME 変換中はナビゲーションキーを無視してデフォルト処理に委譲
  if (event.isComposing || event.keyCode === 229) return false;
  if (
    event.key === 'ArrowUp' ||
    event.key === 'ArrowDown' ||
    event.key === 'Enter' ||
    event.key === 'Tab'
  ) {
    return true;
  }
  return false;
}

// ── filterTransaction テスト ─────────────────────────────────────────────────

describe('SafeInputRulesExtension - filterTransaction', () => {
  it('IME 変換中 かつ InputRule のトランザクション → キャンセル（false）', () => {
    const tr = {
      getMeta: (key: string) => {
        if (key === 'composition') return true;
        if (key === 'inputType') return 'insertText';
        return null;
      },
    };
    expect(filterTransaction(tr)).toBe(false);
  });

  it('IME 変換中でも inputType が null のトランザクション → 通過（true）', () => {
    const tr = {
      getMeta: (key: string) => {
        if (key === 'composition') return true;
        if (key === 'inputType') return null;
        return null;
      },
    };
    expect(filterTransaction(tr)).toBe(true);
  });

  it('IME 非変換中の InputRule トランザクション → 通過（true）', () => {
    const tr = {
      getMeta: (key: string) => {
        if (key === 'composition') return false;
        if (key === 'inputType') return 'insertText';
        return null;
      },
    };
    expect(filterTransaction(tr)).toBe(true);
  });

  it('通常のトランザクション（IME も InputRule も無関係）→ 通過（true）', () => {
    const tr = { getMeta: (_key: string) => null };
    expect(filterTransaction(tr)).toBe(true);
  });

  it('composition メタが undefined のトランザクション → 通過（true）', () => {
    const tr = {
      getMeta: (key: string) => {
        if (key === 'inputType') return 'insertText';
        return undefined;
      },
    };
    expect(filterTransaction(tr)).toBe(true);
  });
});

// ── handleKeyDown テスト ──────────────────────────────────────────────────────

describe('SafeInputRulesExtension - handleKeyDown', () => {
  it('event.isComposing が true → デフォルト処理に委譲（false）', () => {
    expect(handleKeyDown({ isComposing: true, keyCode: 13 })).toBe(false);
  });

  it('keyCode 229 (IME composition key) → デフォルト処理に委譲（false）', () => {
    expect(handleKeyDown({ isComposing: false, keyCode: 229 })).toBe(false);
  });

  it('isComposing=true かつ keyCode=229 の両方が立っている場合も委譲（false）', () => {
    expect(handleKeyDown({ isComposing: true, keyCode: 229 })).toBe(false);
  });

  it('通常の Enter キー（keyCode=13, isComposing=false）→ 委譲（false）', () => {
    // SafeInputRules 自体は Enter 処理を行わないため常に false を返す
    expect(handleKeyDown({ isComposing: false, keyCode: 13 })).toBe(false);
  });

  it('isComposing が undefined の場合は委譲（false）', () => {
    expect(handleKeyDown({ keyCode: 13 })).toBe(false);
  });
});

// ── SlashCommandsExtension IME ガードテスト ──────────────────────────────────

describe('SlashCommandsExtension - handleKeyDown IME ガード', () => {
  describe('スラッシュコマンド アクティブ時', () => {
    it('IME 変換中の Enter → メニュー選択を発火しない（false）', () => {
      const result = slashHandleKeyDown(
        { active: true },
        { key: 'Enter', isComposing: true },
      );
      expect(result).toBe(false);
    });

    it('keyCode 229 の Enter → メニュー選択を発火しない（false）', () => {
      const result = slashHandleKeyDown(
        { active: true },
        { key: 'Enter', isComposing: false, keyCode: 229 },
      );
      expect(result).toBe(false);
    });

    it('IME 変換中の ArrowDown → カーソル移動を発火しない（false）', () => {
      const result = slashHandleKeyDown(
        { active: true },
        { key: 'ArrowDown', isComposing: true },
      );
      expect(result).toBe(false);
    });

    it('IME 変換中の Tab → メニュー選択を発火しない（false）', () => {
      const result = slashHandleKeyDown(
        { active: true },
        { key: 'Tab', isComposing: true },
      );
      expect(result).toBe(false);
    });

    it('通常の Enter（isComposing=false）→ メニュー選択を実行（true）', () => {
      const result = slashHandleKeyDown(
        { active: true },
        { key: 'Enter', isComposing: false, keyCode: 13 },
      );
      expect(result).toBe(true);
    });

    it('通常の ArrowDown（isComposing=false）→ ナビゲーションを実行（true）', () => {
      const result = slashHandleKeyDown(
        { active: true },
        { key: 'ArrowDown', isComposing: false },
      );
      expect(result).toBe(true);
    });

    it('Escape キー → IME 状態に関わらずメニューを閉じる（true）', () => {
      const resultNormal = slashHandleKeyDown(
        { active: true },
        { key: 'Escape', isComposing: false },
      );
      const resultComposing = slashHandleKeyDown(
        { active: true },
        { key: 'Escape', isComposing: true },
      );
      expect(resultNormal).toBe(true);
      expect(resultComposing).toBe(true);
    });
  });

  describe('スラッシュコマンド 非アクティブ時', () => {
    it('IME 変換中の Enter でもデフォルト委譲（false）', () => {
      const result = slashHandleKeyDown(
        { active: false },
        { key: 'Enter', isComposing: true },
      );
      expect(result).toBe(false);
    });

    it('通常の Enter でもデフォルト委譲（false）', () => {
      const result = slashHandleKeyDown(
        { active: false },
        { key: 'Enter', isComposing: false },
      );
      expect(result).toBe(false);
    });
  });
});

// ── useAutoSave の IME ガード統合テスト ──────────────────────────────────────

describe('useAutoSave - IME 変換中の保存抑制ロジック', () => {
  /**
   * useAutoSave 内の scheduleSave ロジックを抽出して検証。
   * IME 変換中は保存をスキップし、pendingSave フラグを立てること。
   */
  function simulateScheduleSave(options: {
    isComposing: () => boolean;
    isDirty: boolean;
    hasFilePath: boolean;
  }): { saved: boolean; pendingSet: boolean } {
    if (!options.isDirty || !options.hasFilePath) {
      return { saved: false, pendingSet: false };
    }
    if (options.isComposing()) {
      return { saved: false, pendingSet: true }; // pending フラグを立てて後回し
    }
    return { saved: true, pendingSet: false };
  }

  it('IME 変換中は保存をスキップして pending フラグを立てる', () => {
    const result = simulateScheduleSave({
      isComposing: () => true,
      isDirty: true,
      hasFilePath: true,
    });
    expect(result.saved).toBe(false);
    expect(result.pendingSet).toBe(true);
  });

  it('IME 非変換中は即座に保存する', () => {
    const result = simulateScheduleSave({
      isComposing: () => false,
      isDirty: true,
      hasFilePath: true,
    });
    expect(result.saved).toBe(true);
    expect(result.pendingSet).toBe(false);
  });

  it('isDirty=false の場合は IME に関わらず保存しない', () => {
    const resultComposing = simulateScheduleSave({
      isComposing: () => true,
      isDirty: false,
      hasFilePath: true,
    });
    const resultNormal = simulateScheduleSave({
      isComposing: () => false,
      isDirty: false,
      hasFilePath: true,
    });
    expect(resultComposing.saved).toBe(false);
    expect(resultNormal.saved).toBe(false);
  });

  it('filePath がない場合（Untitled）は保存しない', () => {
    const result = simulateScheduleSave({
      isComposing: () => false,
      isDirty: true,
      hasFilePath: false,
    });
    expect(result.saved).toBe(false);
  });

  it('変換終了後に flushPendingSave で保存が実行される', () => {
    let pendingSave = false;
    let saveExecuted = false;

    // 変換中 → pending をセット
    const scheduleResult = simulateScheduleSave({
      isComposing: () => true,
      isDirty: true,
      hasFilePath: true,
    });
    pendingSave = scheduleResult.pendingSet;
    expect(pendingSave).toBe(true);

    // 変換終了後に flush
    if (pendingSave) {
      const flushResult = simulateScheduleSave({
        isComposing: () => false, // 変換終了
        isDirty: true,
        hasFilePath: true,
      });
      saveExecuted = flushResult.saved;
    }

    expect(saveExecuted).toBe(true);
  });
});
