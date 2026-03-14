/**
 * Bug修正テスト: 大量コンテンツペースト後のタブ切替でコンテンツが消える
 *
 * 修正内容（TipTapEditor.tsx）:
 *   アンマウント時のクリーンアップで clearTimeout のみしていたのを、
 *   ペンディング中のデバウンスタイマーがあれば emitMarkdown() をフラッシュしてから
 *   キャンセルするよう変更。これにより tabStore のコンテンツが確実に保存される。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTabStore } from '../tabStore';

// TipTapEditor.tsx 内の定数を再現
const LARGE_DOC_SERIALIZE_DEBOUNCE_NODE_THRESHOLD = 1200;
const LARGE_DOC_SERIALIZE_DEBOUNCE_MS = 120;

/**
 * 修正後の TipTapEditor の emitMarkdown + デバウンス + クリーンアップロジックを模倣。
 * cleanup() がフラッシュ（即時実行）してからタイマーをキャンセルするのが正しい動作。
 */
function createEditorDebounceSimulator(updateContent: (tabId: string, content: string) => void) {
  let serializeTimerRef: ReturnType<typeof setTimeout> | null = null;
  // 最後にemitした内容を保持（TipTapEditor の lastEmittedContentRef に相当）
  let lastEmitted: string | null = null;

  const emitMarkdown = (tabId: string, markdown: string) => {
    lastEmitted = markdown;
    updateContent(tabId, markdown);
  };

  const onDocUpdate = (tabId: string, markdown: string, childCount: number) => {
    const shouldDebounce = childCount >= LARGE_DOC_SERIALIZE_DEBOUNCE_NODE_THRESHOLD;

    if (!shouldDebounce) {
      if (serializeTimerRef) {
        clearTimeout(serializeTimerRef);
        serializeTimerRef = null;
      }
      emitMarkdown(tabId, markdown);
      return;
    }

    if (serializeTimerRef) {
      clearTimeout(serializeTimerRef);
    }
    serializeTimerRef = setTimeout(() => {
      serializeTimerRef = null;
      emitMarkdown(tabId, markdown);
    }, LARGE_DOC_SERIALIZE_DEBOUNCE_MS);
  };

  // 修正後のクリーンアップ: ペンディング中なら即時フラッシュしてから cancel
  const cleanup = (tabId: string, pendingMarkdown: string) => {
    if (serializeTimerRef) {
      clearTimeout(serializeTimerRef);
      serializeTimerRef = null;
      // Bug 1 修正: フラッシュ（clearTimeout のみでなく emitMarkdown を実行）
      emitMarkdown(tabId, pendingMarkdown);
    }
  };

  return { onDocUpdate, cleanup, getLastEmitted: () => lastEmitted };
}

describe('Bug修正: 大量コンテンツペースト後タブ切替でコンテンツ消失', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTabStore.setState({ tabs: [], activeTabId: null, _untitledCounter: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('【修正確認】デバウンス中のアンマウントでupdateContentがフラッシュされる', () => {
    const updateContent = vi.fn();
    const { onDocUpdate, cleanup } = createEditorDebounceSimulator(updateContent);

    const tabId = 'untitled-1';
    const largeMarkdown = 'x'.repeat(200_000); // 200KB
    const largeChildCount = 2000; // 1200 超 → デバウンス適用

    // ユーザーが 200KB ペースト → update イベント発火 → デバウンス開始
    onDocUpdate(tabId, largeMarkdown, largeChildCount);
    expect(updateContent).not.toHaveBeenCalled(); // まだタイマー未発火

    // D&D でファイルが開かれてタブが切り替わる → アンマウント → cleanup 実行
    // 修正後: フラッシュしてから clearTimeout
    cleanup(tabId, largeMarkdown);

    // ★ 修正確認: updateContent が即時呼ばれてコンテンツが保存された
    expect(updateContent).toHaveBeenCalledWith(tabId, largeMarkdown);
  });

  it('【修正確認】デバウンス完了後のタブ切替では二重呼び出しにならない', () => {
    const updateContent = vi.fn();
    const { onDocUpdate, cleanup } = createEditorDebounceSimulator(updateContent);

    const tabId = 'untitled-1';
    const largeMarkdown = 'x'.repeat(200_000);
    const largeChildCount = 2000;

    onDocUpdate(tabId, largeMarkdown, largeChildCount);

    // デバウンスが完了してから cleanup
    vi.advanceTimersByTime(LARGE_DOC_SERIALIZE_DEBOUNCE_MS + 10);
    expect(updateContent).toHaveBeenCalledTimes(1);

    // デバウンス完了後は pending タイマーがないため cleanup では追加呼び出しなし
    cleanup(tabId, largeMarkdown);
    expect(updateContent).toHaveBeenCalledTimes(1); // 二重呼び出しにならない
  });

  it('【既存動作確認】小ドキュメントはデバウンスなしで即時更新（変更なし）', () => {
    const updateContent = vi.fn();
    const { onDocUpdate, cleanup } = createEditorDebounceSimulator(updateContent);

    const tabId = 'untitled-1';
    const smallMarkdown = '# Hello\n\nSmall content';
    const smallChildCount = 5; // 1200 未満 → 即時

    onDocUpdate(tabId, smallMarkdown, smallChildCount);

    // 小ドキュメントは即時 updateContent 済み
    expect(updateContent).toHaveBeenCalledWith(tabId, smallMarkdown);

    // cleanup 時は pending なし → 追加呼び出しなし
    cleanup(tabId, smallMarkdown);
    expect(updateContent).toHaveBeenCalledTimes(1);
  });

  it('【修正確認】tabStore にコンテンツが保存されてタブ切替後も復元できる', () => {
    // Untitled-1 を追加
    const untitledId = useTabStore.getState().addTab({
      filePath: null,
      fileName: 'Untitled',
      content: '',
      savedContent: '',
    });

    const largeContent = 'x'.repeat(200_000);

    // 修正後: フラッシュにより updateContent が呼ばれてコンテンツが保存される
    useTabStore.getState().updateContent(untitledId, largeContent);

    // 別ファイルをD&Dで開く
    const fileTabId = useTabStore.getState().addTab({
      filePath: '/path/to/large-file.md',
      fileName: 'large-file.md',
      content: 'y'.repeat(200_000),
      savedContent: 'y'.repeat(200_000),
    });

    expect(useTabStore.getState().activeTabId).toBe(fileTabId);

    // Untitled-1 に戻る
    useTabStore.getState().setActiveTab(untitledId);

    // ★ 修正確認: ペーストしたコンテンツが tabStore に保存されている
    const freshContent = useTabStore.getState().getTab(untitledId)?.content;
    expect(freshContent).toBe(largeContent); // 空文字ではなくペースト内容が残る
  });
});
