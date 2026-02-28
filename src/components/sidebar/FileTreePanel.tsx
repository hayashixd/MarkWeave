/**
 * ファイルツリーパネル（Phase 3）
 *
 * file-workspace-design.md §3 に準拠:
 * - ワークスペース内のファイルをツリー表示
 * - クリックでファイルを開く
 * - 右クリックでコンテキストメニュー（新規・リネーム・削除）
 * - フォルダの展開/折りたたみ
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { FileNode } from '../../store/workspaceStore';
import { useTabStore } from '../../store/tabStore';
import { readFile } from '../../lib/tauri-commands';

interface FileTreePanelProps {
  onOpenFolder: () => void;
}

export function FileTreePanel({ onOpenFolder }: FileTreePanelProps) {
  const { root, tree, isLoading, refreshTree, closeWorkspace } = useWorkspaceStore();

  if (!root) {
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
      </div>
    );
  }

  const rootName = root.split(/[/\\]/).pop() ?? root;

  return (
    <div className="file-tree-panel flex flex-col h-full">
      {/* ヘッダー */}
      <div className="file-tree-panel__header">
        <span className="file-tree-panel__root-name" title={root}>
          {rootName}
        </span>
        <div className="flex items-center gap-1">
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
              <FileTreeNodeItem key={node.path} node={node} depth={0} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * ファイルツリーノード（再帰コンポーネント）
 */
function FileTreeNodeItem({ node, depth }: { node: FileNode; depth: number }) {
  const { toggleNode, createFile, deleteFile, renameFile } = useWorkspaceStore();
  const { addTab, tabs } = useTabStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [inputValue, setInputValue] = useState('');
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
        // 拡張子を除いた部分を選択
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
      // Tauri 外ではモック
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
    // ディレクトリの場合は展開する
    if (node.type === 'directory' && !node.isExpanded) {
      toggleNode(node.path);
    }
  }, [node, toggleNode]);

  const handleInputSubmit = useCallback(() => {
    if (!inputValue.trim()) {
      setIsRenaming(false);
      setIsCreating(false);
      return;
    }

    if (isRenaming) {
      renameFile(node.path, inputValue.trim());
      setIsRenaming(false);
    } else if (isCreating) {
      const dir = node.type === 'directory' ? node.path : node.path.replace(/[/\\][^/\\]*$/, '');
      const name = inputValue.trim().endsWith('.md') ? inputValue.trim() : `${inputValue.trim()}.md`;
      createFile(dir, name);
      setIsCreating(false);
    }
  }, [inputValue, isRenaming, isCreating, node, renameFile, createFile]);

  const isOpen = tabs.some((t) => t.filePath === node.path);

  return (
    <li>
      <div
        className={`file-tree-node${isOpen ? ' file-tree-node--open' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
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
              if (e.key === 'Enter') handleInputSubmit();
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
          <button type="button" className="file-tree-context-menu__item file-tree-context-menu__item--danger" onClick={handleDelete}>
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
              if (e.key === 'Enter') handleInputSubmit();
              if (e.key === 'Escape') { setIsCreating(false); }
            }}
          />
        </div>
      )}

      {/* 子ノード */}
      {node.type === 'directory' && node.isExpanded && node.children && (
        <ul className="file-tree-panel__list">
          {node.children.map((child) => (
            <FileTreeNodeItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
