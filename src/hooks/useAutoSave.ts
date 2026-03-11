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
import { useToastStore } from '../store/toastStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useMetadataStore } from '../features/metadata/metadataStore';

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
  const isSavingRef = useRef(false);

  const { settings } = useSettingsStore();
  const { getTab, markSaved } = useTabStore();
  const show = useToastStore((s) => s.show);
  const workspaceRoot = useWorkspaceStore((s) => s.root);
  const updateIndex = useMetadataStore((s) => s.updateIndex);

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

    // performance-design.md §5.2: ファイルサイズ連動デバウンス（500〜2000ms）
    const contentLength = tab.content.length;
    const delay = contentLength < 100_000 ? 500
      : contentLength < 1_000_000 ? 1000
      : Math.min(settings.file.autoSaveDelay, 2000);

    timerRef.current = setTimeout(() => {
      const currentTab = getTab(tabId);
      if (!currentTab || !currentTab.isDirty || !currentTab.filePath) return;

      // 既に保存中の場合はスキップ（並行保存を防ぐ）
      if (isSavingRef.current) return;
      isSavingRef.current = true;

      // performance-design.md §5: fire-and-forget パターン（UIスレッドをブロックしない）
      writeFn(currentTab.filePath, currentTab.content)
        .then(() => {
          markSaved(tabId);
          pendingSaveRef.current = false;
          // Wikiリンクインデックス更新（wikilinks-backlinks-design.md §5.2）
          if (workspaceRoot && currentTab.filePath) {
            updateIndex(currentTab.filePath, workspaceRoot).then(() => {
              window.dispatchEvent(new Event('wikilink-index-updated'));
            }).catch(() => { /* インデックス更新失敗は無視 */ });
          }
        })
        .catch((err) => {
          const fileName = currentTab.filePath!.split(/[/\\]/).pop() ?? currentTab.filePath;
          const detail = err instanceof Error ? err.message : String(err);
          show('error', `「${fileName}」の自動保存に失敗しました: ${detail}`);
        })
        .finally(() => {
          isSavingRef.current = false;
        });
    }, delay);
  }, [tabId, settings.file.autoSaveDelay, getTab, markSaved, writeFn, isComposing, show, workspaceRoot, updateIndex]);

  // 即時保存（Ctrl+S 用）
  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const tab = getTab(tabId);
    if (!tab || !tab.filePath) return;

    isSavingRef.current = true;
    try {
      await writeFn(tab.filePath, tab.content);
      markSaved(tabId);
      pendingSaveRef.current = false;
      // Wikiリンクインデックス更新（wikilinks-backlinks-design.md §5.2）
      if (workspaceRoot && tab.filePath) {
        updateIndex(tab.filePath, workspaceRoot).then(() => {
          window.dispatchEvent(new Event('wikilink-index-updated'));
        }).catch(() => { /* インデックス更新失敗は無視 */ });
      }
    } catch (err) {
      const fileName = tab.filePath.split(/[/\\]/).pop() ?? tab.filePath;
      const detail = err instanceof Error ? err.message : String(err);
      show('error', `「${fileName}」の保存に失敗しました: ${detail}`);
    } finally {
      isSavingRef.current = false;
    }
  }, [tabId, getTab, markSaved, writeFn, show, workspaceRoot, updateIndex]);

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
