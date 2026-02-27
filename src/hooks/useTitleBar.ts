/**
 * タイトルバー同期フック。
 *
 * window-tab-session-design.md §3.3 に準拠:
 * アクティブタブの fileName / isDirty が変化したとき、
 * Rust コマンド set_title_dirty を呼び出してウィンドウタイトルを更新する。
 */

import { useEffect } from 'react';
import { useTabStore } from '../store/tabStore';
import { setTitleBarDirty } from '../lib/tauri-commands';

export function useTitleBar() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);

  const activeTab = activeTabId ? tabs.find((t) => t.id === activeTabId) : undefined;
  const fileName = activeTab?.fileName;
  const isDirty = activeTab?.isDirty ?? false;

  useEffect(() => {
    setTitleBarDirty(isDirty, fileName).catch(() => {
      // Tauri が利用不可（ブラウザ開発時）の場合は無視
    });
  }, [isDirty, fileName]);
}
