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
import { loadRecoveryData } from './crash-recovery';
import type { RecoveryEntry } from './crash-recovery';

export interface FileSession {
  path: string; // 絶対パス
}

/** ペイン分割セッション情報（split-editor-design.md §5.2） */
export interface PaneSessionState {
  layoutType: 'single' | 'horizontal' | 'vertical';
  splitRatio: number;
  /** 各ペインに属するファイルパス一覧（タブ順） */
  panes: {
    filePaths: string[];
    activeFilePath: string | null;
  }[];
  activePaneIndex: number;
}

export interface SessionState {
  openFiles: FileSession[]; // 開いているファイルの一覧（タブ順）
  activeFilePath: string | null; // アクティブタブのファイルパス
  sidebarVisible: boolean; // サイドバーの表示状態
  paneLayout?: PaneSessionState; // ペイン分割状態（Phase 7）
  lastCleanExit?: boolean; // 正常終了した場合のみ true（§10.5）
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
  const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
  await store.set('openFiles', state.openFiles);
  await store.set('activeFilePath', state.activeFilePath);
  await store.set('sidebarVisible', state.sidebarVisible);
  if (state.paneLayout) {
    await store.set('paneLayout', state.paneLayout);
  } else {
    await store.delete('paneLayout');
  }
  // lastCleanExit フラグ（§10.5: 正常終了判定用）
  await store.set('lastCleanExit', state.lastCleanExit ?? false);
  await store.save(); // 明示的に保存（autoSave: false でクラッシュ耐性向上）
}

/**
 * ウィンドウ状態（位置・サイズ・最大化）の保存。
 */
export async function saveWindowState(state: WindowState): Promise<void> {
  const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
  await store.set('windowState', state);
  await store.save();
}

/**
 * ウィンドウ状態の復元。
 * 保存されていない場合は null を返す。
 */
export async function loadWindowState(): Promise<WindowState | null> {
  const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
  return (await store.get<WindowState>('windowState')) ?? null;
}

/**
 * セッションの復元（アプリ起動時）。
 * ファイルが実際に存在するか確認してから復元する。
 */
export async function loadSession(): Promise<SessionState | null> {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return null;
  const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
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
    paneLayout:
      (await store.get<PaneSessionState>('paneLayout')) ?? undefined,
    lastCleanExit:
      (await store.get<boolean>('lastCleanExit')) ?? undefined,
  };
}

/**
 * 起動時にクラッシュリカバリが必要か判定する（§10.5）。
 *
 * lastCleanExit === true → 正常終了 → リカバリ不要
 * lastCleanExit === false / undefined → クラッシュの可能性 → リカバリデータを確認
 */
export async function checkNeedsRecovery(): Promise<RecoveryEntry[] | null> {
  const session = await loadSession();

  // 正常終了していた場合はリカバリ不要
  if (session?.lastCleanExit === true) return null;

  // クラッシュ（または初回起動）の場合のみリカバリデータを確認
  return await loadRecoveryData();
}
