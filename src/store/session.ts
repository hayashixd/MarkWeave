/**
 * セッション保存・復元モジュール。
 *
 * window-tab-session-design.md §2 に準拠:
 * - @tauri-apps/plugin-store を使ってセッション状態を JSON ファイルに永続化
 * - アプリ起動時に前回のセッションを復元
 * - ウィンドウクローズ前にセッションを保存
 *
 * Phase 1 スコープ:
 * - openFiles (パスのみ) と activeFilePath の保存・復元
 * - sidebarVisible の保存・復元
 * - scrollPosition / cursorOffset / editorMode / sidebarWidth は Phase 1 では省略
 */

import { load } from '@tauri-apps/plugin-store';

export interface FileSession {
  path: string; // 絶対パス
}

export interface SessionState {
  openFiles: FileSession[]; // 開いているファイルの一覧（タブ順）
  activeFilePath: string | null; // アクティブタブのファイルパス
  sidebarVisible: boolean; // サイドバーの表示状態
}

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

const STORE_FILE = 'session.json';

/**
 * セッションの保存（ウィンドウクローズ前に呼ぶ）。
 */
export async function saveSession(state: SessionState): Promise<void> {
  const store = await load(STORE_FILE, { autoSave: false });
  await store.set('openFiles', state.openFiles);
  await store.set('activeFilePath', state.activeFilePath);
  await store.set('sidebarVisible', state.sidebarVisible);
  await store.save(); // 明示的に保存（autoSave: false でクラッシュ耐性向上）
}

/**
 * ウィンドウ状態（位置・サイズ・最大化）の保存。
 */
export async function saveWindowState(state: WindowState): Promise<void> {
  const store = await load(STORE_FILE, { autoSave: false });
  await store.set('windowState', state);
  await store.save();
}

/**
 * ウィンドウ状態の復元。
 * 保存されていない場合は null を返す。
 */
export async function loadWindowState(): Promise<WindowState | null> {
  const store = await load(STORE_FILE, { autoSave: false });
  return (await store.get<WindowState>('windowState')) ?? null;
}

/**
 * セッションの復元（アプリ起動時）。
 * ファイルが実際に存在するか確認してから復元する。
 */
export async function loadSession(): Promise<SessionState | null> {
  const store = await load(STORE_FILE, { autoSave: false });
  const openFiles = await store.get<FileSession[]>('openFiles');
  if (!openFiles || openFiles.length === 0) return null;

  // ファイルが実際に存在するか確認（削除・移動されたファイルを除外）
  const { exists } = await import('@tauri-apps/plugin-fs');
  const validFiles = (
    await Promise.all(
      openFiles.map(async (f) => ((await exists(f.path)) ? f : null)),
    )
  ).filter(Boolean) as FileSession[];

  if (validFiles.length === 0) return null;

  return {
    openFiles: validFiles,
    activeFilePath:
      (await store.get<string | null>('activeFilePath')) ?? null,
    sidebarVisible:
      (await store.get<boolean>('sidebarVisible')) ?? true,
  };
}
