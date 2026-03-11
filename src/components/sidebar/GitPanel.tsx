/**
 * Git パネルコンポーネント（サイドバー）
 *
 * git-integration-design.md §6 に準拠:
 * - ブランチ名表示
 * - コミットメッセージ入力 + コミット実行
 * - ステージング済み / 変更 / 未追跡ファイルの一覧
 * - ファイルごとのステージング / アンステージ操作
 * - diff 表示ポップアップ
 */

import { useState, useEffect, useCallback } from 'react';
import { useGitStore } from '../../store/gitStore';
import type { GitFileStatus } from '../../store/gitStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useToastStore } from '../../store/toastStore';

// ──────────────────────── Diff ビューア ────────────────────────

function DiffViewer({ diff, onClose }: { diff: string; onClose: () => void }) {
  return (
    <div className="border border-gray-300 rounded bg-white shadow-lg p-2 text-xs font-mono max-h-60 overflow-auto">
      <div className="flex justify-between items-center mb-1">
        <span className="font-semibold text-gray-600">Diff</span>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-all">
        {diff.split('\n').map((line, i) => {
          let color = 'text-gray-700';
          if (line.startsWith('+')) color = 'text-green-700 bg-green-50';
          else if (line.startsWith('-')) color = 'text-red-700 bg-red-50';
          return (
            <div key={i} className={color}>
              {line}
            </div>
          );
        })}
      </pre>
    </div>
  );
}

// ────────────────────── ファイルリスト項目 ──────────────────────

interface FileItemProps {
  file: GitFileStatus;
  repoPath: string;
  onStage: (path: string) => void;
  onUnstage: (path: string) => void;
}

function FileItem({ file, repoPath, onStage, onUnstage }: FileItemProps) {
  const [showDiff, setShowDiff] = useState(false);
  const [diffText, setDiffText] = useState('');
  const getDiff = useGitStore((s) => s.getDiff);

  const handleShowDiff = useCallback(async () => {
    if (showDiff) {
      setShowDiff(false);
      return;
    }
    try {
      const text = await getDiff(repoPath, file.path, file.staged);
      setDiffText(text || '(差分なし)');
      setShowDiff(true);
    } catch {
      setDiffText('(diff の取得に失敗しました)');
      setShowDiff(true);
    }
  }, [showDiff, getDiff, repoPath, file.path, file.staged]);

  const badgeColor: Record<string, string> = {
    modified: 'text-orange-600',
    added: 'text-green-600',
    deleted: 'text-red-600',
    renamed: 'text-orange-600',
    untracked: 'text-green-600',
    conflicted: 'text-red-600 font-bold',
  };

  const badgeLabel: Record<string, string> = {
    modified: 'M',
    added: 'A',
    deleted: 'D',
    renamed: 'R',
    untracked: 'U',
    conflicted: 'C',
  };

  return (
    <div className="py-0.5">
      <div className="flex items-center gap-1 text-xs group">
        <span className={`w-4 text-center font-mono ${badgeColor[file.status] ?? 'text-gray-500'}`}>
          {badgeLabel[file.status] ?? '?'}
        </span>
        <span className="flex-1 truncate text-gray-700" title={file.path}>
          {file.path}
        </span>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {file.staged ? (
            <button
              type="button"
              onClick={() => onUnstage(file.path)}
              className="px-1 text-gray-500 hover:text-red-600"
              title="アンステージ"
              aria-label={`${file.path} をアンステージ`}
            >
              −
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onStage(file.path)}
              className="px-1 text-gray-500 hover:text-green-600"
              title="ステージ"
              aria-label={`${file.path} をステージ`}
            >
              +
            </button>
          )}
          <button
            type="button"
            onClick={handleShowDiff}
            className="px-1 text-gray-500 hover:text-blue-600"
            title="差分を表示"
            aria-label={`${file.path} の差分を表示`}
          >
            Δ
          </button>
        </div>
      </div>
      {showDiff && <DiffViewer diff={diffText} onClose={() => setShowDiff(false)} />}
    </div>
  );
}

// ──────────────────────── メインパネル ────────────────────────

interface GitPanelProps {
  workspaceRoot?: string | null;
}

export function GitPanel({ workspaceRoot }: GitPanelProps) {
  const gitEnabled = useSettingsStore((s) => s.settings.git.enabled);
  const isGitRepo = useGitStore((s) => s.isGitRepo);
  const fileStatuses = useGitStore((s) => s.fileStatuses);
  const branchInfo = useGitStore((s) => s.branchInfo);
  const isLoading = useGitStore((s) => s.isLoading);
  const refreshAll = useGitStore((s) => s.refreshAll);
  const stageFile = useGitStore((s) => s.stageFile);
  const unstageFile = useGitStore((s) => s.unstageFile);
  const commitAction = useGitStore((s) => s.commit);
  const refreshLog = useGitStore((s) => s.refreshLog);
  const commitLog = useGitStore((s) => s.commitLog);
  const showToast = useToastStore((s) => s.show);

  const wsRoot = workspaceRoot ?? useWorkspaceStore((s) => s.root);

  const [commitMessage, setCommitMessage] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // 初回読み込み
  useEffect(() => {
    if (wsRoot && gitEnabled) {
      refreshAll(wsRoot);
    }
  }, [wsRoot, gitEnabled, refreshAll]);

  const handleRefresh = useCallback(() => {
    if (wsRoot) refreshAll(wsRoot);
  }, [wsRoot, refreshAll]);

  const handleStage = useCallback(
    (filePath: string) => {
      if (wsRoot) stageFile(wsRoot, filePath);
    },
    [wsRoot, stageFile],
  );

  const handleUnstage = useCallback(
    (filePath: string) => {
      if (wsRoot) unstageFile(wsRoot, filePath);
    },
    [wsRoot, unstageFile],
  );

  const handleCommit = useCallback(
    async (stageAll: boolean) => {
      if (!wsRoot) return;
      if (commitMessage.trim() === '') {
        showToast('warning', 'コミットメッセージを入力してください');
        return;
      }
      try {
        if (stageAll) {
          // すべての変更をステージング
          const unstaged = fileStatuses.filter((f) => !f.staged);
          for (const f of unstaged) {
            await stageFile(wsRoot, f.path);
          }
        }
        const result = await commitAction(wsRoot, commitMessage.trim());
        setCommitMessage('');
        showToast('success', `コミット完了: ${result.shortSha}`);
      } catch (err) {
        const msg = typeof err === 'string' ? err : (err as Error).message;
        showToast('error', `コミット失敗: ${msg}`);
      }
    },
    [wsRoot, commitMessage, fileStatuses, stageFile, commitAction, showToast],
  );

  const handleShowHistory = useCallback(async () => {
    if (!showHistory && wsRoot) {
      await refreshLog(wsRoot);
    }
    setShowHistory(!showHistory);
  }, [showHistory, wsRoot, refreshLog]);

  // ─── 非 Git / 無効時 ───

  if (!gitEnabled) {
    return (
      <div className="p-3 text-xs text-gray-500">
        Git 統合は無効です。設定 → Git で有効化できます。
      </div>
    );
  }

  if (!wsRoot) {
    return (
      <div className="p-3 text-xs text-gray-500">
        ワークスペースを開いてください。
      </div>
    );
  }

  if (!isGitRepo) {
    return (
      <div className="p-3 text-xs text-gray-500">
        このワークスペースは Git リポジトリではありません。
      </div>
    );
  }

  // ─── カテゴリ分け ───

  const staged = fileStatuses.filter((f) => f.staged);
  const modified = fileStatuses.filter((f) => !f.staged && f.status !== 'untracked');
  const untracked = fileStatuses.filter((f) => !f.staged && f.status === 'untracked');

  return (
    <div className="git-panel flex flex-col h-full text-sm">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-700">Git</span>
          {branchInfo?.branch && (
            <span className="text-xs text-gray-500 font-mono">⎇ {branchInfo.branch}</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="text-gray-400 hover:text-gray-600 text-xs"
          title="更新"
          aria-label="Git ステータスを更新"
          disabled={isLoading}
        >
          🔄
        </button>
      </div>

      {/* コミットメッセージ */}
      <div className="px-3 py-2 border-b border-gray-200">
        <textarea
          className="w-full border border-gray-300 rounded px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="コミットメッセージ"
          rows={2}
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleCommit(false);
            }
          }}
        />
        <div className="flex gap-1 mt-1">
          <button
            type="button"
            onClick={() => handleCommit(false)}
            className="flex-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            disabled={staged.length === 0 || commitMessage.trim() === ''}
            title="ステージング済みファイルをコミット (Ctrl+Enter)"
          >
            コミット
          </button>
          <button
            type="button"
            onClick={() => handleCommit(true)}
            className="flex-1 px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
            disabled={fileStatuses.length === 0 || commitMessage.trim() === ''}
            title="すべてステージング + コミット"
          >
            全ステージ+コミット
          </button>
        </div>
      </div>

      {/* ファイルリスト */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* ステージング済み */}
        {staged.length > 0 && (
          <div className="px-3 py-1">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-600 mb-0.5">
              <span>ステージング済み ({staged.length})</span>
              <button
                type="button"
                onClick={() => {
                  for (const f of staged) handleUnstage(f.path);
                }}
                className="text-gray-400 hover:text-red-500"
                title="全解除"
              >
                全解除
              </button>
            </div>
            {staged.map((f) => (
              <FileItem
                key={`staged-${f.path}`}
                file={f}
                repoPath={wsRoot}
                onStage={handleStage}
                onUnstage={handleUnstage}
              />
            ))}
          </div>
        )}

        {/* 変更 */}
        {modified.length > 0 && (
          <div className="px-3 py-1">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-600 mb-0.5">
              <span>変更 ({modified.length})</span>
              <button
                type="button"
                onClick={() => {
                  for (const f of modified) handleStage(f.path);
                }}
                className="text-gray-400 hover:text-green-500"
                title="すべてステージ"
              >
                すべてステージ
              </button>
            </div>
            {modified.map((f) => (
              <FileItem
                key={`mod-${f.path}`}
                file={f}
                repoPath={wsRoot}
                onStage={handleStage}
                onUnstage={handleUnstage}
              />
            ))}
          </div>
        )}

        {/* 未追跡 */}
        {untracked.length > 0 && (
          <div className="px-3 py-1">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-600 mb-0.5">
              <span>未追跡 ({untracked.length})</span>
              <button
                type="button"
                onClick={() => {
                  for (const f of untracked) handleStage(f.path);
                }}
                className="text-gray-400 hover:text-green-500"
                title="すべてステージ"
              >
                すべてステージ
              </button>
            </div>
            {untracked.map((f) => (
              <FileItem
                key={`ut-${f.path}`}
                file={f}
                repoPath={wsRoot}
                onStage={handleStage}
                onUnstage={handleUnstage}
              />
            ))}
          </div>
        )}

        {/* 変更なし */}
        {fileStatuses.length === 0 && (
          <div className="px-3 py-3 text-xs text-gray-500 text-center">
            変更はありません
          </div>
        )}

        {/* 履歴トグル */}
        <div className="px-3 py-1 border-t border-gray-200">
          <button
            type="button"
            onClick={handleShowHistory}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            {showHistory ? '▼ 履歴を隠す' : '▶ コミット履歴を表示'}
          </button>
        </div>

        {/* コミット履歴 */}
        {showHistory && (
          <div className="px-3 py-1">
            {commitLog.length === 0 ? (
              <div className="text-xs text-gray-500">コミット履歴がありません</div>
            ) : (
              commitLog.map((c) => (
                <div key={c.sha} className="py-1 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="font-mono text-gray-400">{c.shortSha}</span>
                    <span className="text-gray-700 truncate flex-1">{c.message.split('\n')[0]}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {c.author} — {new Date(c.timestamp * 1000).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
