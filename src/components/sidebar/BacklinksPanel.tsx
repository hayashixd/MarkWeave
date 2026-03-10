/**
 * バックリンクパネル
 *
 * wikilinks-backlinks-design.md §4, §5, §6 に準拠。
 *
 * - ワークスペースモード: SQLite インデックスからワークスペース全体のバックリンクを取得
 * - タブのみモード: 現在開いているタブのみスキャン（フォールバック）
 *
 * ペルソナ対応:
 * - 知識管理者: どのノートから参照されているかを即座に把握し、ナレッジグラフを手動で辿れる
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '../../store/tabStore';
import { useOpenFileAsTab } from '../../hooks/useOpenFileAsTab';

interface BacklinksPanelProps {
  /** 現在アクティブなタブのファイルパス（バックリンク検出のターゲット） */
  currentFilePath: string | null;
  currentFileName: string;
  /** ワークスペースのルートパス（null ならタブのみモード） */
  workspaceRoot?: string | null;
}

interface BacklinkEntry {
  tabId?: string;
  fileName: string;
  filePath: string | null;
  /** マッチした周辺テキスト（前後 60 文字） */
  contexts: string[];
}

/** Tauri get_backlinks コマンドの返却型 */
interface BacklinkResultFromDb {
  sourcePath: string;
  sourceName: string;
  sourceTitle: string | null;
  contexts: string[];
}

/** `[[target]]` / `[[target|label]]` にマッチする正規表現 */
function buildWikilinkPattern(target: string): RegExp {
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\[\\[${escaped}(?:\\|[^\\]]+)?\\]\\]`, 'gi');
}

/** ファイル名から拡張子を除いたベース名を返す */
function baseName(fileName: string): string {
  return fileName.replace(/\.(md|html|txt)$/i, '');
}

/** コンテンツ内のマッチ箇所の前後テキストを抽出（最大 3 箇所） */
function extractContexts(content: string, pattern: RegExp, maxCount = 3): string[] {
  const contexts: string[] = [];
  let match: RegExpExecArray | null;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(content)) !== null && contexts.length < maxCount) {
    const start = Math.max(0, match.index - 60);
    const end = Math.min(content.length, match.index + match[0].length + 60);
    let snippet = content.slice(start, end).replace(/\n+/g, ' ').trim();
    if (start > 0) snippet = '…' + snippet;
    if (end < content.length) snippet = snippet + '…';
    contexts.push(snippet);
    // RegExp の lastIndex を進める（グローバルフラグ必須）
  }
  return contexts;
}

export function BacklinksPanel({ currentFilePath, currentFileName, workspaceRoot }: BacklinksPanelProps) {
  const { tabs } = useTabStore();
  const openFileAsTab = useOpenFileAsTab();

  const targetBase = baseName(currentFileName);
  const isWorkspaceMode = !!(workspaceRoot && currentFilePath);

  // ワークスペースモード: DB からバックリンクを取得
  const [dbBacklinks, setDbBacklinks] = useState<BacklinkEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBacklinks = useCallback(async () => {
    if (!isWorkspaceMode || !currentFilePath || !workspaceRoot) return;

    setIsLoading(true);
    try {
      // currentFilePath からワークスペースルートの相対パスを計算
      let relPath = currentFilePath;
      if (currentFilePath.startsWith(workspaceRoot)) {
        relPath = currentFilePath.slice(workspaceRoot.length);
        // 先頭の / or \ を除去
        relPath = relPath.replace(/^[/\\]/, '');
      }

      const results = await invoke<BacklinkResultFromDb[]>('get_backlinks', {
        filePath: relPath,
        workspaceRoot,
      });

      setDbBacklinks(
        results.map((r) => ({
          fileName: r.sourceName + '.md',
          filePath: workspaceRoot + '/' + r.sourcePath,
          contexts: r.contexts,
        })),
      );
    } catch (e) {
      console.warn('バックリンク取得エラー:', e);
      setDbBacklinks([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentFilePath, workspaceRoot, isWorkspaceMode]);

  useEffect(() => {
    if (isWorkspaceMode) {
      fetchBacklinks();
    }
  }, [isWorkspaceMode, fetchBacklinks]);

  // ファイル保存時にバックリンクを再取得
  useEffect(() => {
    if (!isWorkspaceMode) return;
    const handler = () => {
      fetchBacklinks();
    };
    window.addEventListener('wikilink-index-updated', handler);
    return () => window.removeEventListener('wikilink-index-updated', handler);
  }, [isWorkspaceMode, fetchBacklinks]);

  // タブのみモード: フォールバック（従来のロジック）
  const tabBacklinks = useMemo<BacklinkEntry[]>(() => {
    if (isWorkspaceMode || !targetBase) return [];

    const pattern = buildWikilinkPattern(targetBase);

    return tabs
      .filter((tab) => {
        // 自分自身は除く
        if (currentFilePath && tab.filePath === currentFilePath) return false;
        if (!currentFilePath && tab.fileName === currentFileName) return false;
        return true;
      })
      .flatMap((tab) => {
        pattern.lastIndex = 0;
        if (!pattern.test(tab.content)) return [];
        const contexts = extractContexts(tab.content, pattern);
        return [{ tabId: tab.id, fileName: tab.fileName, filePath: tab.filePath, contexts }];
      });
  }, [tabs, targetBase, currentFilePath, currentFileName, isWorkspaceMode]);

  const backlinks = isWorkspaceMode ? dbBacklinks : tabBacklinks;

  const handleOpenTab = (entry: BacklinkEntry) => {
    if (entry.filePath) {
      openFileAsTab(entry.filePath);
    }
  };

  if (!targetBase) {
    return (
      <div className="p-3 text-sm text-gray-400">
        ファイルを開くとバックリンクが表示されます
      </div>
    );
  }

  return (
    <div className="backlinks-panel">
      <div className="backlinks-panel__header">
        <span className="backlinks-panel__title">[[{targetBase}]] へのリンク</span>
        <span className="backlinks-panel__count">
          {isLoading ? '…' : `${backlinks.length}件`}
        </span>
      </div>

      {isLoading ? (
        <div className="backlinks-panel__empty">
          <p>バックリンクを検索中…</p>
        </div>
      ) : backlinks.length === 0 ? (
        <div className="backlinks-panel__empty">
          <p>このファイルへのリンクは見つかりませんでした。</p>
          <p className="backlinks-panel__empty-hint">
            他のファイルで <code>[[{targetBase}]]</code> と書くとここに表示されます。
          </p>
        </div>
      ) : (
        <ul className="backlinks-panel__list">
          {backlinks.map((entry, idx) => (
            <li key={entry.filePath ?? entry.tabId ?? idx} className="backlinks-panel__item">
              <button
                type="button"
                className="backlinks-panel__item-name"
                onClick={() => handleOpenTab(entry)}
                title={entry.filePath ?? entry.fileName}
              >
                {entry.fileName}
              </button>
              {entry.contexts.map((ctx, i) => (
                <p key={i} className="backlinks-panel__context">
                  {ctx}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}

      <div className="backlinks-panel__footer">
        {isWorkspaceMode
          ? '※ ワークスペース全体をスキャン'
          : '※ 開いているタブのみをスキャン'}
      </div>
    </div>
  );
}
