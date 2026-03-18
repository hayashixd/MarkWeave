/**
 * skipActivate オプションの動作検証テスト
 *
 * 修正内容 (tabStore / paneStore / useOpenFileAsTab 等):
 *   複数ファイルを一括で開く際、中間タブが activeTabId を書き換えることで
 *   エディタが N 回マウント/アンマウントされフリーズする問題を修正。
 *   skipActivate: true を渡すとタブ追加のみ行い、activeTabId を変更しない。
 *
 * テストシナリオ:
 *   1. addTab(skipActivate: false) → 従来通り activeTabId が更新される
 *   2. addTab(skipActivate: true)  → activeTabId は変更されない
 *   3. 複数ファイル一括オープン相当 → 最後のファイルのみがアクティブになる
 *   4. addTabToPane(skipActivate: true) → pane.activeTabId が変更されない
 *   5. 既存タブ (dup) + skipActivate: true → フォーカスしない
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useTabStore } from '../tabStore';
import { usePaneStore } from '../paneStore';

// ストアをリセットするユーティリティ
function resetStores() {
  useTabStore.setState({
    tabs: [],
    activeTabId: null,
    _untitledCounter: 0,
  });
  usePaneStore.setState({
    layout: { type: 'single', splitRatio: 0.5 },
    panes: [{ id: 'pane-1', tabs: [], activeTabId: null }],
    activePaneId: 'pane-1',
    scrollSyncEnabled: true,
  });
}

describe('addTab / skipActivate', () => {
  beforeEach(resetStores);

  it('skipActivate 未指定（デフォルト）で activeTabId が更新される', () => {
    const { addTab } = useTabStore.getState();

    const id = addTab({ filePath: '/a.md', fileName: 'a.md', content: '', savedContent: '' });

    expect(useTabStore.getState().activeTabId).toBe(id);
  });

  it('skipActivate: false で activeTabId が更新される', () => {
    const { addTab } = useTabStore.getState();

    const id = addTab({
      filePath: '/a.md',
      fileName: 'a.md',
      content: '',
      savedContent: '',
      skipActivate: false,
    });

    expect(useTabStore.getState().activeTabId).toBe(id);
  });

  it('skipActivate: true で activeTabId が変更されない', () => {
    const { addTab } = useTabStore.getState();

    // まず通常のタブを追加してアクティブにする
    const first = addTab({ filePath: '/a.md', fileName: 'a.md', content: '', savedContent: '' });
    expect(useTabStore.getState().activeTabId).toBe(first);

    // 2 枚目を skipActivate: true で追加
    const second = addTab({
      filePath: '/b.md',
      fileName: 'b.md',
      content: '',
      savedContent: '',
      skipActivate: true,
    });

    // タブ自体は追加されている
    expect(useTabStore.getState().tabs).toHaveLength(2);
    expect(useTabStore.getState().tabs.find((t) => t.id === second)).toBeDefined();

    // activeTabId は first のまま
    expect(useTabStore.getState().activeTabId).toBe(first);
  });

  it('複数ファイル一括オープン相当: 最後のファイルのみアクティブ', () => {
    const { addTab } = useTabStore.getState();
    const paths = ['/a.md', '/b.md', '/c.md'];

    let lastId: string = '';
    for (let i = 0; i < paths.length; i++) {
      const isLast = i === paths.length - 1;
      const id = addTab({
        filePath: paths[i]!,
        fileName: paths[i]!,
        content: '',
        savedContent: '',
        skipActivate: !isLast,
      });
      if (isLast) lastId = id;
    }

    expect(useTabStore.getState().tabs).toHaveLength(3);
    // アクティブになるのは最後の 1 つだけ
    expect(useTabStore.getState().activeTabId).toBe(lastId);
  });

  it('skipActivate: true で activeTabId が null のまま 3 タブ追加 → setActiveTab で確定', () => {
    const { addTab, setActiveTab } = useTabStore.getState();

    const ids = ['/s1.md', '/s2.md', '/s3.md'].map((p) =>
      addTab({ filePath: p, fileName: p, content: '', savedContent: '', skipActivate: true }),
    );

    // まだ誰もアクティブでない
    expect(useTabStore.getState().activeTabId).toBeNull();

    // セッション復元の setActiveTab 相当
    setActiveTab(ids[1]!);
    expect(useTabStore.getState().activeTabId).toBe(ids[1]);
  });

  it('既に開いているファイル + skipActivate: true → フォーカスしない', () => {
    const { addTab } = useTabStore.getState();

    const first = addTab({ filePath: '/dup.md', fileName: 'dup.md', content: '', savedContent: '' });
    // 別タブをアクティブに
    const second = addTab({ filePath: '/other.md', fileName: 'other.md', content: '', savedContent: '' });
    expect(useTabStore.getState().activeTabId).toBe(second);

    // 重複ファイルを skipActivate: true で再度開く
    addTab({ filePath: '/dup.md', fileName: 'dup.md', content: '', savedContent: '', skipActivate: true });

    // アクティブは second のまま（dup にフォーカスしない）
    expect(useTabStore.getState().activeTabId).toBe(second);
    // タブ数は増えない（重複なし）
    expect(useTabStore.getState().tabs).toHaveLength(2);
    // first は残っている
    expect(useTabStore.getState().tabs.find((t) => t.id === first)).toBeDefined();
  });
});

describe('addTabToPane / skipActivate', () => {
  beforeEach(resetStores);

  it('skipActivate 未指定で pane.activeTabId が更新される', () => {
    const { addTabToPane } = usePaneStore.getState();

    addTabToPane('tab-x');

    expect(usePaneStore.getState().panes[0]?.activeTabId).toBe('tab-x');
  });

  it('skipActivate: true で pane.activeTabId が変更されない', () => {
    const { addTabToPane } = usePaneStore.getState();

    // まず通常タブ → アクティブになる
    addTabToPane('tab-a');
    expect(usePaneStore.getState().panes[0]?.activeTabId).toBe('tab-a');

    // 次のタブを skipActivate: true で追加
    addTabToPane('tab-b', undefined, true);

    // タブ一覧には追加されている
    expect(usePaneStore.getState().panes[0]?.tabs).toContain('tab-b');
    // pane.activeTabId は tab-a のまま
    expect(usePaneStore.getState().panes[0]?.activeTabId).toBe('tab-a');
  });

  it('pane が空の状態で skipActivate: true → activeTabId は null のまま', () => {
    const { addTabToPane } = usePaneStore.getState();

    addTabToPane('tab-z', undefined, true);

    expect(usePaneStore.getState().panes[0]?.tabs).toContain('tab-z');
    // 空ペインに skipActivate: true → null のまま
    expect(usePaneStore.getState().panes[0]?.activeTabId).toBeNull();
  });

  it('バッチ追加 → setPaneActiveTab で最終的に 1 回だけアクティブ化', () => {
    const { addTabToPane, setPaneActiveTab } = usePaneStore.getState();

    addTabToPane('t1', undefined, true);
    addTabToPane('t2', undefined, true);
    addTabToPane('t3', undefined, true);

    // まだ誰もアクティブでない
    expect(usePaneStore.getState().panes[0]?.activeTabId).toBeNull();

    // セッション復元の setPaneActiveTab 相当
    setPaneActiveTab('pane-1', 't2');
    expect(usePaneStore.getState().panes[0]?.activeTabId).toBe('t2');
  });
});
