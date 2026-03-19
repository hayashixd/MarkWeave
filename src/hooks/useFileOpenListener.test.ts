/**
 * useFileOpenListener のユニットテスト
 *
 * 検証する動作:
 * 1. open-file-request イベントを listen して受信時にファイルを開く（シングルインスタンス対応）
 * 2. アンマウント時に unlisten が呼ばれる
 *
 * 注意: 起動時 CLI 引数（get_startup_file_paths）の処理は useSessionRestore に移譲済み。
 * このフックは open-file-request イベント（アプリ起動済み時の追加ファイル）のみを処理する。
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
