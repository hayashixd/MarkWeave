/**
 * セーフモードユーティリティ
 *
 * plugin-api-design.md §9.5 に準拠。
 * - セーフモード時は全サードパーティプラグインを無効化
 * - 起動失敗カウンターの管理は Rust 側（safe_mode.rs）が担当
 * - TypeScript 側は Tauri コマンド経由で状態を取得する
 */

import { invoke } from '@tauri-apps/api/core';

/** セーフモードが有効かどうかを Tauri バックエンドに問い合わせる */
export async function isSafeModeActive(): Promise<boolean> {
  try {
    return await invoke<boolean>('is_safe_mode_active');
  } catch {
    return false;
  }
}

/** 通常モードで再起動する */
export async function restartInNormalMode(): Promise<void> {
  try {
    await invoke('set_safe_mode', { active: false });
    await invoke('restart_app');
  } catch {
    window.location.reload();
  }
}

/** セーフモードかどうかを判定してプラグインをスキップすべきか返す */
export function shouldSkipPlugin(pluginId: string, safeModeActive: boolean): boolean {
  if (!safeModeActive) return false;
  // ビルトインプラグインは ID が "builtin." で始まる
  return !pluginId.startsWith('builtin.');
}
