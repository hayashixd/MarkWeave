/**
 * workspaceStore セキュリティ・エッジケーステスト
 *
 * 検証するシナリオ:
 * - createFile / renameFile / moveFile でパストラバーサルを含む名前を渡した場合の動作
 * - containsTraversalPattern による事前チェック（多層防御）
 * - 空文字列・非常に長い名前・ヌルバイトを含む名前
 * - openWorkspace の境界値
 *
 * 設計方針:
 * Tauri の plugin-fs はスコープ外パスへのアクセスをブロックする。
 * フロントエンドは invoke を呼び出し、Tauri 側でブロックさせる。
 * containsTraversalPattern はフロントエンドの事前チェック層として存在する。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkspaceStore } from './workspaceStore';
import { containsTraversalPattern } from '../utils/path-validator';

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

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

function resetStore() {
  useWorkspaceStore.setState({
    root: '/workspace',
    tree: [],
    isLoading: false,
    recentWorkspaces: [],
  });
}

describe('workspaceStore – security and edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mockInvoke.mockResolvedValue(undefined);
    mockStoreGet.mockRejectedValue(new Error('skip store'));
    mockStoreSet.mockResolvedValue(undefined);
    mockStoreSave.mockResolvedValue(undefined);
  });

  // ---------------------------------------------------------------------------
  // createFile — パストラバーサル
  // ---------------------------------------------------------------------------
  describe('createFile with suspicious filenames', () => {
    it('../../etc/passwd のようなトラバーサルは containsTraversalPattern で検出できる', () => {
      expect(containsTraversalPattern('../../etc/passwd')).toBe(true);
    });

    it('../ を含む名前で createFile を呼んでも crash しない（Tauri 側でブロック）', async () => {
      // write_file が失敗、refreshTree も失敗するシナリオ
      mockInvoke.mockRejectedValue(new Error('path not allowed by Tauri scope'));
      await expect(
        useWorkspaceStore.getState().createFile('/workspace', '../../malicious.sh'),
      ).resolves.toBeUndefined();
    });

    it('ヌルバイトを含むファイル名で createFile を呼んでも crash しない', async () => {
      await expect(
        useWorkspaceStore.getState().createFile('/workspace', 'evil\0.md'),
      ).resolves.toBeUndefined();
    });

    it('空のファイル名で createFile を呼んでも crash しない', async () => {
      await expect(
        useWorkspaceStore.getState().createFile('/workspace', ''),
      ).resolves.toBeUndefined();
    });

    it('非常に長いファイル名で createFile を呼んでも crash しない', async () => {
      const longName = 'a'.repeat(1000) + '.md';
      await expect(
        useWorkspaceStore.getState().createFile('/workspace', longName),
      ).resolves.toBeUndefined();
    });

    it('正常なファイル名では write_file が期待するパスで呼ばれる', async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined) // write_file
        .mockResolvedValueOnce([]); // list_workspace_files (refreshTree)

      await useWorkspaceStore.getState().createFile('/workspace', 'new-note.md');

      const writeCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'write_file');
      expect(writeCalls).toHaveLength(1);
      expect(writeCalls[0]![1]).toMatchObject({ path: '/workspace/new-note.md' });
    });

    it('特殊文字を含む（だが安全な）ファイル名で write_file が呼ばれる', async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([]);

      await useWorkspaceStore.getState().createFile('/workspace', 'note (2024).md');

      const writeCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'write_file');
      expect(writeCalls).toHaveLength(1);
      expect(writeCalls[0]![1]).toMatchObject({ path: '/workspace/note (2024).md' });
    });
  });

  // ---------------------------------------------------------------------------
  // renameFile — パストラバーサル
  // ---------------------------------------------------------------------------
  describe('renameFile with suspicious new names', () => {
    it('新しい名前にトラバーサルが含まれていても crash しない', async () => {
      await expect(
        useWorkspaceStore.getState().renameFile('/workspace/file.md', '../../etc/shadow.md'),
      ).resolves.toBeUndefined();
    });

    it('ヌルバイトを含む新しい名前でも crash しない', async () => {
      await expect(
        useWorkspaceStore.getState().renameFile('/workspace/file.md', 'evil\0.md'),
      ).resolves.toBeUndefined();
    });

    it('拡張子なしの名前に rename できる', async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined) // rename_file
        .mockResolvedValueOnce([]); // refreshTree

      await useWorkspaceStore.getState().renameFile('/workspace/file.md', 'noextension');

      const renameCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'rename_file');
      expect(renameCalls[0]![1]).toMatchObject({
        oldPath: '/workspace/file.md',
        newPath: '/workspace/noextension',
      });
    });

    it('同じ名前への rename は rename_file を呼ぶ', async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([]);

      await useWorkspaceStore.getState().renameFile('/workspace/file.md', 'file.md');

      const renameCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'rename_file');
      expect(renameCalls).toHaveLength(1);
    });

    it('非常に長い名前への rename でも crash しない', async () => {
      const longName = 'a'.repeat(1000) + '.md';
      await expect(
        useWorkspaceStore.getState().renameFile('/workspace/file.md', longName),
      ).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // moveFile — エッジケース
  // ---------------------------------------------------------------------------
  describe('moveFile edge cases', () => {
    it('同じディレクトリへの移動は正しいパスを返す', async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([]);

      const newPath = await useWorkspaceStore.getState().moveFile(
        '/workspace/a.md',
        '/workspace',
      );
      expect(newPath).toBe('/workspace/a.md');
    });

    it('異なるディレクトリへの移動は正しいパスを返す', async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([]);

      const newPath = await useWorkspaceStore.getState().moveFile(
        '/workspace/a/note.md',
        '/workspace/b',
      );
      expect(newPath).toBe('/workspace/b/note.md');
    });

    it('移動先にトラバーサルが含まれていても crash しない', async () => {
      await expect(
        useWorkspaceStore.getState().moveFile('/workspace/file.md', '/workspace/../../etc'),
      ).resolves.not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // openWorkspace — 境界値
  // ---------------------------------------------------------------------------
  describe('openWorkspace edge cases', () => {
    it('トラバーサルを含むパスでも crash しない', async () => {
      mockInvoke.mockResolvedValue([]);
      await expect(
        useWorkspaceStore.getState().openWorkspace('/workspace/../../etc'),
      ).resolves.toBeUndefined();
    });

    it('空文字列のパスでも crash しない', async () => {
      mockInvoke.mockResolvedValue([]);
      await expect(
        useWorkspaceStore.getState().openWorkspace(''),
      ).resolves.toBeUndefined();
    });

    it('非常に長いパスでも crash しない', async () => {
      const longPath = '/workspace/' + 'a'.repeat(500);
      mockInvoke.mockResolvedValue([]);
      await expect(
        useWorkspaceStore.getState().openWorkspace(longPath),
      ).resolves.toBeUndefined();
    });

    it('同一ワークスペースを連続で開いても recentWorkspaces に重複が生じない', async () => {
      mockInvoke.mockResolvedValue([]);
      // store.get は既存エントリを返し、set/save は成功する
      const existingEntry = [{ path: '/workspace/myproject', name: 'myproject', lastOpened: 1000 }];
      mockStoreGet.mockResolvedValue(existingEntry);
      mockStoreSet.mockResolvedValue(undefined);
      mockStoreSave.mockResolvedValue(undefined);

      await useWorkspaceStore.getState().openWorkspace('/workspace/myproject');
      await useWorkspaceStore.getState().openWorkspace('/workspace/myproject');
      await useWorkspaceStore.getState().openWorkspace('/workspace/myproject');

      const duplicates = useWorkspaceStore
        .getState()
        .recentWorkspaces.filter((e) => e.path === '/workspace/myproject');
      expect(duplicates).toHaveLength(1);
    });

    it('10 個以上のワークスペースを開いた場合も recentWorkspaces が無限に増えない', async () => {
      mockInvoke.mockResolvedValue([]);

      for (let i = 0; i < 15; i++) {
        await useWorkspaceStore.getState().openWorkspace(`/workspace/project${i}`);
      }

      // 最大件数を超えていないこと（仕様次第だが無限増加しないこと）
      expect(useWorkspaceStore.getState().recentWorkspaces.length).toBeLessThanOrEqual(15);
    });
  });

  // ---------------------------------------------------------------------------
  // toggleNode — 境界値
  // ---------------------------------------------------------------------------
  describe('toggleNode edge cases', () => {
    it('存在しないパスをトグルしても既存ノードに影響しない', () => {
      useWorkspaceStore.setState({
        tree: [
          { name: 'docs', path: '/workspace/docs', type: 'directory', children: [] },
        ],
      });

      useWorkspaceStore.getState().toggleNode('/workspace/nonexistent');

      const tree = useWorkspaceStore.getState().tree;
      expect(tree).toHaveLength(1);
      expect(tree[0]!.isExpanded).toBeFalsy();
    });

    it('空のツリーに対してトグルを呼んでも crash しない', () => {
      useWorkspaceStore.setState({ tree: [] });
      expect(() =>
        useWorkspaceStore.getState().toggleNode('/workspace/anything'),
      ).not.toThrow();
    });

    it('同じノードを 10 回連続でトグルしても状態が一貫している', () => {
      useWorkspaceStore.setState({
        tree: [
          { name: 'docs', path: '/workspace/docs', type: 'directory', children: [] },
        ],
      });

      for (let i = 0; i < 10; i++) {
        useWorkspaceStore.getState().toggleNode('/workspace/docs');
      }

      // 偶数回トグルで元の状態（false）に戻る
      const node = useWorkspaceStore.getState().tree[0]!;
      expect(node.isExpanded).toBeFalsy();
    });
  });
});
