import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkspaceStore, type FileNode } from './workspaceStore';

// Tauri invoke のモック
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// tauri-apps/plugin-store のモック
const mockStoreGet = vi.fn();
const mockStoreSet = vi.fn();
const mockStoreSave = vi.fn();
vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn().mockResolvedValue({
    get: (...args: unknown[]) => mockStoreGet(...args),
    set: (...args: unknown[]) => mockStoreSet(...args),
    save: (...args: unknown[]) => mockStoreSave(...args),
  }),
}));

const sampleTree: FileNode[] = [
  {
    name: 'docs',
    path: '/ws/docs',
    type: 'directory',
    children: [
      { name: 'readme.md', path: '/ws/docs/readme.md', type: 'file' },
    ],
  },
  { name: 'note.md', path: '/ws/note.md', type: 'file' },
];

function resetStore() {
  useWorkspaceStore.setState({
    root: null,
    tree: [],
    isLoading: false,
    recentWorkspaces: [],
  });
}

describe('workspaceStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  // -------------------------------------------------------------------------
  // closeWorkspace
  // -------------------------------------------------------------------------
  describe('closeWorkspace', () => {
    it('root と tree をリセットする', () => {
      useWorkspaceStore.setState({ root: '/ws', tree: sampleTree });
      useWorkspaceStore.getState().closeWorkspace();
      const s = useWorkspaceStore.getState();
      expect(s.root).toBeNull();
      expect(s.tree).toHaveLength(0);
      expect(s.isLoading).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // toggleNode
  // -------------------------------------------------------------------------
  describe('toggleNode', () => {
    it('ディレクトリの isExpanded を反転する', () => {
      useWorkspaceStore.setState({ tree: sampleTree });
      useWorkspaceStore.getState().toggleNode('/ws/docs');
      const node = useWorkspaceStore.getState().tree[0]!;
      expect(node.isExpanded).toBe(true);
    });

    it('2 回トグルすると元に戻る', () => {
      useWorkspaceStore.setState({ tree: sampleTree });
      useWorkspaceStore.getState().toggleNode('/ws/docs');
      useWorkspaceStore.getState().toggleNode('/ws/docs');
      const node = useWorkspaceStore.getState().tree[0]!;
      expect(node.isExpanded).toBe(false);
    });

    it('存在しないパスをトグルしても他ノードに影響しない', () => {
      useWorkspaceStore.setState({ tree: sampleTree });
      useWorkspaceStore.getState().toggleNode('/ws/nonexistent');
      expect(useWorkspaceStore.getState().tree).toHaveLength(sampleTree.length);
    });
  });

  // -------------------------------------------------------------------------
  // openWorkspace
  // -------------------------------------------------------------------------
  describe('openWorkspace', () => {
    it('ワークスペースを開くと root がセットされ tree が構築される', async () => {
      mockInvoke.mockResolvedValueOnce(sampleTree);
      mockStoreGet.mockResolvedValueOnce([]);
      mockStoreSet.mockResolvedValueOnce(undefined);
      mockStoreSave.mockResolvedValueOnce(undefined);

      await useWorkspaceStore.getState().openWorkspace('/ws');

      const s = useWorkspaceStore.getState();
      expect(s.root).toBe('/ws');
      expect(s.isLoading).toBe(false);
      expect(s.tree.length).toBeGreaterThan(0);
    });

    it('list_workspace_files 失敗時は tree が空になる', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('not available'));
      mockStoreGet.mockRejectedValueOnce(new Error('store error'));

      await useWorkspaceStore.getState().openWorkspace('/ws');

      const s = useWorkspaceStore.getState();
      expect(s.root).toBe('/ws');
      expect(s.tree).toHaveLength(0);
      expect(s.isLoading).toBe(false);
    });

    it('最近使ったワークスペースに追加される', async () => {
      mockInvoke.mockResolvedValueOnce([]);
      mockStoreGet.mockResolvedValueOnce([]);
      mockStoreSet.mockResolvedValueOnce(undefined);
      mockStoreSave.mockResolvedValueOnce(undefined);

      await useWorkspaceStore.getState().openWorkspace('/workspace/myproject');

      const s = useWorkspaceStore.getState();
      expect(s.recentWorkspaces).toHaveLength(1);
      expect(s.recentWorkspaces[0]!.path).toBe('/workspace/myproject');
      expect(s.recentWorkspaces[0]!.name).toBe('myproject');
    });

    it('同じワークスペースを再度開くと重複しない', async () => {
      const existing = [{ path: '/ws', name: 'ws', lastOpened: 1000 }];
      mockInvoke.mockResolvedValue([]);
      mockStoreGet.mockResolvedValue(existing);
      mockStoreSet.mockResolvedValue(undefined);
      mockStoreSave.mockResolvedValue(undefined);

      await useWorkspaceStore.getState().openWorkspace('/ws');
      await useWorkspaceStore.getState().openWorkspace('/ws');

      const s = useWorkspaceStore.getState();
      expect(s.recentWorkspaces.filter((e) => e.path === '/ws')).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // sortTree（ソート順の確認）
  // -------------------------------------------------------------------------
  describe('ツリーのソート順', () => {
    it('ディレクトリがファイルより先にくる', async () => {
      const unsorted: FileNode[] = [
        { name: 'note.md', path: '/ws/note.md', type: 'file' },
        { name: 'docs', path: '/ws/docs', type: 'directory', children: [] },
      ];
      mockInvoke.mockResolvedValueOnce(unsorted);
      mockStoreGet.mockRejectedValueOnce(new Error('skip store'));

      await useWorkspaceStore.getState().openWorkspace('/ws');

      const tree = useWorkspaceStore.getState().tree;
      expect(tree[0]!.type).toBe('directory');
      expect(tree[1]!.type).toBe('file');
    });

    it('同じ種別内では名前順にソートされる', async () => {
      const unsorted: FileNode[] = [
        { name: 'z.md', path: '/ws/z.md', type: 'file' },
        { name: 'a.md', path: '/ws/a.md', type: 'file' },
        { name: 'm.md', path: '/ws/m.md', type: 'file' },
      ];
      mockInvoke.mockResolvedValueOnce(unsorted);
      mockStoreGet.mockRejectedValueOnce(new Error('skip store'));

      await useWorkspaceStore.getState().openWorkspace('/ws');

      const names = useWorkspaceStore.getState().tree.map((n) => n.name);
      expect(names).toEqual(['a.md', 'm.md', 'z.md']);
    });
  });

  // -------------------------------------------------------------------------
  // refreshTree（展開状態の復元）
  // -------------------------------------------------------------------------
  describe('refreshTree', () => {
    it('root が null のとき何もしない', async () => {
      await useWorkspaceStore.getState().refreshTree();
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('展開状態を維持してリフレッシュする', async () => {
      // 展開済みツリーを設定
      const expandedTree: FileNode[] = [
        { name: 'docs', path: '/ws/docs', type: 'directory', children: [], isExpanded: true },
      ];
      useWorkspaceStore.setState({ root: '/ws', tree: expandedTree });

      // リフレッシュ後も同じノードが存在する
      mockInvoke.mockResolvedValueOnce([
        { name: 'docs', path: '/ws/docs', type: 'directory', children: [] },
      ]);

      await useWorkspaceStore.getState().refreshTree();

      const tree = useWorkspaceStore.getState().tree;
      const docsNode = tree.find((n) => n.path === '/ws/docs');
      expect(docsNode?.isExpanded).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // createFile
  // -------------------------------------------------------------------------
  describe('createFile', () => {
    it('指定ディレクトリにファイルパスを生成して write_file を呼ぶ', async () => {
      useWorkspaceStore.setState({ root: '/ws', tree: [] });
      mockInvoke
        .mockResolvedValueOnce(undefined) // write_file
        .mockResolvedValueOnce([]); // list_workspace_files (refreshTree)

      await useWorkspaceStore.getState().createFile('/ws/docs', 'new-note.md');

      const writeCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'write_file');
      expect(writeCalls).toHaveLength(1);
      expect(writeCalls[0]![1]).toMatchObject({ path: '/ws/docs/new-note.md', content: '' });
    });
  });

  // -------------------------------------------------------------------------
  // renameFile
  // -------------------------------------------------------------------------
  describe('renameFile', () => {
    it('rename_file invoke を正しいパスで呼ぶ', async () => {
      useWorkspaceStore.setState({ root: '/ws', tree: [] });
      mockInvoke
        .mockResolvedValueOnce(undefined) // rename_file
        .mockResolvedValueOnce([]); // refreshTree

      await useWorkspaceStore.getState().renameFile('/ws/docs/old.md', 'new.md');

      const renameCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'rename_file');
      expect(renameCalls).toHaveLength(1);
      expect(renameCalls[0]![1]).toMatchObject({
        oldPath: '/ws/docs/old.md',
        newPath: '/ws/docs/new.md',
      });
    });
  });

  // -------------------------------------------------------------------------
  // moveFile
  // -------------------------------------------------------------------------
  describe('moveFile', () => {
    it('移動先パスを返す', async () => {
      useWorkspaceStore.setState({ root: '/ws', tree: [] });
      mockInvoke
        .mockResolvedValueOnce(undefined) // rename_file
        .mockResolvedValueOnce([]); // refreshTree

      const newPath = await useWorkspaceStore.getState().moveFile('/ws/a/note.md', '/ws/b');
      expect(newPath).toBe('/ws/b/note.md');
    });
  });

  // -------------------------------------------------------------------------
  // removeRecentWorkspace
  // -------------------------------------------------------------------------
  describe('removeRecentWorkspace', () => {
    it('store 操作成功時にエントリを削除する', async () => {
      useWorkspaceStore.setState({
        recentWorkspaces: [
          { path: '/ws/a', name: 'a', lastOpened: 1 },
          { path: '/ws/b', name: 'b', lastOpened: 2 },
        ],
      });
      mockStoreGet.mockResolvedValueOnce([
        { path: '/ws/a', name: 'a', lastOpened: 1 },
        { path: '/ws/b', name: 'b', lastOpened: 2 },
      ]);
      mockStoreSet.mockResolvedValueOnce(undefined);
      mockStoreSave.mockResolvedValueOnce(undefined);

      await useWorkspaceStore.getState().removeRecentWorkspace('/ws/a');

      const s = useWorkspaceStore.getState();
      expect(s.recentWorkspaces.find((e) => e.path === '/ws/a')).toBeUndefined();
      expect(s.recentWorkspaces.find((e) => e.path === '/ws/b')).toBeDefined();
    });

    it('store 操作失敗時もローカル状態から削除する', async () => {
      useWorkspaceStore.setState({
        recentWorkspaces: [{ path: '/ws/a', name: 'a', lastOpened: 1 }],
      });
      mockStoreGet.mockRejectedValueOnce(new Error('store error'));

      await useWorkspaceStore.getState().removeRecentWorkspace('/ws/a');

      expect(useWorkspaceStore.getState().recentWorkspaces).toHaveLength(0);
    });
  });
});
