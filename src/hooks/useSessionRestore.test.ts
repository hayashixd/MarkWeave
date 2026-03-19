/**
 * useSessionRestore のユニットテスト（get_startup_file_paths 対応部分）
 *
 * 検証する動作:
 * 1. セッションなし + CLI 引数なし → 空の Untitled タブを作成する
 * 2. セッションなし + CLI 引数あり → 空タブを作らない、startup file を開く
 * 3. セッション復元失敗 + CLI 引数あり → 空タブを作らない、startup file を開く
 * 4. セッション復元失敗 + CLI 引数なし → 空タブを作成する
 *
 * 設計変更: get_startup_file_paths を useSessionRestore 内で最初に呼ぶことで、
 * useFileOpenListener との競合（race condition）を解消した。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionRestore } from './useSessionRestore';
import { useTabStore } from '../store/tabStore';

// Tauri コア invoke をモック（has_startup_files）
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// セッションストアをモック
vi.mock('../store/session', () => ({
  loadSession: vi.fn(),
  checkNeedsRecovery: vi.fn().mockResolvedValue(null),
}));

// クラッシュリカバリをモック
vi.mock('../store/crash-recovery', () => ({
  clearRecoveryData: vi.fn().mockResolvedValue(undefined),
}));

// useOpenFileAsTab をモック
const mockOpenFileAsTab = vi.fn();
vi.mock('./useOpenFileAsTab', () => ({
  useOpenFileAsTab: () => mockOpenFileAsTab,
}));

// ペインストアをモック
vi.mock('../store/paneStore', () => ({
  usePaneStore: {
    getState: () => ({
      splitPane: vi.fn(),
      moveTabToPane: vi.fn(),
      setSplitRatio: vi.fn(),
      setPaneActiveTab: vi.fn(),
      setActivePaneId: vi.fn(),
    }),
  },
}));

import { loadSession } from '../store/session';

describe('useSessionRestore — get_startup_file_paths 対応', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // tabStore をリセット
    useTabStore.setState({ tabs: [], activeTabId: null, _untitledCounter: 0 });
    // デフォルト: セッションなし
    vi.mocked(loadSession).mockResolvedValue(null);
    // デフォルト: startup files なし
    mockInvoke.mockResolvedValue([]);
    // デフォルト: openFileAsTab はダミーの tabId を返す
    mockOpenFileAsTab.mockResolvedValue('mock-tab-id');
  });

  it('セッションなし + CLI 引数なし → Untitled タブを作成する', async () => {
    mockInvoke.mockResolvedValue([]); // get_startup_file_paths = []

    renderHook(() => useSessionRestore());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const { tabs } = useTabStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.fileName).toMatch(/Untitled/);
    expect(tabs[0]!.filePath).toBeNull();
  });

  it('セッションなし + CLI 引数あり → 空タブを作成せず startup file を開く', async () => {
    mockInvoke.mockResolvedValue(['/path/to/file.md']); // get_startup_file_paths = ['/path/to/file.md']

    renderHook(() => useSessionRestore());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Untitled タブは作成されない
    const { tabs } = useTabStore.getState();
    expect(tabs).toHaveLength(0); // mock は addTab を呼ばないためタブなし
    // startup file を開こうとしたことを確認
    expect(mockOpenFileAsTab).toHaveBeenCalledWith('/path/to/file.md', { skipActivate: true });
  });

  it('セッション openFiles が空 + CLI 引数なし → 空タブを作成する', async () => {
    vi.mocked(loadSession).mockResolvedValue(null); // openFiles が空
    mockInvoke.mockResolvedValue([]); // get_startup_file_paths = []

    renderHook(() => useSessionRestore());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const { tabs } = useTabStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.filePath).toBeNull();
  });

  it('セッション openFiles が空 + CLI 引数あり → 空タブを作成せず startup file を開く', async () => {
    vi.mocked(loadSession).mockResolvedValue(null);
    mockInvoke.mockResolvedValue(['/path/to/file.md']); // get_startup_file_paths = ['/path/to/file.md']

    renderHook(() => useSessionRestore());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const { tabs } = useTabStore.getState();
    expect(tabs).toHaveLength(0);
    expect(mockOpenFileAsTab).toHaveBeenCalledWith('/path/to/file.md', { skipActivate: true });
  });

  it('CLI 引数で複数ファイルが渡された場合に全て openFileAsTab を呼ぶ', async () => {
    const paths = ['/path/a.md', '/path/b.md', '/path/c.md'];
    mockInvoke.mockResolvedValue(paths);

    renderHook(() => useSessionRestore());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockOpenFileAsTab).toHaveBeenCalledTimes(3);
    expect(mockOpenFileAsTab).toHaveBeenNthCalledWith(1, '/path/a.md', { skipActivate: true });
    expect(mockOpenFileAsTab).toHaveBeenNthCalledWith(2, '/path/b.md', { skipActivate: true });
    expect(mockOpenFileAsTab).toHaveBeenNthCalledWith(3, '/path/c.md', { skipActivate: true });
  });

  it('セッション復元失敗 + CLI 引数なし → 空タブを作成する', async () => {
    vi.mocked(loadSession).mockRejectedValue(new Error('store error'));
    mockInvoke.mockResolvedValue([]); // get_startup_file_paths = []

    renderHook(() => useSessionRestore());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const { tabs } = useTabStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.filePath).toBeNull();
  });

  it('セッション復元失敗 + CLI 引数あり → 空タブを作成せず startup file を開く', async () => {
    vi.mocked(loadSession).mockRejectedValue(new Error('store error'));
    mockInvoke.mockResolvedValue(['/path/to/file.md']); // get_startup_file_paths = ['/path/to/file.md']

    renderHook(() => useSessionRestore());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const { tabs } = useTabStore.getState();
    expect(tabs).toHaveLength(0);
    expect(mockOpenFileAsTab).toHaveBeenCalledWith('/path/to/file.md', { skipActivate: true });
  });
});
