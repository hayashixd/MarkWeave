import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveSession,
  loadSession,
  saveWindowState,
  loadWindowState,
  checkNeedsRecovery,
  type SessionState,
  type WindowState,
} from './session';

const mockStoreGet = vi.fn();
const mockStoreSet = vi.fn();
const mockStoreSave = vi.fn();
const mockStoreDelete = vi.fn();

vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn().mockResolvedValue({
    get: (...args: unknown[]) => mockStoreGet(...args),
    set: (...args: unknown[]) => mockStoreSet(...args),
    save: (...args: unknown[]) => mockStoreSave(...args),
    delete: (...args: unknown[]) => mockStoreDelete(...args),
  }),
}));

const mockExists = vi.fn();
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: (...args: unknown[]) => mockExists(...args),
}));

vi.mock('./crash-recovery', () => ({
  loadRecoveryData: vi.fn(),
}));

describe('session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreSet.mockResolvedValue(undefined);
    mockStoreSave.mockResolvedValue(undefined);
    mockStoreDelete.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // saveSession
  // -------------------------------------------------------------------------
  describe('saveSession', () => {
    it('openFiles / activeFilePath / sidebarVisible を store にセットする', async () => {
      const state: SessionState = {
        openFiles: [{ path: '/ws/note.md' }],
        activeFilePath: '/ws/note.md',
        sidebarVisible: true,
      };

      await saveSession(state);

      expect(mockStoreSet).toHaveBeenCalledWith('openFiles', state.openFiles);
      expect(mockStoreSet).toHaveBeenCalledWith('activeFilePath', state.activeFilePath);
      expect(mockStoreSet).toHaveBeenCalledWith('sidebarVisible', true);
      expect(mockStoreSave).toHaveBeenCalledTimes(1);
    });

    it('paneLayout がない場合は delete を呼ぶ', async () => {
      const state: SessionState = {
        openFiles: [],
        activeFilePath: null,
        sidebarVisible: false,
      };

      await saveSession(state);

      expect(mockStoreDelete).toHaveBeenCalledWith('paneLayout');
    });

    it('paneLayout がある場合は set を呼ぶ', async () => {
      const paneLayout = {
        layoutType: 'horizontal' as const,
        splitRatio: 0.5,
        panes: [{ filePaths: ['/ws/a.md'], activeFilePath: '/ws/a.md' }],
        activePaneIndex: 0,
      };
      const state: SessionState = {
        openFiles: [{ path: '/ws/a.md' }],
        activeFilePath: '/ws/a.md',
        sidebarVisible: true,
        paneLayout,
      };

      await saveSession(state);

      expect(mockStoreSet).toHaveBeenCalledWith('paneLayout', paneLayout);
    });

    it('lastCleanExit が未指定なら false をセットする', async () => {
      const state: SessionState = {
        openFiles: [],
        activeFilePath: null,
        sidebarVisible: true,
      };

      await saveSession(state);

      expect(mockStoreSet).toHaveBeenCalledWith('lastCleanExit', false);
    });

    it('lastCleanExit=true を明示的に保存できる', async () => {
      const state: SessionState = {
        openFiles: [],
        activeFilePath: null,
        sidebarVisible: true,
        lastCleanExit: true,
      };

      await saveSession(state);

      expect(mockStoreSet).toHaveBeenCalledWith('lastCleanExit', true);
    });
  });

  // -------------------------------------------------------------------------
  // loadSession
  // -------------------------------------------------------------------------
  describe('loadSession', () => {
    it('openFiles が null なら null を返す', async () => {
      mockStoreGet.mockResolvedValueOnce(null); // openFiles

      const result = await loadSession();
      expect(result).toBeNull();
    });

    it('openFiles が空配列なら null を返す', async () => {
      mockStoreGet.mockResolvedValueOnce([]); // openFiles

      const result = await loadSession();
      expect(result).toBeNull();
    });

    it('存在するファイルのみ復元する', async () => {
      mockStoreGet.mockResolvedValueOnce([
        { path: '/ws/exists.md' },
        { path: '/ws/deleted.md' },
      ]); // openFiles
      mockExists.mockImplementation((p: string) => p === '/ws/exists.md');
      mockStoreGet
        .mockResolvedValueOnce('/ws/exists.md') // activeFilePath
        .mockResolvedValueOnce(true) // sidebarVisible
        .mockResolvedValueOnce(undefined) // paneLayout
        .mockResolvedValueOnce(true); // lastCleanExit

      const result = await loadSession();
      expect(result).not.toBeNull();
      expect(result!.openFiles).toHaveLength(1);
      expect(result!.openFiles[0]!.path).toBe('/ws/exists.md');
    });

    it('有効なファイルが 1 件もない場合 null を返す', async () => {
      mockStoreGet.mockResolvedValueOnce([{ path: '/ws/gone.md' }]);
      mockExists.mockResolvedValue(false);

      const result = await loadSession();
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // saveWindowState / loadWindowState
  // -------------------------------------------------------------------------
  describe('saveWindowState', () => {
    it('windowState を store にセットして保存する', async () => {
      const state: WindowState = { x: 100, y: 200, width: 1280, height: 800, isMaximized: false };

      await saveWindowState(state);

      expect(mockStoreSet).toHaveBeenCalledWith('windowState', state);
      expect(mockStoreSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadWindowState', () => {
    it('windowState を返す', async () => {
      const state: WindowState = { x: 0, y: 0, width: 1920, height: 1080, isMaximized: true };
      mockStoreGet.mockResolvedValueOnce(state);

      const result = await loadWindowState();
      expect(result).toEqual(state);
    });

    it('保存されていない場合 null を返す', async () => {
      mockStoreGet.mockResolvedValueOnce(null);

      const result = await loadWindowState();
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // checkNeedsRecovery
  // -------------------------------------------------------------------------
  describe('checkNeedsRecovery', () => {
    it('lastCleanExit=true の場合 null を返す（リカバリ不要）', async () => {
      // loadSession が lastCleanExit=true のセッションを返す
      mockStoreGet.mockResolvedValueOnce([{ path: '/ws/note.md' }]);
      mockExists.mockResolvedValue(true);
      mockStoreGet
        .mockResolvedValueOnce(null)   // activeFilePath
        .mockResolvedValueOnce(true)   // sidebarVisible
        .mockResolvedValueOnce(undefined) // paneLayout
        .mockResolvedValueOnce(true);  // lastCleanExit

      const result = await checkNeedsRecovery();
      expect(result).toBeNull();
    });

    it('lastCleanExit=false の場合 loadRecoveryData を呼ぶ', async () => {
      const { loadRecoveryData } = await import('./crash-recovery');
      vi.mocked(loadRecoveryData).mockResolvedValueOnce(null);

      // loadSession が null を返す（openFiles なし → lastCleanExit 確認不可）
      mockStoreGet.mockResolvedValueOnce(null); // openFiles

      await checkNeedsRecovery();
      expect(loadRecoveryData).toHaveBeenCalledTimes(1);
    });
  });
});
