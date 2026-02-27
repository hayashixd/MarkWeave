/**
 * 外部ファイルオープンイベント受信フック。
 *
 * window-tab-session-design.md §5.3 に準拠:
 * - Rust 側から emit される 'open-file-request' イベントを listen
 * - ファイルを読み込んで新しいタブで開く
 * - シングルインスタンス制御やコマンドライン引数からのファイルオープンに対応
 */

import { useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useTabStore } from '../store/tabStore';
import { readFile } from '../lib/tauri-commands';

export function useFileOpenListener() {
  const addTab = useTabStore((s) => s.addTab);

  const openFile = useCallback(
    async (path: string) => {
      try {
        const content = await readFile(path);
        const fileName = path.split(/[/\\]/).pop() ?? 'Untitled';
        addTab({
          filePath: path,
          fileName,
          content,
          savedContent: content,
        });
      } catch {
        // ファイル読み込み失敗は無視（トースト通知は将来追加）
      }
    },
    [addTab],
  );

  useEffect(() => {
    // Tauri 環境以外（ブラウザ開発時）では何もしない
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;

    const unlistenPromise = listen<string>('open-file-request', (event) => {
      openFile(event.payload);
    });
    return () => {
      unlistenPromise.then((f) => f());
    };
  }, [openFile]);
}
