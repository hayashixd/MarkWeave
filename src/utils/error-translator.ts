/**
 * Tauri コマンドエラーの翻訳層。
 *
 * error-handling-design.md §5.2 に準拠。
 * Rust 側の AppError をユーザー向け日本語メッセージに変換する。
 */

import { logger } from './logger';

interface AppError {
  kind:
    | 'FileNotFound'
    | 'PermissionDenied'
    | 'DiskFull'
    | 'FileLocked'
    | 'InvalidPath'
    | 'Unknown';
  detail?: { path?: string; message?: string };
}

function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'kind' in error &&
    typeof (error as AppError).kind === 'string'
  );
}

/** Tauri コマンドのエラーをユーザー向けメッセージに変換する */
export function translateError(error: unknown): string {
  if (isAppError(error)) {
    switch (error.kind) {
      case 'FileNotFound':
        return `ファイルが見つかりません: ${error.detail?.path ?? ''}`;
      case 'PermissionDenied':
        return `ファイルへのアクセス権がありません: ${error.detail?.path ?? ''}`;
      case 'DiskFull':
        return 'ディスクの空き容量が不足しています。不要なファイルを削除してください。';
      case 'FileLocked':
        return `ファイルが別のアプリで開かれています: ${error.detail?.path ?? ''}`;
      case 'InvalidPath':
        return `無効なファイルパスです: ${error.detail?.path ?? ''}`;
      default:
        return '予期しないエラーが発生しました。ログファイルを確認してください。';
    }
  }

  if (error instanceof Error) {
    logger.error('Untranslated error', error);
    return '予期しないエラーが発生しました。';
  }

  return String(error);
}
