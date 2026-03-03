/**
 * ウィンドウ状態（位置・サイズ・最大化）の復元・保存フック。
 *
 * - マウント時に前回のウィンドウ状態を復元
 * - captureAndSaveWindowState() をエクスポートし、
 *   useCloseGuard がウィンドウクローズ前に呼び出す
 */

import { useEffect, useRef } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';
import {
  loadWindowState,
  saveWindowState,
} from '../store/session';

/**
 * アプリ起動時にウィンドウ状態を復元するフック。
 * AppShell でマウント時に 1 回だけ実行される。
 */
export function useWindowState() {
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    restoreWindowState();
  }, []);
}

async function restoreWindowState(): Promise<void> {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;

  try {
    const state = await loadWindowState();
    if (!state) return;

    const win = getCurrentWebviewWindow();

    if (state.isMaximized) {
      await win.maximize();
    } else {
      await win.setPosition(new PhysicalPosition(state.x, state.y));
      await win.setSize(new PhysicalSize(state.width, state.height));
    }
  } catch {
    // Tauri 外（ブラウザ開発時）ではスキップ
  }
}

/**
 * 現在のウィンドウ状態を取得して保存する。
 * useCloseGuard からウィンドウクローズ直前に呼び出される。
 */
export async function captureAndSaveWindowState(): Promise<void> {
  try {
    const win = getCurrentWebviewWindow();
    const isMaximized = await win.isMaximized();
    const position = await win.outerPosition();
    const size = await win.outerSize();

    await saveWindowState({
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      isMaximized,
    });
  } catch {
    // ignore
  }
}
