import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGitStore, type GitFileStatus, type GitBranchInfo, type GitCommitInfo } from './gitStore';

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

function resetStore() {
  useGitStore.getState().stopPolling();
  useGitStore.setState({
    isGitRepo: false,
    fileStatuses: [],
    branchInfo: null,
    commitLog: [],
    isLoading: false,
    error: null,
    _pollIntervalId: null,
  });
}

const sampleStatuses: GitFileStatus[] = [
  { path: 'docs/note.md', status: 'modified', staged: false },
  { path: 'new.md', status: 'untracked', staged: false },
];

const sampleBranch: GitBranchInfo = {
  branch: 'main',
  modifiedCount: 1,
  untrackedCount: 1,
  stagedCount: 0,
  conflictedCount: 0,
};

const sampleCommits: GitCommitInfo[] = [
  {
    sha: 'abc123def456',
    shortSha: 'abc123',
    message: 'feat: add new feature',
    author: 'Alice',
    authorEmail: 'alice@example.com',
    timestamp: 1700000000,
  },
];

describe('gitStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  afterEach(() => {
    useGitStore.getState().stopPolling();
  });

  // -------------------------------------------------------------------------
  // reset
  // -------------------------------------------------------------------------
  describe('reset', () => {
    it('全状態を初期値に戻す', () => {
      useGitStore.setState({ isGitRepo: true, fileStatuses: sampleStatuses, error: 'err' });
      useGitStore.getState().reset();
      const s = useGitStore.getState();
      expect(s.isGitRepo).toBe(false);
      expect(s.fileStatuses).toHaveLength(0);
      expect(s.error).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // refreshStatus
  // -------------------------------------------------------------------------
  describe('refreshStatus', () => {
    it('git_status 成功時に fileStatuses をセットする', async () => {
      mockInvoke.mockResolvedValueOnce(sampleStatuses);

      await useGitStore.getState().refreshStatus('/repo');

      const s = useGitStore.getState();
      expect(s.isGitRepo).toBe(true);
      expect(s.fileStatuses).toEqual(sampleStatuses);
      expect(s.error).toBeNull();
    });

    it('「リポジトリを開けません」エラーで isGitRepo=false にする', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('リポジトリを開けません: /no-repo'));

      await useGitStore.getState().refreshStatus('/no-repo');

      const s = useGitStore.getState();
      expect(s.isGitRepo).toBe(false);
      expect(s.fileStatuses).toHaveLength(0);
      expect(s.error).toBeNull();
    });

    it('その他のエラーは error にセットする', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('network error'));

      await useGitStore.getState().refreshStatus('/repo');

      expect(useGitStore.getState().error).toBe('network error');
    });
  });

  // -------------------------------------------------------------------------
  // refreshBranchInfo
  // -------------------------------------------------------------------------
  describe('refreshBranchInfo', () => {
    it('git_branch_info 成功時に branchInfo をセットする', async () => {
      mockInvoke.mockResolvedValueOnce(sampleBranch);

      await useGitStore.getState().refreshBranchInfo('/repo');

      const s = useGitStore.getState();
      expect(s.branchInfo).toEqual(sampleBranch);
      expect(s.isGitRepo).toBe(true);
    });

    it('失敗時は branchInfo が null になる', async () => {
      useGitStore.setState({ branchInfo: sampleBranch });
      mockInvoke.mockRejectedValueOnce(new Error('not a git repo'));

      await useGitStore.getState().refreshBranchInfo('/no-repo');

      expect(useGitStore.getState().branchInfo).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // refreshAll
  // -------------------------------------------------------------------------
  describe('refreshAll', () => {
    it('isLoading が完了後に false になる', async () => {
      mockInvoke.mockResolvedValue([]);

      const promise = useGitStore.getState().refreshAll('/repo');
      // 実行中は isLoading=true のはず（非同期なので実行直後を確認）
      expect(useGitStore.getState().isLoading).toBe(true);

      await promise;

      expect(useGitStore.getState().isLoading).toBe(false);
    });

    it('git_status と git_branch_info の両方を呼ぶ', async () => {
      mockInvoke.mockResolvedValue([]);

      await useGitStore.getState().refreshAll('/repo');

      const commands = mockInvoke.mock.calls.map((c) => c[0]);
      expect(commands).toContain('git_status');
      expect(commands).toContain('git_branch_info');
    });
  });

  // -------------------------------------------------------------------------
  // getDiff
  // -------------------------------------------------------------------------
  describe('getDiff', () => {
    it('git_diff の結果を返す', async () => {
      const diffText = '@@ -1,3 +1,4 @@\n+new line\n old line';
      mockInvoke.mockResolvedValueOnce(diffText);

      const result = await useGitStore.getState().getDiff('/repo', 'note.md');

      expect(result).toBe(diffText);
      expect(mockInvoke).toHaveBeenCalledWith('git_diff', {
        repoPath: '/repo',
        filePath: 'note.md',
        staged: false,
      });
    });

    it('staged=true を渡せる', async () => {
      mockInvoke.mockResolvedValueOnce('');

      await useGitStore.getState().getDiff('/repo', 'note.md', true);

      expect(mockInvoke).toHaveBeenCalledWith('git_diff', {
        repoPath: '/repo',
        filePath: 'note.md',
        staged: true,
      });
    });
  });

  // -------------------------------------------------------------------------
  // stageFile / unstageFile
  // -------------------------------------------------------------------------
  describe('stageFile', () => {
    it('git_stage を呼んだ後に refreshAll する', async () => {
      mockInvoke.mockResolvedValue([]);

      await useGitStore.getState().stageFile('/repo', 'note.md');

      const commands = mockInvoke.mock.calls.map((c) => c[0]);
      expect(commands[0]).toBe('git_stage');
      expect(commands).toContain('git_status');
    });
  });

  describe('unstageFile', () => {
    it('git_unstage を呼んだ後に refreshAll する', async () => {
      mockInvoke.mockResolvedValue([]);

      await useGitStore.getState().unstageFile('/repo', 'note.md');

      const commands = mockInvoke.mock.calls.map((c) => c[0]);
      expect(commands[0]).toBe('git_unstage');
      expect(commands).toContain('git_status');
    });
  });

  // -------------------------------------------------------------------------
  // commit
  // -------------------------------------------------------------------------
  describe('commit', () => {
    it('コミット結果を返す', async () => {
      const commitResult = { sha: 'abc123def', shortSha: 'abc123' };
      mockInvoke
        .mockResolvedValueOnce(commitResult) // git_commit
        .mockResolvedValue([]); // refreshAll

      const result = await useGitStore.getState().commit('/repo', 'fix: bug fix');

      expect(result).toEqual(commitResult);
      expect(mockInvoke).toHaveBeenCalledWith('git_commit', {
        repoPath: '/repo',
        message: 'fix: bug fix',
      });
    });
  });

  // -------------------------------------------------------------------------
  // refreshLog
  // -------------------------------------------------------------------------
  describe('refreshLog', () => {
    it('コミット履歴をセットする', async () => {
      mockInvoke.mockResolvedValueOnce(sampleCommits);

      await useGitStore.getState().refreshLog('/repo');

      expect(useGitStore.getState().commitLog).toEqual(sampleCommits);
    });

    it('デフォルトの limit は 50', async () => {
      mockInvoke.mockResolvedValueOnce([]);

      await useGitStore.getState().refreshLog('/repo');

      expect(mockInvoke).toHaveBeenCalledWith('git_log', { repoPath: '/repo', limit: 50 });
    });

    it('カスタム limit を渡せる', async () => {
      mockInvoke.mockResolvedValueOnce([]);

      await useGitStore.getState().refreshLog('/repo', 10);

      expect(mockInvoke).toHaveBeenCalledWith('git_log', { repoPath: '/repo', limit: 10 });
    });

    it('失敗時は commitLog が空になる', async () => {
      useGitStore.setState({ commitLog: sampleCommits });
      mockInvoke.mockRejectedValueOnce(new Error('fail'));

      await useGitStore.getState().refreshLog('/repo');

      expect(useGitStore.getState().commitLog).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // startPolling / stopPolling
  // -------------------------------------------------------------------------
  describe('startPolling / stopPolling', () => {
    it('intervalSec<=0 ではポーリングを開始しない', () => {
      useGitStore.getState().startPolling('/repo', 0);
      expect(useGitStore.getState()._pollIntervalId).toBeNull();
    });

    it('startPolling でインターバル ID がセットされる', () => {
      useGitStore.getState().startPolling('/repo', 30);
      expect(useGitStore.getState()._pollIntervalId).not.toBeNull();
    });

    it('stopPolling でインターバル ID が null になる', () => {
      useGitStore.getState().startPolling('/repo', 30);
      useGitStore.getState().stopPolling();
      expect(useGitStore.getState()._pollIntervalId).toBeNull();
    });

    it('startPolling を再度呼ぶと前のインターバルは停止する', () => {
      useGitStore.getState().startPolling('/repo', 30);
      const firstId = useGitStore.getState()._pollIntervalId;
      useGitStore.getState().startPolling('/repo', 60);
      const secondId = useGitStore.getState()._pollIntervalId;
      expect(secondId).not.toBe(firstId);
    });
  });
});
