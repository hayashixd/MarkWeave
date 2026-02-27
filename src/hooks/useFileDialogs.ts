/**
 * ファイルダイアログフック。
 *
 * file-workspace-design.md §9 に準拠:
 * - Ctrl+O: ファイルを開くダイアログ
 * - Ctrl+Shift+S: 名前を付けて保存ダイアログ
 * - Ctrl+S (未保存ファイル): 名前を付けて保存ダイアログにフォールバック
 *
 * tauri-plugin-dialog を使用してネイティブダイアログを表示する。
 */

import { useCallback } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useOpenFileAsTab } from './useOpenFileAsTab';
import { useTabStore } from '../store/tabStore';
import { useToastStore } from '../store/toastStore';
import { writeFile } from '../lib/tauri-commands';

const MARKDOWN_FILTER = {
  name: 'Markdown',
  extensions: ['md', 'markdown'],
};

const ALL_SUPPORTED_FILTER = {
  name: 'サポートされているファイル',
  extensions: ['md', 'markdown', 'html'],
};

/**
 * ファイルを開くダイアログ（Ctrl+O）。
 * 選択されたファイルをタブとして開く。複数選択可能。
 */
export function useOpenFileDialog() {
  const openFileAsTab = useOpenFileAsTab();

  return useCallback(async () => {
    const selected = await open({
      multiple: true,
      filters: [ALL_SUPPORTED_FILTER, MARKDOWN_FILTER],
    });

    if (!selected) return;

    // open() は multiple:true の場合に string[] を返す
    const paths = Array.isArray(selected) ? selected : [selected];

    for (const path of paths) {
      await openFileAsTab(path);
    }
  }, [openFileAsTab]);
}

/**
 * 名前を付けて保存ダイアログ（Ctrl+Shift+S / 未保存ファイルの Ctrl+S）。
 * 保存先パスを選択し、ファイルを書き込む。
 * タブのファイルパスとファイル名を更新する。
 */
export function useSaveAsDialog() {
  const { getActiveTab, markSaved } = useTabStore();
  const show = useToastStore((s) => s.show);

  return useCallback(async () => {
    const tab = getActiveTab();
    if (!tab) return;

    const selectedPath = await save({
      filters: [MARKDOWN_FILTER],
      defaultPath: tab.filePath ?? undefined,
    });

    if (!selectedPath) return; // キャンセル

    // 拡張子が付いていない場合は .md を自動付与
    const filePath = selectedPath.match(/\.(md|markdown|html)$/i)
      ? selectedPath
      : `${selectedPath}.md`;

    try {
      await writeFile(filePath, tab.content);
      markSaved(tab.id, filePath);
      const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
      show('success', `「${fileName}」を保存しました。`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      show('error', `保存に失敗しました: ${detail}`);
    }
  }, [getActiveTab, markSaved, show]);
}
