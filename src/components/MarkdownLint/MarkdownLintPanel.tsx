/**
 * MarkdownLintPanel.tsx
 *
 * Markdown lint チェック結果をサイドバーまたはステータスバーで表示するパネル。
 * 見出しレベル飛び・リンク切れ・リスト記号不統一等を検査。
 */

import React, { useMemo, useState, useCallback } from 'react';
import { lintMarkdown, type LintResult, type LintIssue, type LintSeverity } from '../../core/markdown-lint';

interface MarkdownLintPanelProps {
  /** 現在のMarkdownテキスト */
  markdown: string;
  /** 行クリック時のジャンプコールバック */
  onGoToLine?: (line: number) => void;
}

const SEVERITY_ICON: Record<LintSeverity, string> = {
  error: '🔴',
  warning: '🟡',
  info: '🔵',
};

const SEVERITY_LABEL: Record<LintSeverity, string> = {
  error: 'エラー',
  warning: '警告',
  info: '情報',
};

function IssueItem({
  issue,
  onClick,
}: {
  issue: LintIssue;
  onClick: () => void;
}) {
  return (
    <button
      className="w-full text-left flex items-start gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-0"
      onClick={onClick}
      title={`行 ${issue.line} にジャンプ`}
    >
      <span className="flex-shrink-0 mt-0.5">{SEVERITY_ICON[issue.severity]}</span>
      <div className="flex-1 min-w-0">
        <div className="text-gray-800">{issue.message}</div>
        <div className="text-gray-400 mt-0.5">
          行 {issue.line}{issue.column > 0 ? `:${issue.column}` : ''} [{issue.ruleId}]
        </div>
      </div>
    </button>
  );
}

export const MarkdownLintPanel: React.FC<MarkdownLintPanelProps> = ({
  markdown,
  onGoToLine,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<LintSeverity | 'all'>('all');

  const result: LintResult = useMemo(
    () => lintMarkdown(markdown),
    [markdown],
  );

  const filteredIssues = useMemo(() => {
    if (filterSeverity === 'all') return result.issues;
    return result.issues.filter((i) => i.severity === filterSeverity);
  }, [result.issues, filterSeverity]);

  const handleIssueClick = useCallback(
    (issue: LintIssue) => {
      onGoToLine?.(issue.line);
    },
    [onGoToLine],
  );

  const totalIssues = result.issues.length;

  return (
    <div className="markdown-lint-panel">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Markdown Lint
        </h3>
        <div className="flex items-center gap-1 text-xs">
          {result.errorCount > 0 && (
            <span className="text-red-500">{SEVERITY_ICON.error}{result.errorCount}</span>
          )}
          {result.warningCount > 0 && (
            <span className="text-yellow-600">{SEVERITY_ICON.warning}{result.warningCount}</span>
          )}
          {result.infoCount > 0 && (
            <span className="text-blue-500">{SEVERITY_ICON.info}{result.infoCount}</span>
          )}
        </div>
      </div>

      {/* フィルタ */}
      <div className="flex gap-1 px-3 py-1.5 bg-gray-50 border-b border-gray-200">
        {(['all', 'error', 'warning', 'info'] as const).map((sev) => (
          <button
            key={sev}
            className={`px-2 py-0.5 text-xs rounded ${
              filterSeverity === sev
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
            onClick={() => setFilterSeverity(sev)}
          >
            {sev === 'all' ? `全て (${totalIssues})` : `${SEVERITY_LABEL[sev]} (${
              sev === 'error' ? result.errorCount :
              sev === 'warning' ? result.warningCount :
              result.infoCount
            })`}
          </button>
        ))}
      </div>

      {/* 問題リスト */}
      <div className="overflow-auto max-h-[400px]">
        {filteredIssues.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-6">
            {totalIssues === 0
              ? '問題は見つかりませんでした'
              : 'フィルタに一致する問題はありません'}
          </div>
        ) : (
          filteredIssues.map((issue, i) => (
            <IssueItem
              key={`${issue.ruleId}-${issue.line}-${i}`}
              issue={issue}
              onClick={() => handleIssueClick(issue)}
            />
          ))
        )}
      </div>
    </div>
  );
};

/**
 * ステータスバー用の簡易lint表示。
 * 警告・エラー件数をアイコンで表示する。
 */
export const MarkdownLintStatusBadge: React.FC<{
  markdown: string;
  onClick?: () => void;
}> = ({ markdown, onClick }) => {
  const result = useMemo(() => lintMarkdown(markdown), [markdown]);

  if (result.issues.length === 0) return null;

  return (
    <button
      className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded hover:bg-gray-100"
      onClick={onClick}
      title="Markdown lint チェック結果"
    >
      {result.errorCount > 0 && (
        <span className="text-red-500">{SEVERITY_ICON.error}{result.errorCount}</span>
      )}
      {result.warningCount > 0 && (
        <span className="text-yellow-600">{SEVERITY_ICON.warning}{result.warningCount}</span>
      )}
    </button>
  );
};

export default MarkdownLintPanel;
