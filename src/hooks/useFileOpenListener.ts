/**
 * 外部ファイルオープンイベント受信フック。
 *
 * window-tab-session-design.md §5.3 に準拠:
 * - Rust 側から emit される 'open-file-request' イベントを listen
 *   （シングルインスタンス制御: アプリ起動済み時の追加ファイル、複数ファイルも個別 emit）
 *
 * 起動時 CLI 引数（get_startup_file_paths）の処理は useSessionRestore に移譲済み。
 * 理由: get_startup_file_paths はリストを drain するため、has_startup_files チェックと
 * 競合しないよう useSessionRestore 内で最初の非同期処理として呼ぶ必要がある。
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

    // シングルインスタンス制御からのイベントを受け取る（アプリ起動済みの場合）
    // 複数ファイルは Rust 側が個別に emit するため、1 イベント = 1 ファイルパス
    const unlistenPromise = listen<string>('open-file-request', (event) => {
      openFileAsTab(event.payload);
    });

    return () => {
      unlistenPromise.then((f) => f());
    };
  }, [openFileAsTab]);
}
