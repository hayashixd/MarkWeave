/**
 * useFileOpenListener のユニットテスト
 *
 * 検証する動作:
 * 1. マウント時に get_startup_file_paths を invoke して全パスを開く（複数ファイル対応）
 * 2. open-file-request イベントを listen して受信時にファイルを開く（シングルインスタンス対応）
 * 3. パスが 0 件の場合は何も開かない
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileOpenListener } from './useFileOpenListener';

// Tauri イベント API をモック
const mockListen = vi.fn();
const mockUnlisten = vi.fn();
vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

// Tauri コア invoke をモック
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// useOpenFileAsTab をモック（実際のファイル読み込みをスキップ）
const mockOpenFileAsTab = vi.fn();
vi.mock('./useOpenFileAsTab', () => ({
  useOpenFileAsTab: () => mockOpenFileAsTab,
}));

describe('useFileOpenListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // listen は unlisten 関数を返す Promise を返す
    mockListen.mockResolvedValue(mockUnlisten);
    // デフォルトは空リスト（CLI 引数なし）
    mockInvoke.mockResolvedValue([]);
  });

  it('マウント時に get_startup_file_paths を invoke する', async () => {
    renderHook(() => useFileOpenListener());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockInvoke).toHaveBeenCalledWith('get_startup_file_paths');
  });

  it('CLI 引数で単一ファイルが渡された場合に openFileAsTab を呼ぶ', async () => {
    mockInvoke.mockResolvedValue(['/path/to/file.md']);

    renderHook(() => useFileOpenListener());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockOpenFileAsTab).toHaveBeenCalledTimes(1);
    expect(mockOpenFileAsTab).toHaveBeenCalledWith('/path/to/file.md');
  });

  it('CLI 引数で複数ファイルが渡された場合に全て openFileAsTab を呼ぶ', async () => {
    const paths = ['/path/a.md', '/path/b.md', '/path/c.md'];
    mockInvoke.mockResolvedValue(paths);

    renderHook(() => useFileOpenListener());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockOpenFileAsTab).toHaveBeenCalledTimes(3);
    expect(mockOpenFileAsTab).toHaveBeenNthCalledWith(1, '/path/a.md');
    expect(mockOpenFileAsTab).toHaveBeenNthCalledWith(2, '/path/b.md');
    expect(mockOpenFileAsTab).toHaveBeenNthCalledWith(3, '/path/c.md');
  });

  it('CLI 引数が空の場合は openFileAsTab を呼ばない', async () => {
    mockInvoke.mockResolvedValue([]);

    renderHook(() => useFileOpenListener());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockOpenFileAsTab).not.toHaveBeenCalled();
  });

  it('open-file-request イベントの listen を登録する', async () => {
    renderHook(() => useFileOpenListener());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockListen).toHaveBeenCalledWith('open-file-request', expect.any(Function));
  });

  it('open-file-request イベント受信時に openFileAsTab を呼ぶ（シングルインスタンス）', async () => {
    let capturedHandler: ((event: { payload: string }) => void) | null = null;
    mockListen.mockImplementation((_event: string, handler: (event: { payload: string }) => void) => {
      capturedHandler = handler;
      return Promise.resolve(mockUnlisten);
    });

    renderHook(() => useFileOpenListener());

    await act(async () => {
      await Promise.resolve();
    });

    // イベントを発火
    act(() => {
      capturedHandler?.({ payload: '/path/single-instance.md' });
    });

    expect(mockOpenFileAsTab).toHaveBeenCalledWith('/path/single-instance.md');
  });

  it('アンマウント時に unlisten が呼ばれる', async () => {
    const { unmount } = renderHook(() => useFileOpenListener());

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockUnlisten).toHaveBeenCalled();
  });
});
