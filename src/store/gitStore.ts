/**
 * Git 統合ストア。
 *
 * git-integration-design.md に準拠。
 * ワークスペースの Git 状態（ファイルステータス・ブランチ・diff）を管理する。
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

// ────────────────────────────── 型定義 ──────────────────────────────

/** ファイルの Git 状態 */
export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted';
  staged: boolean;
}

/** ブランチ情報とサマリーカウント */
export interface GitBranchInfo {
  branch: string | null;
  modifiedCount: number;
  untrackedCount: number;
  stagedCount: number;
  conflictedCount: number;
}

/** コミット情報 */
export interface GitCommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorEmail: string;
  timestamp: number;
}

/** コミット結果 */
export interface GitCommitResult {
  sha: string;
  shortSha: string;
}

// ──────────────────────────── ストア型 ────────────────────────────

interface GitStoreState {
  /** Git リポジトリかどうか */
  isGitRepo: boolean;
  /** ファイルステータス一覧 */
  fileStatuses: GitFileStatus[];
  /** ブランチ情報 */
  branchInfo: GitBranchInfo | null;
  /** コミット履歴 */
  commitLog: GitCommitInfo[];
  /** ローディング中 */
  isLoading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** ポーリングインターバル ID */
  _pollIntervalId: ReturnType<typeof setInterval> | null;
}

interface GitStoreActions {
  /** Git ステータスを更新する */
  refreshStatus: (repoPath: string) =>Promise<void>;
  /** ブランチ情報を更新する */
  refreshBranchInfo: (repoPath: string) =>Promise<void>;
  /** 全情報を更新する */
  refreshAll: (repoPath: string) =>Promise<void>;
  /** ファイルの diff を取得する */
  getDiff: (repoPath: string, filePath: string, staged?: boolean) =>Promise<string>;
  /** ファイルをステージングする */
  stageFile: (repoPath: string, filePath: string) =>Promise<void>;
  /** ファイルのステージングを解除する */
  unstageFile: (repoPath: string, filePath: string) =>Promise<void>;
  /** コミットを実行する */
  commit: (repoPath: string, message: string) =>Promise<GitCommitResult>;
  /** コミット履歴を取得する */
  refreshLog: (repoPath: string, limit?: number) =>Promise<void>;
  /** ポーリングを開始する */
  startPolling: (repoPath: string, intervalSec: number) =>void;
  /** ポーリングを停止する */
  stopPolling: () =>void;
  /** ストアをリセットする */
  reset: () =>void;
}

type GitStore = GitStoreState & GitStoreActions;

// ─────────────────────────── 初期状態 ───────────────────────────

const initialState: GitStoreState = {
  isGitRepo: false,
  fileStatuses: [],
  branchInfo: null,
  commitLog: [],
  isLoading: false,
  error: null,
  _pollIntervalId: null,
};

// ──────────────────────────── ストア ────────────────────────────

export const useGitStore = create<GitStore>((set, get) => ({
  ...initialState,

  refreshStatus: async (repoPath: string) => {
    try {
      const statuses = await invoke<GitFileStatus[]>('git_status', { repoPath });
      set({ fileStatuses: statuses, isGitRepo: true, error: null });
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err as Error).message;
      // Git リポジトリでない場合はエラーを抑制
      if (msg.includes('リポジトリを開けません')) {
        set({ isGitRepo: false, fileStatuses: [], error: null });
      } else {
        set({ error: msg });
      }
    }
  },

  refreshBranchInfo: async (repoPath: string) => {
    try {
      const info = await invoke<GitBranchInfo>('git_branch_info', { repoPath });
      set({ branchInfo: info, isGitRepo: true, error: null });
    } catch {
      // 非 Git リポジトリの場合は静かに失敗
      set({ branchInfo: null });
    }
  },

  refreshAll: async (repoPath: string) => {
    set({ isLoading: true });
    try {
      await Promise.all([
        get().refreshStatus(repoPath),
        get().refreshBranchInfo(repoPath),
      ]);
    } finally {
      set({ isLoading: false });
    }
  },

  getDiff: async (repoPath: string, filePath: string, staged?: boolean) => {
    return await invoke<string>('git_diff', { repoPath, filePath, staged: staged ?? false });
  },

  stageFile: async (repoPath: string, filePath: string) => {
    await invoke<void>('git_stage', { repoPath, filePath });
    await get().refreshAll(repoPath);
  },

  unstageFile: async (repoPath: string, filePath: string) => {
    await invoke<void>('git_unstage', { repoPath, filePath });
    await get().refreshAll(repoPath);
  },

  commit: async (repoPath: string, message: string) => {
    const result = await invoke<GitCommitResult>('git_commit', { repoPath, message });
    await get().refreshAll(repoPath);
    return result;
  },

  refreshLog: async (repoPath: string, limit?: number) => {
    try {
      const log = await invoke<GitCommitInfo[]>('git_log', { repoPath, limit: limit ?? 50 });
      set({ commitLog: log });
    } catch {
      set({ commitLog: [] });
    }
  },

  startPolling: (repoPath: string, intervalSec: number) => {
    const { _pollIntervalId } = get();
    if (_pollIntervalId) {
      clearInterval(_pollIntervalId);
    }
    if (intervalSec <= 0) return;

    const id = setInterval(() => {
      get().refreshAll(repoPath);
    }, intervalSec * 1000);
    set({ _pollIntervalId: id });
  },

  stopPolling: () => {
    const { _pollIntervalId } = get();
    if (_pollIntervalId) {
      clearInterval(_pollIntervalId);
      set({ _pollIntervalId: null });
    }
  },

  reset: () => {
    get().stopPolling();
    set(initialState);
  },
}));
