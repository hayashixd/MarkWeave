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
  file_recent_files: () => void;
  file_recent_workspaces: () => void;
  file_save: () => void;
  file_save_as: () => void;
  file_export_html: () => void;
  file_export_pdf: () => void;
  file_export_word: () => void;
  file_export_latex: () => void;
  file_export_epub: () => void;
  file_save_as_md: () => void;
  file_save_as_html: () => void;
  file_template_new: () => void;
  file_daily_note: () => void;
  file_print: () => void;
  // 編集メニュー
  edit_paste_plain: () => void;
  edit_find: () => void;
  edit_find_replace: () => void;
  edit_text_stats: () => void;
  edit_preferences: () => void;
  // 表示メニュー
  view_mode_wysiwyg: () => void;
  view_mode_source: () => void;
  view_sidebar_toggle: () => void;
  view_outline: () => void;
  view_files: () => void;
  view_ai_templates: () => void;
  view_backlinks: () => void;
  view_tags: () => void;
  view_git: () => void;
  view_lint: () => void;
  view_floating_toc: () => void;
  view_split_pane: () => void;
  view_focus_mode: () => void;
  view_typewriter_mode: () => void;
  view_zen_mode: () => void;
  view_zoom_reset: () => void;
  view_zoom_in: () => void;
  view_zoom_out: () => void;
  // ヘルプメニュー
  help_shortcuts: () => void;
  help_version: () => void;
  help_feedback: () => void;
  help_check_updates: () => void;
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

    // Tauri 外環境（Playwright テスト・ブラウザ開発）向けフォールバック:
    // window.dispatchEvent(new CustomEvent('tauri-menu-action', { detail: 'menu_id' }))
    // でメニューアクションをトリガーできる
    const handleWebEvent = (e: Event) => {
      const id = (e as CustomEvent<string>).detail as keyof MenuActions;
      const handler = actionsRef.current[id];
      if (handler) {
        handler();
      }
    };
    window.addEventListener('tauri-menu-action', handleWebEvent);

    return () => {
      unlisten?.();
      window.removeEventListener('tauri-menu-action', handleWebEvent);
    };
  }, []);
}
