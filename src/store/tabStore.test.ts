import { describe, it, expect, beforeEach } from 'vitest';
import { useTabStore } from './tabStore';

describe('tabStore', () => {
  beforeEach(() => {
    // ストアをリセット
    useTabStore.setState({
      tabs: [],
      activeTabId: null,
      _untitledCounter: 0,
    });
  });

  it('adds a tab and sets it as active', () => {
    const id = useTabStore.getState().addTab({
      filePath: '/path/to/file.md',
      fileName: 'file.md',
      content: '# Hello',
      savedContent: '# Hello',
    });

    const state = useTabStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.activeTabId).toBe(id);
    expect(state.tabs[0]!.fileName).toBe('file.md');
    expect(state.tabs[0]!.isDirty).toBe(false);
  });

  it('does not duplicate tabs with same filePath', () => {
    const id1 = useTabStore.getState().addTab({
      filePath: '/path/to/file.md',
      fileName: 'file.md',
      content: '',
      savedContent: '',
    });

    const id2 = useTabStore.getState().addTab({
      filePath: '/path/to/file.md',
      fileName: 'file.md',
      content: '',
      savedContent: '',
    });

    expect(id1).toBe(id2);
    expect(useTabStore.getState().tabs).toHaveLength(1);
  });

  it('assigns incremental Untitled names', () => {
    useTabStore.getState().addTab({
      filePath: null,
      fileName: 'Untitled',
      content: '',
      savedContent: '',
    });

    useTabStore.getState().addTab({
      filePath: null,
      fileName: 'Untitled',
      content: '',
      savedContent: '',
    });

    const state = useTabStore.getState();
    expect(state.tabs[0]!.fileName).toBe('Untitled-1');
    expect(state.tabs[1]!.fileName).toBe('Untitled-2');
  });

  it('marks tab as dirty when content changes', () => {
    const id = useTabStore.getState().addTab({
      filePath: '/path/to/file.md',
      fileName: 'file.md',
      content: 'original',
      savedContent: 'original',
    });

    useTabStore.getState().updateContent(id, 'modified');
    expect(useTabStore.getState().tabs[0]!.isDirty).toBe(true);
  });

  it('marks tab as clean when content matches saved', () => {
    const id = useTabStore.getState().addTab({
      filePath: '/path/to/file.md',
      fileName: 'file.md',
      content: 'original',
      savedContent: 'original',
    });

    useTabStore.getState().updateContent(id, 'modified');
    expect(useTabStore.getState().tabs[0]!.isDirty).toBe(true);

    useTabStore.getState().updateContent(id, 'original');
    expect(useTabStore.getState().tabs[0]!.isDirty).toBe(false);
  });

  it('does not recreate tab when content is unchanged', () => {
    const id = useTabStore.getState().addTab({
      filePath: '/path/to/file.md',
      fileName: 'file.md',
      content: 'same',
      savedContent: 'same',
    });

    const beforeTab = useTabStore.getState().tabs[0];
    useTabStore.getState().updateContent(id, 'same');
    const afterTab = useTabStore.getState().tabs[0];

    expect(afterTab).toBe(beforeTab);
    expect(afterTab?.isDirty).toBe(false);
  });

  it('markSaved clears isDirty and updates savedContent', () => {
    const id = useTabStore.getState().addTab({
      filePath: '/path/to/file.md',
      fileName: 'file.md',
      content: 'original',
      savedContent: 'original',
    });

    useTabStore.getState().updateContent(id, 'modified');
    useTabStore.getState().markSaved(id);

    const tab = useTabStore.getState().tabs[0]!;
    expect(tab.isDirty).toBe(false);
    expect(tab.savedContent).toBe('modified');
  });

  it('markSaved with filePath updates fileName', () => {
    const id = useTabStore.getState().addTab({
      filePath: null,
      fileName: 'Untitled',
      content: '# Test',
      savedContent: '',
    });

    useTabStore.getState().markSaved(id, '/new/path/document.md');
    const tab = useTabStore.getState().tabs[0]!;
    expect(tab.filePath).toBe('/new/path/document.md');
    expect(tab.fileName).toBe('document.md');
  });

  it('removes tab and activates neighbor', () => {
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

    // id2 がアクティブ
    expect(useTabStore.getState().activeTabId).toBe(id2);

    // id2 を閉じると id1 がアクティブになる
    useTabStore.getState().removeTab(id2);
    expect(useTabStore.getState().activeTabId).toBe(id1);
  });

  it('removes last tab and sets activeTabId to null', () => {
    const id = useTabStore.getState().addTab({
      filePath: null,
      fileName: 'only',
      content: '',
      savedContent: '',
    });

    useTabStore.getState().removeTab(id);
    expect(useTabStore.getState().tabs).toHaveLength(0);
    expect(useTabStore.getState().activeTabId).toBeNull();
  });

  it('updateFilePath updates matching tab', () => {
    useTabStore.getState().addTab({
      filePath: '/old/path.md',
      fileName: 'path.md',
      content: '',
      savedContent: '',
    });

    useTabStore.getState().updateFilePath('/old/path.md', '/new/renamed.md');
    const tab = useTabStore.getState().tabs[0]!;
    expect(tab.filePath).toBe('/new/renamed.md');
    expect(tab.fileName).toBe('renamed.md');
  });
});
