/**
 * ProseLintPanel.tsx
 *
 * 文章スタイル lint チェック結果をサイドバーで表示するパネル。
 * 弱い表現・冗長表現・文体混在・文の長さ等を検査する。
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  lintProse,
  type ProseLintResult,
  type ProseLintIssue,
  type ProseLintSeverity,
} from '../../core/prose-lint';

interface ProseLintPanelProps {
  /** 現在のMarkdownテキスト */
  markdown: string;
  /** 行クリック時のジャンプコールバック */
  onGoToLine?: (line: number) => void;
}

const SEVERITY_ICON: Record<ProseLintSeverity, string> = {
  error: '🔴',
  warning: '🟡',
  info: '🔵',
};

const SEVERITY_LABEL: Record<ProseLintSeverity, string> = {
  error: 'エラー',
  warning: '警告',
  info: '情報',
};

const RULE_LABEL: Record<string, string> = {
  SENT001: '文の長さ',
  STYLE001: '文体混在',
  STYLE002: '弱い表現',
  STYLE003: '冗長表現',
  STYLE004: '助詞の重複',
};

function IssueItem({
  issue,
  onClick,
}: {
  issue: ProseLintIssue;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="w-full text-left flex items-start gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-0"
      onClick={onClick}
      title={`行 ${issue.line} にジャンプ`}
    >
      <span className="flex-shrink-0 mt-0.5">{SEVERITY_ICON[issue.severity]}</span>
      <div className="flex-1 min-w-0">
        <div className="text-gray-800 leading-relaxed">{issue.message}</div>
        {issue.suggestion && (
          <div className="text-blue-600 mt-0.5 leading-relaxed">
            💡 {issue.suggestion}
          </div>
        )}
        <div className="text-gray-400 mt-0.5">
          行 {issue.line}{issue.column > 0 ? `:${issue.column}` : ''}{' '}
          [{RULE_LABEL[issue.ruleId] ?? issue.ruleId}]
        </div>
      </div>
    </button>
  );
}

export const ProseLintPanel: React.FC<ProseLintPanelProps> = ({
  markdown,
  onGoToLine,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<ProseLintSeverity | 'all'>('all');

  const result: ProseLintResult = useMemo(
    () => lintProse(markdown),
    [markdown],
  );

  const filteredIssues = useMemo(() => {
    if (filterSeverity === 'all') return result.issues;
    return result.issues.filter((i) => i.severity === filterSeverity);
  }, [result.issues, filterSeverity]);

  const handleIssueClick = useCallback(
    (issue: ProseLintIssue) => {
      onGoToLine?.(issue.line);
    },
    [onGoToLine],
  );

  const totalIssues = result.issues.length;

  return (
    <div className="prose-lint-panel">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          文章スタイル
        </h3>
        <div className="flex items-center gap-1 text-xs">
          {result.warningCount > 0 && (
            <span className="text-yellow-600">
              {SEVERITY_ICON.warning}{result.warningCount}
            </span>
          )}
          {result.infoCount > 0 && (
            <span className="text-blue-500">
              {SEVERITY_ICON.info}{result.infoCount}
            </span>
          )}
        </div>
      </div>

      {/* フィルタ */}
      <div className="flex gap-1 px-3 py-1.5 bg-gray-50 border-b border-gray-200 flex-wrap">
        {(['all', 'warning', 'info'] as const).map((sev) => (
          <button
            key={sev}
            type="button"
            className={`px-2 py-0.5 text-xs rounded ${
              filterSeverity === sev
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
            onClick={() => setFilterSeverity(sev)}
          >
            {sev === 'all'
              ? `全て (${totalIssues})`
              : `${SEVERITY_LABEL[sev]} (${
                  sev === 'warning' ? result.warningCount : result.infoCount
                })`}
          </button>
        ))}
      </div>

      {/* 問題リスト */}
      <div className="overflow-auto max-h-[400px]">
        {filteredIssues.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-6">
            {totalIssues === 0
              ? '文章スタイルの問題は見つかりませんでした'
              : 'フィルタに一致する問題はありません'}
          </div>
        ) : (
          filteredIssues.map((issue, i) => (
            <IssueItem
              key={`${issue.ruleId}-${issue.line}-${issue.column}-${i}`}
              issue={issue}
              onClick={() => handleIssueClick(issue)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ProseLintPanel;
