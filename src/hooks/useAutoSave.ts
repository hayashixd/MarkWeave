/**
 * デバウンス付き自動保存フック。
 *
 * CLAUDE.md の制約:
 * - ファイル保存は必ずデバウンス処理し、UI スレッドをブロックしない
 * - IME 変換中は保存をスケジュールしない
 *
 * window-tab-session-design.md に準拠:
 * - auto-save はデバウンス (1000ms)
 * - Ctrl+S は即時保存（デバウンスなし）
 */

import { useRef, useCallback, useEffect } from 'react';
import { useTabStore } from '../store/tabStore';
import { useSettingsStore } from '../store/settingsStore';

interface AutoSaveOptions {
  tabId: string;
  /** IME 変換中かどうかを返す関数 */
  isComposing: () => boolean;
  /** ファイル書き込み関数（Tauri コマンド呼び出し） */
  writeFn: (path: string, content: string) => Promise<void>;
}

export function useAutoSave({ tabId, isComposing, writeFn }: AutoSaveOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef(false);

  const { settings } = useSettingsStore();
  const { getTab, markSaved } = useTabStore();

  // デバウンス保存のスケジュール
  const scheduleSave = useCallback(() => {
    if (settings.file.autoSaveDelay <= 0) return;

    const tab = getTab(tabId);
    if (!tab || !tab.isDirty || !tab.filePath) return;

    // IME 変換中は保存を後回し
    if (isComposing()) {
      pendingSaveRef.current = true;
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      const currentTab = getTab(tabId);
      if (!currentTab || !currentTab.isDirty || !currentTab.filePath) return;

      try {
        await writeFn(currentTab.filePath, currentTab.content);
        markSaved(tabId);
        pendingSaveRef.current = false;
      } catch {
        // エラーは writeFn 側で処理される（トースト通知など）
      }
    }, settings.file.autoSaveDelay);
  }, [tabId, settings.file.autoSaveDelay, getTab, markSaved, writeFn, isComposing]);

  // 即時保存（Ctrl+S 用）
  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const tab = getTab(tabId);
    if (!tab || !tab.filePath) return;

    try {
      await writeFn(tab.filePath, tab.content);
      markSaved(tabId);
      pendingSaveRef.current = false;
    } catch {
      // エラーは writeFn 側で処理
    }
  }, [tabId, getTab, markSaved, writeFn]);

  // IME 変換終了後の pending 保存を処理
  const flushPendingSave = useCallback(() => {
    if (pendingSaveRef.current) {
      scheduleSave();
    }
  }, [scheduleSave]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { scheduleSave, saveNow, flushPendingSave };
}
