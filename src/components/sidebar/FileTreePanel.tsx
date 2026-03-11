/**
 * ファイルツリーパネル（Phase 3 + Phase 7）
 *
 * file-workspace-design.md §3, §5.3, §6 に準拠:
 * - ワークスペース内のファイルをツリー表示
 * - クリックでファイルを開く
 * - 右クリックでコンテキストメニュー（新規・リネーム・削除）
 * - フォルダの展開/折りたたみ
 *
 * Phase 7 追加:
 * - ファイルのドラッグ&ドロップによる移動
 * - リネーム・移動後の Markdown リンク自動更新（確認ダイアログ付き）
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { FileNode, RecentWorkspaceEntry } from '../../store/workspaceStore';
import { useTabStore } from '../../store/tabStore';
import { readFile } from '../../lib/tauri-commands';
import { updateMarkdownLinksInWorkspace, updateWikilinksInWorkspace, undoWikilinkUpdate } from '../../lib/link-updater';
import { useToastStore } from '../../store/toastStore';
import { useMetadataStore } from '../../features/metadata/metadataStore';
import { logger } from '../../utils/logger';

interface FileTreePanelProps {
  onOpenFolder: () => void;
}

export function FileTreePanel({ onOpenFolder }: FileTreePanelProps) {
  const {
    root, tree, isLoading, refreshTree, closeWorkspace,
    recentWorkspaces, loadRecentWorkspaces, openWorkspace, removeRecentWorkspace,
  } = useWorkspaceStore();
  const [recentMenuOpen, setRecentMenuOpen] = useState(false);
  const recentMenuRef = useRef<HTMLDivElement>(null);

  // 最近使ったワークスペース一覧を読み込む
  useEffect(() => {
    loadRecentWorkspaces();
  }, [loadRecentWorkspaces]);

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!recentMenuOpen) return;
    const handler = (e: PointerEvent) => {
      if (recentMenuRef.current && !recentMenuRef.current.contains(e.target as Node)) {
        setRecentMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [recentMenuOpen]);

  const handleSwitchWorkspace = useCallback(async (entry: RecentWorkspaceEntry) => {
    setRecentMenuOpen(false);
    await openWorkspace(entry.path);
  }, [openWorkspace]);

  if (!root) {
    // ワークスペース未選択時: 最近使ったワークスペース一覧を表示
    const recent = recentWorkspaces.filter(Boolean);
    return (
      <div className="p-3 text-sm text-gray-400">
        <p>フォルダを開いてください</p>
        <p className="text-xs mt-2">
          <button
            type="button"
            onClick={onOpenFolder}
            className="text-blue-500 hover:text-blue-600 underline"
          >
            Ctrl+Shift+O
          </button>
        </p>
        {recent.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              最近使ったワークスペース
            </p>
            <ul className="space-y-1">
              {recent.map((entry) => (
                <RecentWorkspaceItem
                  key={entry.path}
                  entry={entry}
                  onOpen={handleSwitchWorkspace}
                  onRemove={removeRecentWorkspace}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const rootName = root.split(/[/\\]/).pop() ?? root;
  // 現在と異なるワークスペース履歴
  const otherRecent = recentWorkspaces.filter((e) => e.path !== root);

  return (
    <div className="file-tree-panel flex flex-col h-full">
      {/* ヘッダー */}
      <div className="file-tree-panel__header">
        {/* ワークスペース名 + 切り替えドロップダウン */}
        <div className="relative flex-1 min-w-0">
          <button
            type="button"
            className="file-tree-panel__root-name flex items-center gap-1 max-w-full truncate hover:text-gray-700 transition-colors"
            title={root}
            onClick={() => otherRecent.length > 0 && setRecentMenuOpen((v) => !v)}
          >
            <span className="truncate">{rootName}</span>
            {otherRecent.length > 0 && (
              <span className="text-gray-400 text-xs flex-shrink-0">▾</span>
            )}
          </button>

          {/* ワークスペース切り替えドロップダウン */}
          {recentMenuOpen && otherRecent.length > 0 && (
            <div
              ref={recentMenuRef}
              className="absolute top-full left-0 z-50 bg-white border border-gray-200 rounded shadow-lg py-1 min-w-48 max-w-64"
            >
              <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                最近使ったワークスペース
              </div>
              {otherRecent.map((entry) => (
                <RecentWorkspaceItem
                  key={entry.path}
                  entry={entry}
                  onOpen={handleSwitchWorkspace}
                  onRemove={removeRecentWorkspace}
                  compact
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            className="file-tree-panel__action-btn"
            onClick={() => refreshTree()}
            title="更新"
          >
            ↻
          </button>
          <button
            type="button"
            className="file-tree-panel__action-btn"
            onClick={closeWorkspace}
            title="ワークスペースを閉じる"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ツリー */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 text-xs text-gray-400">読み込み中...</div>
        ) : tree.length === 0 ? (
          <div className="p-3 text-xs text-gray-400">ファイルがありません</div>
        ) : (
          <ul className="file-tree-panel__list">
            {tree.map((node) => (
              <FileTreeNodeItem key={node.path} node={node} depth={0} workspaceRoot={root} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * ファイルツリーノード（再帰コンポーネント）
 *
 * Phase 7: ドラッグ移動に対応。
 * - ファイルノードをドラッグして別フォルダへ移動
 * - ディレクトリノードがドロップターゲットになる
 */
function FileTreeNodeItem({
  node,
  depth,
  workspaceRoot,
}: {
  node: FileNode;
  depth: number;
  workspaceRoot: string;
}) {
  const { toggleNode, createFile, deleteFile, renameFile, moveFile } = useWorkspaceStore();
  const rebuildMetadataIndex = useMetadataStore((s) => s.rebuildIndex);
  const { addTab, tabs } = useTabStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  // コンテキストメニュー外クリックで閉じる
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: PointerEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [contextMenu]);

  // インライン入力にフォーカス
  useEffect(() => {
    if ((isRenaming || isCreating) && inputRef.current) {
      inputRef.current.focus();
      if (isRenaming) {
        const dotIndex = inputValue.lastIndexOf('.');
        if (dotIndex > 0) {
          inputRef.current.setSelectionRange(0, dotIndex);
        } else {
          inputRef.current.select();
        }
      }
    }
  }, [isRenaming, isCreating, inputValue]);

  const handleClick = useCallback(async () => {
    if (node.type === 'directory') {
      toggleNode(node.path);
      return;
    }

    // ファイルを開く: 既にタブにある場合はフォーカス
    const existing = tabs.find((t) => t.filePath === node.path);
    if (existing) {
      useTabStore.getState().setActiveTab(existing.id);
      return;
    }

    try {
      const content = await readFile(node.path);
      addTab({
        filePath: node.path,
        fileName: node.name,
        content,
        savedContent: content,
      });
    } catch {
      addTab({
        filePath: node.path,
        fileName: node.name,
        content: '',
        savedContent: '',
      });
    }
  }, [node, toggleNode, tabs, addTab]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleRename = useCallback(() => {
    setContextMenu(null);
    setInputValue(node.name);
    setIsRenaming(true);
  }, [node.name]);

  const handleDelete = useCallback(() => {
    setContextMenu(null);
    const confirmed = window.confirm(`"${node.name}" を削除しますか？`);
    if (confirmed) {
      deleteFile(node.path);
    }
  }, [node, deleteFile]);

  const handleNewFile = useCallback(() => {
    setContextMenu(null);
    setInputValue('');
    setIsCreating(true);
    if (node.type === 'directory' && !node.isExpanded) {
      toggleNode(node.path);
    }
  }, [node, toggleNode]);

  const handleInputSubmit = useCallback(async () => {
    if (!inputValue.trim()) {
      setIsRenaming(false);
      setIsCreating(false);
      return;
    }

    if (isRenaming) {
      const oldPath = node.path;
      const newName = inputValue.trim();
      await renameFile(oldPath, newName);
      setIsRenaming(false);

      // リネーム後にリンク更新を提案（ファイルのみ）
      if (node.type === 'file' && (newName.endsWith('.md') || oldPath.endsWith('.md'))) {
        const parts = oldPath.split(/[/\\]/);
        parts.pop();
        const newPath = [...parts, newName].join('/');
        await offerLinkUpdate(oldPath, newPath, workspaceRoot, rebuildMetadataIndex);
      }
    } else if (isCreating) {
      const dir = node.type === 'directory'
        ? node.path
        : node.path.replace(/[/\\][^/\\]*$/, '');
      const name = inputValue.trim().endsWith('.md')
        ? inputValue.trim()
        : `${inputValue.trim()}.md`;
      createFile(dir, name);
      setIsCreating(false);
    }
  }, [inputValue, isRenaming, isCreating, node, renameFile, createFile, workspaceRoot, rebuildMetadataIndex]);

  // ─── ドラッグ移動ハンドラ (Phase 7) ────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (node.type === 'directory') return;
    e.dataTransfer.setData('text/file-path', node.path);
    e.dataTransfer.effectAllowed = 'move';
  }, [node]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (node.type !== 'directory') return;
    if (!e.dataTransfer.types.includes('text/file-path')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, [node.type]);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    setIsDragOver(false);
    if (node.type !== 'directory') return;
    e.preventDefault();
    const sourcePath = e.dataTransfer.getData('text/file-path');
    if (!sourcePath || sourcePath === node.path) return;

    // 同じディレクトリへのドロップは無視
    const sourceDir = sourcePath.replace(/[/\\][^/\\]*$/, '');
    if (sourceDir === node.path) return;

    const fileName = sourcePath.split(/[/\\]/).pop() ?? '';
    const confirmed = window.confirm(
      `"${fileName}" を "${node.name}" フォルダに移動しますか？`
    );
    if (!confirmed) return;

    try {
      const newPath = await moveFile(sourcePath, node.path);

      // 移動後にリンク更新を提案
      if (sourcePath.endsWith('.md')) {
        await offerLinkUpdate(sourcePath, newPath, workspaceRoot, rebuildMetadataIndex);
      }

      // 開いているタブのパスを更新
      useTabStore.getState().updateFilePath?.(sourcePath, newPath);
    } catch (err) {
      useToastStore.getState().show(
        'error',
        `移動に失敗しました: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, [node, moveFile, workspaceRoot, rebuildMetadataIndex]);

  const isOpen = tabs.some((t) => t.filePath === node.path);

  return (
    <li>
      <div
        className={`file-tree-node${isOpen ? ' file-tree-node--open' : ''}${isDragOver ? ' file-tree-node--drag-over' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable={node.type === 'file'}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="treeitem"
        aria-expanded={node.type === 'directory' ? node.isExpanded : undefined}
      >
        {node.type === 'directory' ? (
          <span className="file-tree-node__icon">
            {node.isExpanded ? '▾' : '▸'}
          </span>
        ) : (
          <span className="file-tree-node__icon file-tree-node__icon--file">
            📄
          </span>
        )}

        {isRenaming ? (
          <input
            ref={inputRef}
            className="file-tree-node__input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleInputSubmit}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === 'Enter') { void handleInputSubmit(); }
              if (e.key === 'Escape') { setIsRenaming(false); }
            }}
          />
        ) : (
          <span className="file-tree-node__name" title={node.path}>
            {node.type === 'directory' ? `📁 ${node.name}` : node.name}
          </span>
        )}
      </div>

      {/* コンテキストメニュー */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="file-tree-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button type="button" className="file-tree-context-menu__item" onClick={handleNewFile}>
            新規ファイル
          </button>
          <button type="button" className="file-tree-context-menu__item" onClick={handleRename}>
            名前を変更
          </button>
          <div className="file-tree-context-menu__divider" />
          <button
            type="button"
            className="file-tree-context-menu__item file-tree-context-menu__item--danger"
            onClick={handleDelete}
          >
            削除
          </button>
        </div>
      )}

      {/* 新規ファイル入力 */}
      {isCreating && (
        <div style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }} className="file-tree-node__create-row">
          <span className="file-tree-node__icon file-tree-node__icon--file">📄</span>
          <input
            ref={inputRef}
            className="file-tree-node__input"
            value={inputValue}
            placeholder="ファイル名.md"
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleInputSubmit}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === 'Enter') { void handleInputSubmit(); }
              if (e.key === 'Escape') { setIsCreating(false); }
            }}
          />
        </div>
      )}

      {/* 子ノード */}
      {node.type === 'directory' && node.isExpanded && node.children && (
        <ul className="file-tree-panel__list">
          {node.children.map((child) => (
            <FileTreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              workspaceRoot={workspaceRoot}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * リネーム・移動後にワークスペース内の Markdown リンクと Wikiリンクの更新を提案する。
 *
 * file-workspace-design.md §5.3 Phase 7 実装方針に準拠:
 * - 「○個のリンクが壊れる可能性があります。更新しますか？」と確認
 * - 承認後、ワークスペース内の全 .md ファイルをスキャンして相対リンクを更新
 *
 * wikilinks-backlinks-design.md §7 に準拠:
 * - Wikiリンク [[old-name]] → [[new-name]] の一括更新
 * - 更新完了後 Undo 可能なトースト通知
 */
async function offerLinkUpdate(
  oldPath: string,
  newPath: string,
  workspaceRoot: string,
  rebuildMetadataIndex: (workspaceRoot: string) => Promise<unknown>,
) {
  try {
    // Markdown リンクと Wikiリンクの影響ファイル数を同時にチェック
    const [mdResult, wikiResult] = await Promise.all([
      updateMarkdownLinksInWorkspace(oldPath, newPath, workspaceRoot, { dryRun: true }),
      updateWikilinksInWorkspace(oldPath, newPath, workspaceRoot, true),
    ]);

    const totalAffected = mdResult.affectedCount + wikiResult.affectedCount;
    if (totalAffected === 0) return;

    // §7.2: 確認ダイアログ
    const parts: string[] = [];
    if (mdResult.affectedCount > 0) {
      parts.push(`Markdown リンク: ${mdResult.affectedCount} 個のファイル`);
    }
    if (wikiResult.affectedCount > 0) {
      parts.push(`Wikiリンク [[${wikiResult.oldName}]]: ${wikiResult.affectedCount} 個のファイル`);
    }
    const confirmed = window.confirm(
      `${totalAffected} 個のファイルにリンクが含まれています。\n` +
      parts.join('\n') + '\n\n' +
      '新しい名前に更新しますか？'
    );
    if (!confirmed) return;

    // 実行
    const [, wikiActual] = await Promise.all([
      mdResult.affectedCount > 0
        ? updateMarkdownLinksInWorkspace(oldPath, newPath, workspaceRoot, { dryRun: false })
        : Promise.resolve(null),
      wikiResult.affectedCount > 0
        ? updateWikilinksInWorkspace(oldPath, newPath, workspaceRoot, false)
        : Promise.resolve(null),
    ]);

    // §7.2: 更新完了トースト（Undo 可能）
    const toast = useToastStore.getState();
    if (wikiActual) {
      toast.show(
        'info',
        `${totalAffected} 個のファイルのリンクを更新しました`,
        {
          label: '元に戻す',
          onClick: async () => {
            const restored = await undoWikilinkUpdate(wikiActual.undoData);
            toast.show('info', `${restored} 個のファイルのWikiリンクを元に戻しました`);
            try {
              await rebuildMetadataIndex(workspaceRoot);
            } catch (error) {
              logger.error('Failed to rebuild metadata index after wikilink undo', error);
              toast.show('warning', 'リンク復元後のインデックス再構築に失敗しました。再読み込みしてください。');
            }
            window.dispatchEvent(new Event('wikilink-index-updated'));
          },
        },
      );
    } else {
      toast.show('info', `${totalAffected} 個のファイルのリンクを更新しました`);
    }

    if (wikiActual) {
      try {
        await rebuildMetadataIndex(workspaceRoot);
      } catch (error) {
        logger.error('Failed to rebuild metadata index after wikilink rewrite', error);
        toast.show('warning', 'リンク更新後のインデックス再構築に失敗しました。再読み込みしてください。');
      }
    }

    // インデックス更新を通知
    window.dispatchEvent(new Event('wikilink-index-updated'));
  } catch (error) {
    logger.error('Failed to update links after file rename/move', error);
    useToastStore.getState().show('error', 'リンクの更新中にエラーが発生しました');
  }
}
/**
 * 最近使ったワークスペースの1エントリ。
 * compact=true の場合はドロップダウン内の小さい表示。
 */
function RecentWorkspaceItem({
  entry,
  onOpen,
  onRemove,
  compact = false,
}: {
  entry: RecentWorkspaceEntry;
  onOpen: (entry: RecentWorkspaceEntry) => void;
  onRemove: (path: string) => void;
  compact?: boolean;
}) {
  const name = entry.path.split(/[/\\]/).pop() ?? entry.path;
  const dateStr = new Date(entry.lastOpened).toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
  });

  if (compact) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 hover:bg-gray-50 group">
        <button
          type="button"
          className="flex-1 min-w-0 text-left"
          onClick={() => onOpen(entry)}
        >
          <span className="block text-sm text-gray-800 truncate" title={entry.path}>
            {name}
          </span>
          <span className="text-xs text-gray-400 truncate block">{dateStr}</span>
        </button>
        <button
          type="button"
          className="flex-shrink-0 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-1"
          onClick={() => onRemove(entry.path)}
          title="履歴から削除"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <li className="flex items-center gap-1 group">
      <button
        type="button"
        className="flex-1 min-w-0 text-left py-1 hover:text-blue-600 transition-colors"
        onClick={() => onOpen(entry)}
      >
        <span className="block text-xs text-gray-700 truncate" title={entry.path}>
          📁 {name}
        </span>
        <span className="text-xs text-gray-400">{dateStr}</span>
      </button>
      <button
        type="button"
        className="flex-shrink-0 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
        onClick={() => onRemove(entry.path)}
        title="履歴から削除"
      >
        ×
      </button>
    </li>
  );
}
