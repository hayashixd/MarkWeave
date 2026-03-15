/**
 * タイトルバー同期フック。
 *
 * window-tab-session-design.md §3.3 に準拠:
 * アクティブタブの fileName / isDirty が変化したとき、
 * Rust コマンド set_title_dirty を呼び出してウィンドウタイトルを更新する。
 *
 * パフォーマンス改善: tabs 配列全体ではなく、必要な値のみを購読する。
 * これにより、他タブのコンテンツ更新時の不要な再レンダリングを防止する。
 */

import { useEffect } from 'react';
import { useTabStore } from '../store/tabStore';
import { setTitleBarDirty } from '../lib/tauri-commands';

export function useTitleBar() {
  // 必要なフィールドのみを購読し、他タブの content 変更による再描画を防ぐ
  const fileName = useTabStore((s) => {
    if (!s.activeTabId) return undefined;
    return s.tabs.find((t) => t.id === s.activeTabId)?.fileName;
  });
  const isDirty = useTabStore((s) => {
    if (!s.activeTabId) return false;
    return s.tabs.find((t) => t.id === s.activeTabId)?.isDirty ?? false;
  });

  useEffect(() => {
    setTitleBarDirty(isDirty, fileName).catch(() => {
      // Tauri が利用不可（ブラウザ開発時）の場合は無視
    });
  }, [isDirty, fileName]);
}
