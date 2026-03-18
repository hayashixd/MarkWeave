/**
 * Undo/Redo 独立性テスト
 *
 * CLAUDE.md 制約:
 * - YAML Front Matter (CodeMirror) と本文 (TipTap) の Undo/Redo 履歴は
 *   「独立しているもの」として扱い、無理に統合しようとしないこと。
 *
 * テスト方針:
 * - TipTap と CodeMirror は jsdom 環境でマウントできないため、
 *   undo/redo 独立設計の「契約」をロジックレベルで検証する。
 * - tabStore の YAML + body 分離管理、parseFrontMatter / serializeFrontMatter の
 *   ラウンドトリップ保証を確認する。
 * - 独立したアンドゥスタックのシミュレーションで非干渉を検証する。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useTabStore } from '../tabStore';
import { parseFrontMatter, serializeFrontMatter } from '../../lib/frontmatter';

// ── シンプルな undo スタックのシミュレータ ───────────────────────────────────

class UndoStack<T> {
  private stack: T[] = [];
  private pointer = -1;

  push(state: T): void {
    // 現在位置より後ろを捨てる
    this.stack = this.stack.slice(0, this.pointer + 1);
    this.stack.push(state);
    this.pointer = this.stack.length - 1;
  }

  undo(): T | undefined {
    if (this.pointer <= 0) return undefined;
    this.pointer--;
    return this.stack[this.pointer];
  }

  redo(): T | undefined {
    if (this.pointer >= this.stack.length - 1) return undefined;
    this.pointer++;
    return this.stack[this.pointer];
  }

  current(): T | undefined {
    return this.stack[this.pointer];
  }

  canUndo(): boolean {
    return this.pointer > 0;
  }

  canRedo(): boolean {
    return this.pointer < this.stack.length - 1;
  }
}

// ── tabStore の YAML + body 分離管理テスト ───────────────────────────────────

describe('tabStore - YAML と body の分離管理', () => {
  beforeEach(() => {
    useTabStore.setState({ tabs: [], activeTabId: null, _untitledCounter: 0 });
  });

  it('YAML のみ変更しても body に影響しない', () => {
    const initialContent = '---\ntitle: Old Title\n---\n\n# 本文\n\nテキスト';
    const tabId = useTabStore.getState().addTab({
      filePath: '/note/test.md',
      fileName: 'test.md',
      content: initialContent,
      savedContent: initialContent,
    });

    // YAML だけ変更（body は変えない）
    const { body } = parseFrontMatter(initialContent);
    const newYaml = 'title: New Title';
    const updatedContent = serializeFrontMatter(newYaml, body);
    useTabStore.getState().updateContent(tabId, updatedContent);

    const tab = useTabStore.getState().getTab(tabId);
    expect(tab).toBeTruthy();

    // body 部分が変わっていないことを確認
    const { body: updatedBody } = parseFrontMatter(tab!.content);
    expect(updatedBody).toBe(body);
  });

  it('body のみ変更しても YAML に影響しない', () => {
    const initialContent = '---\ntitle: Title\ndate: 2024-01-01\n---\n\n# 元の本文';
    const tabId = useTabStore.getState().addTab({
      filePath: '/note/test.md',
      fileName: 'test.md',
      content: initialContent,
      savedContent: initialContent,
    });

    // body だけ変更
    const { yaml } = parseFrontMatter(initialContent);
    const newBody = '# 変更後の本文\n\n新しいテキスト';
    const updatedContent = serializeFrontMatter(yaml, newBody);
    useTabStore.getState().updateContent(tabId, updatedContent);

    const tab = useTabStore.getState().getTab(tabId);
    const { yaml: updatedYaml } = parseFrontMatter(tab!.content);
    expect(updatedYaml).toBe(yaml);
  });

  it('YAML と body を別々に変更して正しく統合される', () => {
    const tabId = useTabStore.getState().addTab({
      filePath: '/note/test.md',
      fileName: 'test.md',
      content: '',
      savedContent: '',
    });

    // Step 1: YAML を設定
    const yaml1 = 'title: Draft';
    const body1 = '# はじめに';
    useTabStore.getState().updateContent(tabId, serializeFrontMatter(yaml1, body1));

    // Step 2: body を更新（YAML はそのまま）
    const { yaml: currentYaml } = parseFrontMatter(useTabStore.getState().getTab(tabId)!.content);
    const body2 = '# はじめに\n\n追記しました。';
    useTabStore.getState().updateContent(tabId, serializeFrontMatter(currentYaml, body2));

    // Step 3: YAML を更新（body はそのまま）
    const { body: currentBody } = parseFrontMatter(useTabStore.getState().getTab(tabId)!.content);
    const yaml2 = 'title: Finished\npublished: true';
    useTabStore.getState().updateContent(tabId, serializeFrontMatter(yaml2, currentBody));

    const final = parseFrontMatter(useTabStore.getState().getTab(tabId)!.content);
    expect(final.yaml).toBe(yaml2);
    expect(final.body).toBe(body2);
  });
});

// ── undo スタック独立性シミュレーションテスト ─────────────────────────────────

describe('Undo/Redo スタックの独立性シミュレーション', () => {
  it('YAML の undo が body の履歴に影響しない', () => {
    const yamlStack = new UndoStack<string>();
    const bodyStack = new UndoStack<string>();

    // 初期状態
    yamlStack.push('title: v1');
    bodyStack.push('# Initial body');

    // 両方を編集
    yamlStack.push('title: v2');
    bodyStack.push('# Updated body');
    yamlStack.push('title: v3');

    // YAML の undo → body は変わらない
    const undoneYaml = yamlStack.undo();
    expect(undoneYaml).toBe('title: v2');
    expect(bodyStack.current()).toBe('# Updated body'); // 変わっていない

    // body の undo → YAML は変わらない
    const undoneBody = bodyStack.undo();
    expect(undoneBody).toBe('# Initial body');
    expect(yamlStack.current()).toBe('title: v2'); // 変わっていない
  });

  it('body の redo が YAML の履歴に影響しない', () => {
    const yamlStack = new UndoStack<string>();
    const bodyStack = new UndoStack<string>();

    yamlStack.push('title: init');
    bodyStack.push('# v1');
    bodyStack.push('# v2');
    bodyStack.push('# v3');

    // body を 2 回 undo → v1 に戻る
    bodyStack.undo();
    bodyStack.undo();
    expect(bodyStack.current()).toBe('# v1');

    // YAML は変化なし
    expect(yamlStack.current()).toBe('title: init');

    // body を redo
    const redoneBody = bodyStack.redo();
    expect(redoneBody).toBe('# v2');
    expect(yamlStack.current()).toBe('title: init'); // 変わっていない
  });

  it('YAML が undo できなくても body の undo は独立して動く', () => {
    const yamlStack = new UndoStack<string>();
    const bodyStack = new UndoStack<string>();

    yamlStack.push('title: only one state');
    bodyStack.push('# v1');
    bodyStack.push('# v2');

    // YAML は undo できない（初期状態が唯一）
    expect(yamlStack.canUndo()).toBe(false);
    expect(yamlStack.undo()).toBeUndefined();

    // body は独立して undo できる
    expect(bodyStack.canUndo()).toBe(true);
    const undoneBody = bodyStack.undo();
    expect(undoneBody).toBe('# v1');
  });

  it('undo/redo サイクル後の canUndo/canRedo フラグが正確', () => {
    const stack = new UndoStack<string>();
    stack.push('s1');
    stack.push('s2');
    stack.push('s3');

    expect(stack.canUndo()).toBe(true);
    expect(stack.canRedo()).toBe(false);

    stack.undo(); // s3 → s2
    expect(stack.canUndo()).toBe(true);
    expect(stack.canRedo()).toBe(true);

    stack.undo(); // s2 → s1
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(true);

    stack.redo(); // s1 → s2
    stack.push('s2-modified'); // 新しい変更で redo 枝を切る
    expect(stack.canRedo()).toBe(false);
  });
});

// ── parseFrontMatter / serializeFrontMatter ラウンドトリップテスト ────────────

describe('parseFrontMatter / serializeFrontMatter ラウンドトリップ', () => {
  it('YAML と body を分解して再合成すると同一の内容になる', () => {
    const original = '---\ntitle: Test\ndate: 2024-01-01\n---\n\n# Heading\n\nBody text.';
    const { yaml, body } = parseFrontMatter(original);
    const roundTripped = serializeFrontMatter(yaml, body);

    // 再合成後も同じ内容を parse できること
    const { yaml: yaml2, body: body2 } = parseFrontMatter(roundTripped);
    expect(yaml2).toBe(yaml);
    expect(body2).toBe(body);
  });

  it('YAML なし文書は body のみで再合成される', () => {
    const original = '# No front matter\n\nJust body.';
    const { yaml, body } = parseFrontMatter(original);
    expect(yaml).toBe('');
    expect(body).toBe(original);
  });

  it('undo 操作を模倣: 前の YAML + 現在の body で正しく再合成できる', () => {
    const yaml_v1 = 'title: Draft';
    const yaml_v2 = 'title: Published\npublished: true';
    const body = '# Article content\n\nBody text here.';

    // 現在の状態: yaml_v2 + body
    const current = serializeFrontMatter(yaml_v2, body);
    expect(parseFrontMatter(current).yaml).toBe(yaml_v2);

    // YAML を undo した場合: yaml_v1 + 同じ body
    const afterUndo = serializeFrontMatter(yaml_v1, body);
    const { yaml: resultYaml, body: resultBody } = parseFrontMatter(afterUndo);
    expect(resultYaml).toBe(yaml_v1);
    expect(resultBody).toBe(body); // body は変わらない
  });
});
