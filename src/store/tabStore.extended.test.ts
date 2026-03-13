/**
 * tabStore 追加エッジケーステスト
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useTabStore } from './tabStore';

describe('tabStore – edge cases', () => {
  beforeEach(() => {
    useTabStore.setState({
      tabs: [],
      activeTabId: null,
      _untitledCounter: 0,
    });
  });

  it('handles rapid sequential tab additions', () => {
    for (let i = 0; i < 20; i++) {
      useTabStore.getState().addTab({
        filePath: null,
        fileName: 'Untitled',
        content: '',
        savedContent: '',
      });
    }
    expect(useTabStore.getState().tabs).toHaveLength(20);
  });

  it('setActiveTab to existing tab', () => {
    const id1 = useTabStore.getState().addTab({
      filePath: null,
      fileName: 'tab1',
      content: '',
      savedContent: '',
    });
    const id2 = useTabStore.getState().addTab({
      filePath: null,
      fileName: 'tab2',
      content: '',
      savedContent: '',
    });

    expect(useTabStore.getState().activeTabId).toBe(id2);
    useTabStore.getState().setActiveTab(id1);
    expect(useTabStore.getState().activeTabId).toBe(id1);
  });

  it('removing middle tab activates correct neighbor', () => {
    const id1 = useTabStore.getState().addTab({
      filePath: null,
      fileName: 'tab1',
      content: '',
      savedContent: '',
    });
    const id2 = useTabStore.getState().addTab({
      filePath: null,
      fileName: 'tab2',
      content: '',
      savedContent: '',
    });
    const id3 = useTabStore.getState().addTab({
      filePath: null,
      fileName: 'tab3',
      content: '',
      savedContent: '',
    });

    useTabStore.getState().setActiveTab(id2);
    useTabStore.getState().removeTab(id2);

    // Should activate a neighbor (id1 or id3)
    const activeId = useTabStore.getState().activeTabId;
    expect([id1, id3]).toContain(activeId);
  });

  it('updateContent with very large content', () => {
    const id = useTabStore.getState().addTab({
      filePath: '/test.md',
      fileName: 'test.md',
      content: 'a',
      savedContent: 'a',
    });

    const largeContent = 'x'.repeat(500000); // 500KB
    useTabStore.getState().updateContent(id, largeContent);
    expect(useTabStore.getState().tabs[0]!.content).toBe(largeContent);
    expect(useTabStore.getState().tabs[0]!.isDirty).toBe(true);
  });

  it('updateFilePath does nothing for non-matching path', () => {
    useTabStore.getState().addTab({
      filePath: '/old.md',
      fileName: 'old.md',
      content: '',
      savedContent: '',
    });

    useTabStore.getState().updateFilePath('/other.md', '/new.md');
    expect(useTabStore.getState().tabs[0]!.filePath).toBe('/old.md');
  });

  it('markSaved on non-existent id does not affect other tabs', () => {
    const id = useTabStore.getState().addTab({
      filePath: '/test.md',
      fileName: 'test.md',
      content: 'original',
      savedContent: 'original',
    });

    useTabStore.getState().updateContent(id, 'modified');
    expect(useTabStore.getState().tabs[0]!.isDirty).toBe(true);

    // Should not throw and should not affect existing tab
    useTabStore.getState().markSaved('nonexistent-id');
    expect(useTabStore.getState().tabs[0]!.isDirty).toBe(true);
  });

  it('addTab with same filePath switches to existing tab', () => {
    const id = useTabStore.getState().addTab({
      filePath: '/test.md',
      fileName: 'test.md',
      content: 'original',
      savedContent: 'original',
    });

    // Add another tab to make it active
    useTabStore.getState().addTab({
      filePath: null,
      fileName: 'other',
      content: '',
      savedContent: '',
    });

    // Re-adding same file should switch back
    const returnedId = useTabStore.getState().addTab({
      filePath: '/test.md',
      fileName: 'test.md',
      content: 'new',
      savedContent: 'new',
    });

    expect(returnedId).toBe(id);
    expect(useTabStore.getState().activeTabId).toBe(id);
  });

  it('multiple untitled tabs get sequential names', () => {
    for (let i = 0; i < 5; i++) {
      useTabStore.getState().addTab({
        filePath: null,
        fileName: 'Untitled',
        content: '',
        savedContent: '',
      });
    }
    const names = useTabStore.getState().tabs.map((t) => t.fileName);
    const unique = new Set(names);
    expect(unique.size).toBe(5);
  });
});
