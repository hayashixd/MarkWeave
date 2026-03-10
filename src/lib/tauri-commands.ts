/**
 * Tauri コマンド呼び出しユーティリティ。
 *
 * Rust 側の fs_commands を TypeScript から型安全に呼び出すためのラッパー。
 * error-handling-design.md に準拠し、Rust からのエラーを翻訳する。
 */

import { invoke } from '@tauri-apps/api/core';

/** Rust 側の AppError の JSON 構造 */
interface AppError {
  kind: string;
  detail?: {
    path?: string;
    reason?: string;
    message?: string;
  };
}

/**
 * ファイルを読み込む。
 * @param path 絶対パス
 * @returns ファイルの内容（UTF-8 テキスト）
 */
export async function readFile(path: string): Promise<string> {
  try {
    return await invoke<string>('read_file', { path });
  } catch (err) {
    throw new Error(translateError(err));
  }
}

/**
 * ファイルに書き込む。
 * Rust 側でリトライロジック（指数バックオフ）が実行される。
 * @param path 絶対パス
 * @param content 書き込む内容
 */
export async function writeFile(path: string, content: string): Promise<void> {
  try {
    await invoke<void>('write_file', { path, content });
  } catch (err) {
    throw new Error(translateError(err));
  }
}

/**
 * ファイルの存在を確認する。
 * @param path 絶対パス
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    return await invoke<boolean>('file_exists', { path });
  } catch (err) {
    throw new Error(translateError(err));
  }
}

/** パスの種別情報 */
export interface PathInfo {
  isDirectory: boolean;
  isFile: boolean;
  extension: string | null;
}

/**
 * パスの種別（ファイル/ディレクトリ）を判定する。
 * ドラッグ&ドロップ時のパス判定に使用。
 * @param path 絶対パス
 */
export async function getPathInfo(path: string): Promise<PathInfo> {
  try {
    return await invoke<PathInfo>('get_path_info', { path });
  } catch (err) {
    throw new Error(translateError(err));
  }
}

/**
 * タイトルバーに未保存マーカーを反映する。
 *
 * tauri-ipc-interface.md §9 `set_title_bar_dirty` に準拠:
 * - dirty=true: 「● filename - MarkWeave」
 * - dirty=false: 「filename - MarkWeave」
 * - fileName が undefined の場合はアプリ名のみ表示
 */
export async function setTitleBarDirty(dirty: boolean, fileName?: string): Promise<void> {
  try {
    await invoke<void>('set_title_dirty', { dirty, fileName: fileName ?? null });
  } catch (err) {
    throw new Error(translateError(err));
  }
}

// --- ウィンドウ同期コマンド (window-tab-session-design.md §11) ---

/** ファイルロック取得結果 */
export interface FileLockResult {
  acquired: boolean;
  ownerLabel: string | null;
}

/**
 * ファイルロックの取得を試みる。
 * @returns acquired=true でロック成功、false の場合 ownerLabel に保有者
 */
export async function tryAcquireFileLock(filePath: string, windowLabel: string): Promise<FileLockResult> {
  try {
    return await invoke<FileLockResult>('try_acquire_file_lock', { filePath, windowLabel });
  } catch (err) {
    throw new Error(translateError(err));
  }
}

/**
 * ファイルロックを解放する。
 */
export async function releaseFileLock(filePath: string, windowLabel: string): Promise<void> {
  try {
    await invoke<void>('release_file_lock', { filePath, windowLabel });
  } catch (err) {
    throw new Error(translateError(err));
  }
}

/**
 * ファイルロックを譲渡する。
 */
export async function transferFileLock(filePath: string, fromLabel: string, toLabel: string): Promise<boolean> {
  try {
    return await invoke<boolean>('transfer_file_lock', { filePath, fromLabel, toLabel });
  } catch (err) {
    throw new Error(translateError(err));
  }
}

/**
 * 書き込み権限の拒否を通知する。
 */
export async function notifyWriteAccessDenied(filePath: string, requesterLabel: string): Promise<void> {
  try {
    await invoke<void>('notify_write_access_denied', { filePath, requesterLabel });
  } catch (err) {
    throw new Error(translateError(err));
  }
}

/**
 * タブを新しいウィンドウに切り出す。
 * @returns 新しいウィンドウの label
 */
export async function detachTabToWindow(params: {
  sourceWindowLabel: string;
  filePath: string | null;
  fileName: string;
  content: string;
  encoding: string;
  lineEnding: string;
  fileType: string;
}): Promise<string> {
  try {
    return await invoke<string>('detach_tab_to_window', params);
  } catch (err) {
    throw new Error(translateError(err));
  }
}

/**
 * Rust 側の AppError を日本語のユーザー向けメッセージに変換する。
 *
 * error-handling-design.md に準拠:
 * - 技術的なエラーコードは表示しない
 * - ユーザーが理解できる日本語メッセージに変換する
 */
export function translateError(error: unknown): string {
  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error) as AppError;
      return translateAppError(parsed);
    } catch {
      return error;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '予期しないエラーが発生しました';
}

function translateAppError(error: AppError): string {
  switch (error.kind) {
    case 'FileNotFound':
      return `ファイルが見つかりません: ${error.detail?.path ?? ''}`;
    case 'PermissionDenied':
      return `アクセス権がありません: ${error.detail?.path ?? ''}`;
    case 'DiskFull':
      return 'ディスク容量が不足しています';
    case 'FileLocked':
      return `ファイルがロックされています: ${error.detail?.path ?? ''}`;
    case 'InvalidPath':
      return `無効なファイルパスです: ${error.detail?.path ?? ''}`;
    case 'WriteFailed':
      return `ファイルの保存に失敗しました: ${error.detail?.path ?? ''}`;
    case 'Unknown':
      return error.detail?.message ?? '予期しないエラーが発生しました';
    default:
      return '予期しないエラーが発生しました';
  }
}
