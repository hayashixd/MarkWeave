/**
 * 外部ファイルオープンイベント受信フック。
 *
 * window-tab-session-design.md §5.3 に準拠:
 * - Rust 側から emit される 'open-file-request' イベントを listen
 *   （シングルインスタンス制御: アプリ起動済み時の追加ファイル、複数ファイルも個別 emit）
 * - 起動時 CLI 引数は get_startup_file_paths invoke で取得（競合回避のため pull 型）
 *   （複数ファイル対応: markweave a.md b.md c.md でも全て開く）
 *
 * 読み込み失敗時はエラートーストを表示する（useOpenFileAsTab 内で処理）。
 */

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useOpenFileAsTab } from './useOpenFileAsTab';

export function useFileOpenListener() {
  const openFileAsTab = useOpenFileAsTab();

  useEffect(() => {
    // Tauri 環境以外（ブラウザ開発時）では何もしない
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;

    // シングルインスタンス制御からのイベントを受け取る（アプリ起動済みの場合）
    // 複数ファイルは Rust 側が個別に emit するため、1 イベント = 1 ファイルパス
    const unlistenPromise = listen<string>('open-file-request', (event) => {
      openFileAsTab(event.payload);
    });

    // 起動時 CLI 引数で渡されたファイルを全て取得する（push ではなく pull）。
    // listen() より後に実行されるため、イベントの取りこぼしが発生しない。
    // 複数ファイル (a.md b.md c.md) も全て開く。
    invoke<string[]>('get_startup_file_paths').then((paths) => {
      if (!Array.isArray(paths)) return;
      for (const path of paths) {
        openFileAsTab(path);
      }
    });

    return () => {
      unlistenPromise.then((f) => f());
    };
  }, [openFileAsTab]);
}
