/**
 * ファイルをタブとして開く共通フック。
 *
 * useFileOpenListener と useSessionRestore の重複ロジックを統一する。
 * - ファイルが既に開いている場合はそちらにフォーカスする（tabStore.addTab の仕様）
 * - 読み込み失敗時はエラートーストを表示する
 */

import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '../store/tabStore';
import { useToastStore } from '../store/toastStore';
import { readFile } from '../lib/tauri-commands';

/**
 * ファイルパスを受け取り、タブを追加して tabId を返すコールバックを返す。
 * エラー時は toast を表示して null を返す。
 */
export function useOpenFileAsTab() {
  const addTab = useTabStore((s) => s.addTab);
  const show = useToastStore((s) => s.show);

  return useCallback(
    async (path: string, options?: { skipActivate?: boolean }): Promise<string | null> => {
      try {
        const content = await readFile(path);
        const fileName = path.split(/[/\\]/).pop() ?? 'Untitled';
        const tabId = addTab({
          filePath: path,
          fileName,
          content,
          savedContent: content,
          skipActivate: options?.skipActivate,
        });

        // Windows ジャンプリストと「最近使ったファイル」に登録する
        // window-tab-session-design.md §4.2 参照。非 Windows では no-op。
        invoke('add_to_recent_documents', { path }).catch(() => {
          // ジャンプリスト登録の失敗はファイルオープン自体には影響させない
        });

        return tabId;
      } catch (err) {
        const fileName = path.split(/[/\\]/).pop() ?? path;
        const detail = err instanceof Error ? err.message : String(err);
        show('error', `「${fileName}」を開けませんでした: ${detail}`);
        return null;
      }
    },
    [addTab, show],
  );
}
