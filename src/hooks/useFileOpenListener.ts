/**
 * 外部ファイルオープンイベント受信フック。
 *
 * window-tab-session-design.md §5.3 に準拠:
 * - Rust 側から emit される 'open-file-request' イベントを listen
 * - ファイルを読み込んで新しいタブで開く
 * - シングルインスタンス制御やコマンドライン引数からのファイルオープンに対応
 *
 * 読み込み失敗時はエラートーストを表示する（useOpenFileAsTab 内で処理）。
 */

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useOpenFileAsTab } from './useOpenFileAsTab';

export function useFileOpenListener() {
  const openFileAsTab = useOpenFileAsTab();

  useEffect(() => {
    // Tauri 環境以外（ブラウザ開発時）では何もしない
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;

    const unlistenPromise = listen<string>('open-file-request', (event) => {
      openFileAsTab(event.payload);
    });
    return () => {
      unlistenPromise.then((f) => f());
    };
  }, [openFileAsTab]);
}
