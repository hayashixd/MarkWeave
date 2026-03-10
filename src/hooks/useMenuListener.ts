/**
 * useMenuListener - Tauri ネイティブメニューのイベントリスナー
 *
 * app-shell-design.md §2 に準拠。
 * Rust 側から emit される 'menu-action' イベントを受信し、
 * 対応するアクションを実行する。
 */

import { useEffect, useRef } from 'react';

/** メニューアクション ID → コールバックのマッピング */
export interface MenuActions {
  // ファイルメニュー
  file_new: () => void;
  file_open: () => void;
  file_open_folder: () => void;
  file_save: () => void;
  file_save_as: () => void;
  file_export_html: () => void;
  file_export_pdf: () => void;
  file_export_word: () => void;
  file_export_latex: () => void;
  file_export_epub: () => void;
  file_save_as_md: () => void;
  file_save_as_html: () => void;
  file_daily_note: () => void;
  // 編集メニュー
  edit_preferences: () => void;
  // 表示メニュー
  view_sidebar_toggle: () => void;
  view_outline: () => void;
  view_files: () => void;
  view_ai_templates: () => void;
  view_backlinks: () => void;
  view_tags: () => void;
  view_floating_toc: () => void;
  view_zen_mode: () => void;
  view_split_pane: () => void;
  // ヘルプメニュー
  help_shortcuts: () => void;
  help_version: () => void;
}

export function useMenuListener(actions: MenuActions) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function setup() {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const unlistenFn = await listen<string>('menu-action', (event) => {
          const id = event.payload as keyof MenuActions;
          const handler = actionsRef.current[id];
          if (handler) {
            handler();
          }
        });
        unlisten = unlistenFn;
      } catch {
        // Tauri 外（テスト・ブラウザ開発）ではスキップ
      }
    }

    setup();

    return () => {
      unlisten?.();
    };
  }, []);
}
