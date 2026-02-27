/**
 * ファイルをタブとして開く共通フック。
 *
 * useFileOpenListener と useSessionRestore の重複ロジックを統一する。
 * - ファイルが既に開いている場合はそちらにフォーカスする（tabStore.addTab の仕様）
 * - 読み込み失敗時はエラートーストを表示する
 */

import { useCallback } from 'react';
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
    async (path: string): Promise<string | null> => {
      try {
        const content = await readFile(path);
        const fileName = path.split(/[/\\]/).pop() ?? 'Untitled';
        const tabId = addTab({
          filePath: path,
          fileName,
          content,
          savedContent: content,
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
