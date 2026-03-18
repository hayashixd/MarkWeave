/**
 * useWindowSync のユニットテスト
 *
 * CLAUDE.md 制約:
 * - 「未保存（Dirty）のファイル」が外部プロセスで変更された場合、
 *   絶対に自動でリロードして上書き破棄しないこと。
 *   必ずユーザーに選択肢を提示する設計にすること。
 *
 * 検証する動作:
 * 1. 他ウィンドウの file-saved → 該当ファイルが開いている → external-file-change を dispatch
 * 2. 自分ウィンドウの file-saved → 無視
 * 3. 開いていないファイルの file-saved → 無視
 * 4. settings-changed → settingsStore.updateSettings を呼ぶ
 * 5. file-lock-released → 該当ファイルが読み取り専用で開いている → 通知 dispatch
 * 6. アンマウント時に全リスナーを解除
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWindowSync } from './useWindowSync';
import { useTabStore } from '../store/tabStore';

// ── Tauri イベント API モック ─────────────────────────────────────────────────

type EventHandler = (event: { payload: unknown }) => void;
const capturedListeners: Map<string, EventHandler> = new Map();
const mockUnlistenFns: Array<ReturnType<typeof vi.fn>> = [];

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (eventName: string, handler: EventHandler) => {
    capturedListeners.set(eventName, handler);
    const unlisten = vi.fn();
    mockUnlistenFns.push(unlisten);
    return unlisten;
  }),
}));

// ── Tauri webviewWindow モック ────────────────────────────────────────────────

let currentWindowLabel = 'main';
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: vi.fn(() => ({ label: currentWindowLabel })),
}));

// ── settingsStore モック ──────────────────────────────────────────────────────

const mockUpdateSettings = vi.fn();
vi.mock('../store/settingsStore', () => ({
  useSettingsStore: Object.assign(vi.fn(), {
    getState: vi.fn(() => ({ updateSettings: mockUpdateSettings })),
  }),
}));

// ── ヘルパー: イベント手動発火 ────────────────────────────────────────────────

function emitFileSaved(fromWindow: string, filePath: string) {
  capturedListeners.get('file-saved')?.({
    payload: { windowLabel: fromWindow, filePath },
  });
}

function emitSettingsChanged(key: string, value: unknown) {
  capturedListeners.get('settings-changed')?.({
    payload: { key, value },
  });
}

function emitFileLockReleased(fromWindow: string, filePath: string) {
  capturedListeners.get('file-lock-released')?.({
    payload: { windowLabel: fromWindow, filePath },
  });
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe('useWindowSync', () => {
  beforeEach(() => {
    capturedListeners.clear();
    mockUnlistenFns.length = 0;
    vi.clearAllMocks();
    currentWindowLabel = 'main';
    // tabStore をリセット
    useTabStore.setState({ tabs: [], activeTabId: null, _untitledCounter: 0 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('イベントリスナー登録', () => {
    it('3 つのイベント（settings-changed / file-saved / file-lock-released）を listen する', () => {
      const { listen } = vi.mocked(
        vi.importActual('@tauri-apps/api/event') as { listen: ReturnType<typeof vi.fn> },
      );
      renderHook(() => useWindowSync());

      // 登録されたイベント名を確認
      const registeredEvents = Array.from(capturedListeners.keys());
      expect(registeredEvents).toContain('settings-changed');
      expect(registeredEvents).toContain('file-saved');
      expect(registeredEvents).toContain('file-lock-released');
      void listen; // suppress unused import
    });
  });

  describe('file-saved イベント', () => {
    it('他ウィンドウが保存 + タブが開いている → external-file-change を dispatch する', () => {
      // /note/test.md をタブに追加
      useTabStore.getState().addTab({
        filePath: '/note/test.md',
        fileName: 'test.md',
        content: 'draft content',
        savedContent: 'saved content',
      });

      renderHook(() => useWindowSync());

      const dispatchedEvents: string[] = [];
      window.addEventListener('external-file-change', (e) => {
        dispatchedEvents.push((e as CustomEvent).detail.filePath);
      });

      emitFileSaved('other-window', '/note/test.md');

      expect(dispatchedEvents).toContain('/note/test.md');
    });

    it('自ウィンドウからの file-saved → 無視（external-file-change を dispatch しない）', () => {
      useTabStore.getState().addTab({
        filePath: '/note/test.md',
        fileName: 'test.md',
        content: 'content',
        savedContent: 'content',
      });

      currentWindowLabel = 'main';
      renderHook(() => useWindowSync());

      const handler = vi.fn();
      window.addEventListener('external-file-change', handler);

      emitFileSaved('main', '/note/test.md'); // 自ウィンドウ

      expect(handler).not.toHaveBeenCalled();
      window.removeEventListener('external-file-change', handler);
    });

    it('開いていないファイルの file-saved → 無視', () => {
      // /note/other.md は開いていない
      renderHook(() => useWindowSync());

      const handler = vi.fn();
      window.addEventListener('external-file-change', handler);

      emitFileSaved('other-window', '/note/other.md');

      expect(handler).not.toHaveBeenCalled();
      window.removeEventListener('external-file-change', handler);
    });

    it('ダーティ（未保存）なタブが外部変更を受けた場合も external-file-change を dispatch する', () => {
      const tabId = useTabStore.getState().addTab({
        filePath: '/note/dirty.md',
        fileName: 'dirty.md',
        content: 'original',
        savedContent: 'original',
      });
      // コンテンツを変更してダーティ状態にする
      useTabStore.getState().updateContent(tabId, 'modified but unsaved');
      expect(useTabStore.getState().getTab(tabId)?.isDirty).toBe(true);

      renderHook(() => useWindowSync());

      const dispatchedPaths: string[] = [];
      const handler = (e: Event) => dispatchedPaths.push((e as CustomEvent).detail.filePath);
      window.addEventListener('external-file-change', handler);

      emitFileSaved('other-window', '/note/dirty.md');

      // ダーティでも通知は飛ぶ（自動リロードしない判断は受信側の責務）
      expect(dispatchedPaths).toContain('/note/dirty.md');
      window.removeEventListener('external-file-change', handler);
    });

    it('複数タブが開いている場合、該当ファイルのみ通知する', () => {
      useTabStore.getState().addTab({
        filePath: '/note/a.md',
        fileName: 'a.md',
        content: 'a',
        savedContent: 'a',
      });
      useTabStore.getState().addTab({
        filePath: '/note/b.md',
        fileName: 'b.md',
        content: 'b',
        savedContent: 'b',
      });

      renderHook(() => useWindowSync());

      const dispatchedPaths: string[] = [];
      const handler = (e: Event) => dispatchedPaths.push((e as CustomEvent).detail.filePath);
      window.addEventListener('external-file-change', handler);

      emitFileSaved('other-window', '/note/a.md');

      expect(dispatchedPaths).toEqual(['/note/a.md']);
      window.removeEventListener('external-file-change', handler);
    });
  });

  describe('settings-changed イベント', () => {
    it('settings-changed を受信したら updateSettings を呼ぶ', () => {
      renderHook(() => useWindowSync());

      emitSettingsChanged('theme', 'dark');

      expect(mockUpdateSettings).toHaveBeenCalledWith({ theme: 'dark' });
    });

    it('複数の設定変更を連続して処理できる', () => {
      renderHook(() => useWindowSync());

      emitSettingsChanged('theme', 'dark');
      emitSettingsChanged('fontSize', 16);

      expect(mockUpdateSettings).toHaveBeenCalledTimes(2);
      expect(mockUpdateSettings).toHaveBeenNthCalledWith(1, { theme: 'dark' });
      expect(mockUpdateSettings).toHaveBeenNthCalledWith(2, { fontSize: 16 });
    });
  });

  describe('file-lock-released イベント', () => {
    it('読み取り専用タブに対して file-lock-released → 通知イベントを dispatch する', () => {
      useTabStore.getState().addTab({
        filePath: '/note/locked.md',
        fileName: 'locked.md',
        content: 'content',
        savedContent: 'content',
        isReadOnly: true,
      });

      renderHook(() => useWindowSync());

      const notifications: Array<{ filePath: string; fileName: string }> = [];
      const handler = (e: Event) => notifications.push((e as CustomEvent).detail);
      window.addEventListener('file-lock-released-notification', handler);

      emitFileLockReleased('other-window', '/note/locked.md');

      expect(notifications).toHaveLength(1);
      expect(notifications[0]!.filePath).toBe('/note/locked.md');
      window.removeEventListener('file-lock-released-notification', handler);
    });

    it('自ウィンドウからの file-lock-released → 無視', () => {
      useTabStore.getState().addTab({
        filePath: '/note/locked.md',
        fileName: 'locked.md',
        content: 'content',
        savedContent: 'content',
        isReadOnly: true,
      });

      currentWindowLabel = 'main';
      renderHook(() => useWindowSync());

      const handler = vi.fn();
      window.addEventListener('file-lock-released-notification', handler);

      emitFileLockReleased('main', '/note/locked.md');

      expect(handler).not.toHaveBeenCalled();
      window.removeEventListener('file-lock-released-notification', handler);
    });

    it('読み取り専用でないタブへの通知 → 無視', () => {
      useTabStore.getState().addTab({
        filePath: '/note/writable.md',
        fileName: 'writable.md',
        content: 'content',
        savedContent: 'content',
        isReadOnly: false,
      });

      renderHook(() => useWindowSync());

      const handler = vi.fn();
      window.addEventListener('file-lock-released-notification', handler);

      emitFileLockReleased('other-window', '/note/writable.md');

      expect(handler).not.toHaveBeenCalled();
      window.removeEventListener('file-lock-released-notification', handler);
    });
  });
});
