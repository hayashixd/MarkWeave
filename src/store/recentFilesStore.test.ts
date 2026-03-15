import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRecentFilesStore } from './recentFilesStore';

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
  useRecentFilesStore.setState({ recentFiles: [], loaded: false });
}

describe('recentFilesStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  // -------------------------------------------------------------------------
  // loadRecentFiles
  // -------------------------------------------------------------------------
  describe('loadRecentFiles', () => {
    it('plugin-store から読み込んで recentFiles にセットする', async () => {
      const entries = [
        { path: '/a.md', name: 'a.md', lastOpened: 1000 },
        { path: '/b.md', name: 'b.md', lastOpened: 900 },
      ];
      mockStoreGet.mockResolvedValueOnce(entries);

      await useRecentFilesStore.getState().loadRecentFiles();

      expect(useRecentFilesStore.getState().recentFiles).toEqual(entries);
      expect(useRecentFilesStore.getState().loaded).toBe(true);
    });

    it('store が null を返す場合は空配列にする', async () => {
      mockStoreGet.mockResolvedValueOnce(null);

      await useRecentFilesStore.getState().loadRecentFiles();

      expect(useRecentFilesStore.getState().recentFiles).toHaveLength(0);
      expect(useRecentFilesStore.getState().loaded).toBe(true);
    });

    it('store エラー時は空配列で loaded=true にする', async () => {
      mockStoreGet.mockRejectedValueOnce(new Error('store error'));

      await useRecentFilesStore.getState().loadRecentFiles();

      expect(useRecentFilesStore.getState().recentFiles).toHaveLength(0);
      expect(useRecentFilesStore.getState().loaded).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // addRecentFile
  // -------------------------------------------------------------------------
  describe('addRecentFile', () => {
    it('先頭にエントリを追加する', async () => {
      mockStoreSet.mockResolvedValue(undefined);
      mockStoreSave.mockResolvedValue(undefined);

      await useRecentFilesStore.getState().addRecentFile('/a.md', 'a.md');

      const files = useRecentFilesStore.getState().recentFiles;
      expect(files[0]!.path).toBe('/a.md');
      expect(files[0]!.name).toBe('a.md');
    });

    it('同じパスのエントリは重複しない（先頭に移動）', async () => {
      mockStoreSet.mockResolvedValue(undefined);
      mockStoreSave.mockResolvedValue(undefined);

      useRecentFilesStore.setState({
        recentFiles: [
          { path: '/b.md', name: 'b.md', lastOpened: 900 },
          { path: '/a.md', name: 'a.md', lastOpened: 800 },
        ],
      });

      await useRecentFilesStore.getState().addRecentFile('/a.md', 'a.md');

      const files = useRecentFilesStore.getState().recentFiles;
      expect(files).toHaveLength(2);
      expect(files[0]!.path).toBe('/a.md');
      expect(files[1]!.path).toBe('/b.md');
    });

    it('最大 10 件を超えたら古いものを切り捨てる', async () => {
      mockStoreSet.mockResolvedValue(undefined);
      mockStoreSave.mockResolvedValue(undefined);

      const existing = Array.from({ length: 10 }, (_, i) => ({
        path: `/file${i}.md`,
        name: `file${i}.md`,
        lastOpened: i * 100,
      }));
      useRecentFilesStore.setState({ recentFiles: existing });

      await useRecentFilesStore.getState().addRecentFile('/new.md', 'new.md');

      expect(useRecentFilesStore.getState().recentFiles).toHaveLength(10);
      expect(useRecentFilesStore.getState().recentFiles[0]!.path).toBe('/new.md');
    });
  });

  // -------------------------------------------------------------------------
  // removeRecentFile
  // -------------------------------------------------------------------------
  describe('removeRecentFile', () => {
    it('指定パスのエントリを削除する', async () => {
      mockStoreSet.mockResolvedValue(undefined);
      mockStoreSave.mockResolvedValue(undefined);

      useRecentFilesStore.setState({
        recentFiles: [
          { path: '/a.md', name: 'a.md', lastOpened: 1000 },
          { path: '/b.md', name: 'b.md', lastOpened: 900 },
        ],
      });

      await useRecentFilesStore.getState().removeRecentFile('/a.md');

      const files = useRecentFilesStore.getState().recentFiles;
      expect(files).toHaveLength(1);
      expect(files[0]!.path).toBe('/b.md');
    });

    it('存在しないパスを削除しても何も変わらない', async () => {
      mockStoreSet.mockResolvedValue(undefined);
      mockStoreSave.mockResolvedValue(undefined);

      useRecentFilesStore.setState({
        recentFiles: [{ path: '/a.md', name: 'a.md', lastOpened: 1000 }],
      });

      await useRecentFilesStore.getState().removeRecentFile('/nonexistent.md');

      expect(useRecentFilesStore.getState().recentFiles).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // clearRecentFiles
  // -------------------------------------------------------------------------
  describe('clearRecentFiles', () => {
    it('全エントリを削除する', async () => {
      mockStoreSet.mockResolvedValue(undefined);
      mockStoreSave.mockResolvedValue(undefined);

      useRecentFilesStore.setState({
        recentFiles: [
          { path: '/a.md', name: 'a.md', lastOpened: 1000 },
          { path: '/b.md', name: 'b.md', lastOpened: 900 },
        ],
      });

      await useRecentFilesStore.getState().clearRecentFiles();

      expect(useRecentFilesStore.getState().recentFiles).toHaveLength(0);
    });
  });
});
