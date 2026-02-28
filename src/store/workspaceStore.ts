/**
 * ワークスペース状態管理ストア (Zustand)
 *
 * file-workspace-design.md §2, §3, §8 に準拠:
 * - フォルダを開く / 閉じる
 * - ファイルツリー構築・展開/折りたたみ
 * - ファイル作成・削除・リネーム
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  isExpanded?: boolean;
}

interface WorkspaceStore {
  root: string | null;
  tree: FileNode[];
  isLoading: boolean;

  openWorkspace: (dirPath: string) => Promise<void>;
  closeWorkspace: () => void;
  refreshTree: () => Promise<void>;
  toggleNode: (path: string) => void;
  createFile: (parentDir: string, name: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newName: string) => Promise<void>;
}

/**
 * ファイルツリーを Tauri 経由で取得する
 */
async function listWorkspaceFiles(rootPath: string): Promise<FileNode[]> {
  try {
    return await invoke<FileNode[]>('list_workspace_files', {
      rootPath,
      recursive: true,
      extensions: ['.md', '.html', '.txt'],
    });
  } catch {
    // Tauri 外（ブラウザ開発環境）: 空のツリーを返す
    return [];
  }
}

/**
 * フロントエンドでのファイルツリーソート
 * ディレクトリを先、名前の自然順ソート
 */
function sortTree(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  }).map((node) => {
    if (node.children) {
      return { ...node, children: sortTree(node.children) };
    }
    return node;
  });
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  root: null,
  tree: [],
  isLoading: false,

  openWorkspace: async (dirPath) => {
    set({ root: dirPath, isLoading: true });
    try {
      const files = await listWorkspaceFiles(dirPath);
      set({ tree: sortTree(files), isLoading: false });
    } catch {
      set({ tree: [], isLoading: false });
    }
  },

  closeWorkspace: () => {
    set({ root: null, tree: [], isLoading: false });
  },

  refreshTree: async () => {
    const { root } = get();
    if (!root) return;
    set({ isLoading: true });
    try {
      const files = await listWorkspaceFiles(root);
      // 展開状態を保持しながらツリーを更新
      const prevTree = get().tree;
      const expandedPaths = new Set<string>();
      function collectExpanded(nodes: FileNode[]) {
        for (const node of nodes) {
          if (node.isExpanded) expandedPaths.add(node.path);
          if (node.children) collectExpanded(node.children);
        }
      }
      collectExpanded(prevTree);

      function restoreExpanded(nodes: FileNode[]): FileNode[] {
        return nodes.map((node) => ({
          ...node,
          isExpanded: expandedPaths.has(node.path) || false,
          children: node.children ? restoreExpanded(node.children) : undefined,
        }));
      }

      set({ tree: restoreExpanded(sortTree(files)), isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  toggleNode: (path) => {
    set((state) => {
      function toggle(nodes: FileNode[]): FileNode[] {
        return nodes.map((node) => {
          if (node.path === path) {
            return { ...node, isExpanded: !node.isExpanded };
          }
          if (node.children) {
            return { ...node, children: toggle(node.children) };
          }
          return node;
        });
      }
      return { tree: toggle(state.tree) };
    });
  },

  createFile: async (parentDir, name) => {
    const filePath = `${parentDir}/${name}`;
    try {
      await invoke('write_file', { path: filePath, content: '' });
      await get().refreshTree();
    } catch {
      // Tauri 外ではスキップ
    }
  },

  deleteFile: async (path) => {
    try {
      await invoke('move_to_trash', { path });
      await get().refreshTree();
    } catch {
      // move_to_trash が存在しない場合、削除コマンドを試行
      try {
        await invoke('delete_file', { path });
        await get().refreshTree();
      } catch {
        // Tauri 外ではスキップ
      }
    }
  },

  renameFile: async (oldPath, newName) => {
    const parts = oldPath.split(/[/\\]/);
    parts.pop();
    const newPath = [...parts, newName].join('/');
    try {
      await invoke('rename_file', { oldPath, newPath });
      await get().refreshTree();
    } catch {
      // Tauri 外ではスキップ
    }
  },
}));
