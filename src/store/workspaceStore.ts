/**
 * ワークスペース状態管理ストア (Zustand)
 *
 * file-workspace-design.md §2, §3, §8 に準拠:
 * - フォルダを開く / 閉じる
 * - ファイルツリー構築・展開/折りたたみ
 * - ファイル作成・削除・リネーム
 *
 * Phase 7 追加:
 * - ファイルのドラッグ移動 (moveFile)
 * - 最近使ったワークスペース履歴 (recentWorkspaces)
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

/** 最近使ったワークスペースのエントリ */
export interface RecentWorkspaceEntry {
  path: string;
  name: string;
  lastOpened: number; // Unix timestamp (ms)
}

const MAX_RECENT_WORKSPACES = 10;
const RECENT_WORKSPACES_KEY = 'recent-workspaces';

async function getStore() {
  const { load } = await import('@tauri-apps/plugin-store');
  return load('app-state.json');
}

interface WorkspaceStore {
  root: string | null;
  tree: FileNode[];
  isLoading: boolean;
  recentWorkspaces: RecentWorkspaceEntry[];

  openWorkspace: (dirPath: string) => Promise<void>;
  closeWorkspace: () => void;
  refreshTree: () => Promise<void>;
  toggleNode: (path: string) => void;
  createFile: (parentDir: string, name: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newName: string) => Promise<void>;
  /** ファイルを別ディレクトリへ移動する（Phase 7: ドラッグ移動） */
  moveFile: (sourcePath: string, targetDir: string) => Promise<string>;
  /** 最近使ったワークスペース一覧を読み込む */
  loadRecentWorkspaces: () => Promise<void>;
  /** 最近使ったワークスペース一覧からエントリを削除する */
  removeRecentWorkspace: (path: string) => Promise<void>;
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

/** 展開状態のパス集合を再帰収集する */
function collectExpandedPaths(nodes: FileNode[]): Set<string> {
  const set = new Set<string>();
  function walk(ns: FileNode[]) {
    for (const n of ns) {
      if (n.isExpanded) set.add(n.path);
      if (n.children) walk(n.children);
    }
  }
  walk(nodes);
  return set;
}

/** 展開状態を復元する */
function restoreExpandedState(nodes: FileNode[], expanded: Set<string>): FileNode[] {
  return nodes.map((node) => ({
    ...node,
    isExpanded: expanded.has(node.path) || false,
    children: node.children ? restoreExpandedState(node.children, expanded) : undefined,
  }));
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  root: null,
  tree: [],
  isLoading: false,
  recentWorkspaces: [],

  openWorkspace: async (dirPath) => {
    set({ root: dirPath, isLoading: true });
    try {
      const files = await listWorkspaceFiles(dirPath);
      set({ tree: sortTree(files), isLoading: false });
    } catch {
      set({ tree: [], isLoading: false });
    }

    // 最近使ったワークスペースに追加
    const name = dirPath.split(/[/\\]/).pop() ?? dirPath;
    try {
      const store = await getStore();
      const raw = (await store.get<RecentWorkspaceEntry[]>(RECENT_WORKSPACES_KEY)) ?? [];
      const filtered = raw.filter((e) => e.path !== dirPath);
      const updated: RecentWorkspaceEntry[] = [
        { path: dirPath, name, lastOpened: Date.now() },
        ...filtered,
      ].slice(0, MAX_RECENT_WORKSPACES);
      await store.set(RECENT_WORKSPACES_KEY, updated);
      await store.save();
      set({ recentWorkspaces: updated });
    } catch {
      // Tauri 外ではスキップ
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
      const expanded = collectExpandedPaths(get().tree);
      set({ tree: restoreExpandedState(sortTree(files), expanded), isLoading: false });
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

  moveFile: async (sourcePath, targetDir) => {
    const fileName = sourcePath.split(/[/\\]/).pop() ?? '';
    const newPath = `${targetDir}/${fileName}`;
    await invoke('rename_file', { oldPath: sourcePath, newPath });
    await get().refreshTree();
    return newPath;
  },

  loadRecentWorkspaces: async () => {
    try {
      const store = await getStore();
      const raw = (await store.get<RecentWorkspaceEntry[]>(RECENT_WORKSPACES_KEY)) ?? [];
      set({ recentWorkspaces: raw });
    } catch {
      // Tauri 外ではスキップ
    }
  },

  removeRecentWorkspace: async (path) => {
    try {
      const store = await getStore();
      const raw = (await store.get<RecentWorkspaceEntry[]>(RECENT_WORKSPACES_KEY)) ?? [];
      const updated = raw.filter((e) => e.path !== path);
      await store.set(RECENT_WORKSPACES_KEY, updated);
      await store.save();
      set({ recentWorkspaces: updated });
    } catch {
      set((s) => ({ recentWorkspaces: s.recentWorkspaces.filter((e) => e.path !== path) }));
    }
  },
}));
