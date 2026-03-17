/**
 * useSessionRestore のユニットテスト（has_startup_files 対応部分）
 *
 * 検証する動作:
 * 1. セッションなし + CLI 引数なし → 空の Untitled タブを作成する
 * 2. セッションなし + CLI 引数あり → 空タブを作らない（fileOpenListener が後続で開く）
 * 3. セッション復元失敗 + CLI 引数あり → 空タブを作らない
 * 4. セッション復元失敗 + CLI 引数なし → 空タブを作成する
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

describe('useSessionRestore — has_startup_files 対応', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // tabStore をリセット
    useTabStore.setState({ tabs: [], activeTabId: null, _untitledCounter: 0 });
    // デフォルト: セッションなし
    vi.mocked(loadSession).mockResolvedValue(null);
  });

  it('セッションなし + CLI 引数なし → Untitled タブを作成する', async () => {
    mockInvoke.mockResolvedValue(false); // has_startup_files = false

    renderHook(() => useSessionRestore());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const { tabs } = useTabStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.fileName).toMatch(/Untitled/);
    expect(tabs[0]!.filePath).toBeNull();
  });

  it('セッションなし + CLI 引数あり → 空タブを作成しない', async () => {
    mockInvoke.mockResolvedValue(true); // has_startup_files = true

    renderHook(() => useSessionRestore());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const { tabs } = useTabStore.getState();
    expect(tabs).toHaveLength(0);
  });

  it('セッション openFiles が空 + CLI 引数なし → 空タブを作成する', async () => {
    vi.mocked(loadSession).mockResolvedValue(null); // openFiles が空
    mockInvoke.mockResolvedValue(false); // has_startup_files = false

    renderHook(() => useSessionRestore());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const { tabs } = useTabStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.filePath).toBeNull();
  });

  it('セッション openFiles が空 + CLI 引数あり → 空タブを作成しない', async () => {
    vi.mocked(loadSession).mockResolvedValue(null);
    mockInvoke.mockResolvedValue(true); // has_startup_files = true

    renderHook(() => useSessionRestore());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const { tabs } = useTabStore.getState();
    expect(tabs).toHaveLength(0);
  });

  it('セッション復元失敗 + CLI 引数なし → 空タブを作成する', async () => {
    vi.mocked(loadSession).mockRejectedValue(new Error('store error'));
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'has_startup_files') return Promise.resolve(false);
      return Promise.resolve(null);
    });

    renderHook(() => useSessionRestore());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const { tabs } = useTabStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.filePath).toBeNull();
  });

  it('セッション復元失敗 + CLI 引数あり → 空タブを作成しない', async () => {
    vi.mocked(loadSession).mockRejectedValue(new Error('store error'));
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'has_startup_files') return Promise.resolve(true);
      return Promise.resolve(null);
    });

    renderHook(() => useSessionRestore());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const { tabs } = useTabStore.getState();
    expect(tabs).toHaveLength(0);
  });
});
