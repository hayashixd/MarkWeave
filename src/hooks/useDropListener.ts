/**
 * ドラッグ&ドロップによるファイルオープンフック。
 *
 * file-workspace-design.md §15 に準拠:
 * - .md / .markdown ファイル → 新規タブで開く
 * - .html ファイル → 新規タブで開く（Phase 5 で HTML 編集モードに対応）
 * - フォルダ → トースト通知（ワークスペース機能は Phase 3）
 * - その他 → 「サポートされていないファイル形式」トースト
 * - 複数ファイル → 最大 10 ファイルまで個別タブで開く
 *
 * ドラッグ中はオーバーレイを表示してビジュアルフィードバックを提供する。
 */

import { useState, useEffect, useCallback } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useOpenFileAsTab } from './useOpenFileAsTab';
import { useToastStore } from '../store/toastStore';
import { getPathInfo } from '../lib/tauri-commands';

const SUPPORTED_EXTENSIONS = ['md', 'markdown', 'html'];
const MAX_DROP_FILES = 10;

export function useDropListener() {
  const [isDragOver, setIsDragOver] = useState(false);
  const openFileAsTab = useOpenFileAsTab();
  const show = useToastStore((s) => s.show);

  const handleDrop = useCallback(
    async (paths: string[]) => {
      setIsDragOver(false);

      if (paths.length === 0) return;

      if (paths.length > MAX_DROP_FILES) {
        show(
          'warning',
          `一度にドロップできるファイルは ${MAX_DROP_FILES} 個までです。最初の ${MAX_DROP_FILES} 個を開きます。`,
        );
      }

      const filesToOpen = paths.slice(0, MAX_DROP_FILES);

      for (const path of filesToOpen) {
        try {
          const info = await getPathInfo(path);

          if (info.isDirectory) {
            show(
              'info',
              'フォルダのワークスペース機能は今後のアップデートで対応予定です。',
            );
            continue;
          }

          const ext = info.extension?.toLowerCase();
          if (ext && SUPPORTED_EXTENSIONS.includes(ext)) {
            await openFileAsTab(path);
          } else {
            const fileName = path.split(/[/\\]/).pop() ?? path;
            show(
              'warning',
              `「${fileName}」はサポートされていないファイル形式です。`,
            );
          }
        } catch {
          const fileName = path.split(/[/\\]/).pop() ?? path;
          show('error', `「${fileName}」を開けませんでした。`);
        }
      }
    },
    [openFileAsTab, show],
  );

  useEffect(() => {
    // Tauri 環境以外（ブラウザ開発時）では何もしない
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window))
      return;

    let cancelled = false;

    const setupListener = async () => {
      const appWindow = getCurrentWebviewWindow();

      const unlisten = await appWindow.onDragDropEvent((event) => {
        if (cancelled) return;

        if (event.payload.type === 'over') {
          setIsDragOver(true);
        } else if (event.payload.type === 'drop') {
          setIsDragOver(false);
          handleDrop(event.payload.paths);
        } else if (event.payload.type === 'leave') {
          setIsDragOver(false);
        }
      });

      return unlisten;
    };

    const unlistenPromise = setupListener();

    return () => {
      cancelled = true;
      unlistenPromise.then((fn) => fn());
    };
  }, [handleDrop]);

  return { isDragOver };
}
