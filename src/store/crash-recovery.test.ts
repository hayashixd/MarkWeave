import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadRecoveryData,
  saveCheckpoint,
  clearRecoveryData,
  startCheckpointScheduler,
  isLargeFile,
  type RecoveryEntry,
} from './crash-recovery';

const mockStoreGet = vi.fn();
const mockStoreSet = vi.fn();
const mockStoreSave = vi.fn();
const mockStoreClear = vi.fn();

vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn().mockResolvedValue({
    get: (...args: unknown[]) => mockStoreGet(...args),
    set: (...args: unknown[]) => mockStoreSet(...args),
    save: (...args: unknown[]) => mockStoreSave(...args),
    clear: (...args: unknown[]) => mockStoreClear(...args),
  }),
}));

const now = new Date('2025-01-15T12:00:00Z');

function makeEntry(overrides: Partial<RecoveryEntry> = {}): RecoveryEntry {
  return {
    filePath: '/ws/note.md',
    content: '# modified',
    savedContent: '# original',
    checkpointAt: now.toISOString(),
    ...overrides,
  };
}

describe('crash-recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // fake timers + system time を同時に設定（衝突防止）
    vi.useFakeTimers({ now });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // isLargeFile
  // -------------------------------------------------------------------------
  describe('isLargeFile', () => {
    it('3MB 未満は false', () => {
      expect(isLargeFile('hello')).toBe(false);
    });

    it('3MB 以上は true', () => {
      const large = 'a'.repeat(3 * 1024 * 1024);
      expect(isLargeFile(large)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // saveCheckpoint
  // -------------------------------------------------------------------------
  describe('saveCheckpoint', () => {
    it('entries を store.set して store.save を呼ぶ', async () => {
      mockStoreSet.mockResolvedValue(undefined);
      mockStoreSave.mockResolvedValue(undefined);

      const entries = [makeEntry()];
      await saveCheckpoint(entries);

      expect(mockStoreSet).toHaveBeenCalledWith('entries', entries);
      expect(mockStoreSave).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // clearRecoveryData
  // -------------------------------------------------------------------------
  describe('clearRecoveryData', () => {
    it('store.clear と store.save を呼ぶ', async () => {
      mockStoreClear.mockResolvedValue(undefined);
      mockStoreSave.mockResolvedValue(undefined);

      await clearRecoveryData();

      expect(mockStoreClear).toHaveBeenCalledTimes(1);
      expect(mockStoreSave).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // loadRecoveryData
  // -------------------------------------------------------------------------
  describe('loadRecoveryData', () => {
    it('entries が null のとき null を返す', async () => {
      mockStoreGet.mockResolvedValueOnce(null);

      const result = await loadRecoveryData();
      expect(result).toBeNull();
    });

    it('entries が空配列のとき null を返す', async () => {
      mockStoreGet.mockResolvedValueOnce([]);

      const result = await loadRecoveryData();
      expect(result).toBeNull();
    });

    it('content === savedContent のエントリは除外する', async () => {
      const saved = makeEntry({ content: 'same', savedContent: 'same' });
      mockStoreGet.mockResolvedValueOnce([saved]);

      const result = await loadRecoveryData();
      expect(result).toBeNull();
    });

    it('未保存のエントリを返す', async () => {
      const dirty = makeEntry();
      mockStoreGet.mockResolvedValueOnce([dirty]);

      const result = await loadRecoveryData();
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0]!.filePath).toBe('/ws/note.md');
    });

    it('7 日以上古いエントリは除外する', async () => {
      const oldDate = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      const old = makeEntry({ checkpointAt: oldDate.toISOString() });
      mockStoreGet.mockResolvedValueOnce([old]);

      const result = await loadRecoveryData();
      expect(result).toBeNull();
    });

    it('新しい未保存エントリと古いエントリが混在する場合、新しいもののみ返す', async () => {
      const oldDate = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      const old = makeEntry({ filePath: '/old.md', checkpointAt: oldDate.toISOString() });
      const fresh = makeEntry({ filePath: '/fresh.md' });
      mockStoreGet.mockResolvedValueOnce([old, fresh]);

      const result = await loadRecoveryData();
      expect(result).toHaveLength(1);
      expect(result![0]!.filePath).toBe('/fresh.md');
    });

    it('全エントリが除外されたら null を返す', async () => {
      const saved = makeEntry({ content: 'x', savedContent: 'x' });
      mockStoreGet.mockResolvedValueOnce([saved]);

      const result = await loadRecoveryData();
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // startCheckpointScheduler
  // -------------------------------------------------------------------------
  describe('startCheckpointScheduler', () => {
    it('クリーンアップ関数を返す（interval を停止する）', () => {
      mockStoreSet.mockResolvedValue(undefined);
      mockStoreSave.mockResolvedValue(undefined);

      const cleanup = startCheckpointScheduler(() => []);
      expect(typeof cleanup).toBe('function');
      cleanup(); // 停止してもクラッシュしない
    });

    it('未保存エントリがない場合 saveCheckpoint を呼ばない', async () => {
      mockStoreSet.mockResolvedValue(undefined);
      mockStoreSave.mockResolvedValue(undefined);

      const cleanup = startCheckpointScheduler(() => [
        makeEntry({ content: 'same', savedContent: 'same' }),
      ]);

      // 1 インターバル分だけ進める（無限ループ回避）
      await vi.advanceTimersByTimeAsync(30_001);

      expect(mockStoreSet).not.toHaveBeenCalled();
      cleanup();
    });

    it('3MB 超のファイルはチェックポイント対象外', async () => {
      mockStoreSet.mockResolvedValue(undefined);
      mockStoreSave.mockResolvedValue(undefined);

      const largeContent = 'a'.repeat(3 * 1024 * 1024);
      const cleanup = startCheckpointScheduler(() => [
        makeEntry({ content: largeContent, savedContent: 'small' }),
      ]);

      await vi.advanceTimersByTimeAsync(30_001);

      expect(mockStoreSet).not.toHaveBeenCalled();
      cleanup();
    });
  });
});
