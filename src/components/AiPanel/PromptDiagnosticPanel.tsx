/**
 * PromptDiagnosticPanel.tsx
 *
 * プロンプト構造診断パネル。
 * ai-design.md §3.3 に準拠。
 *
 * 現在のドキュメントのRTICCO構造をリアルタイム分析し、
 * サイドバーに診断結果を常時表示する。
 */

import React, { useMemo } from 'react';
import { analyzePromptStructure, type PromptStructureAnalysis } from '../../ai/optimizer/transforms';

interface PromptDiagnosticPanelProps {
  /** 現在のMarkdownテキスト */
  markdown: string;
}

/** RTICCO セクション定義 */
const RTICCO_SECTIONS: { key: string; label: string; description: string }[] = [
  { key: 'role', label: '役割 (Role)', description: 'AIが果たすべき役割・ペルソナを定義' },
  { key: 'task', label: 'タスク (Task)', description: 'AIに依頼する具体的な作業内容' },
  { key: 'input', label: '入力 (Input)', description: '処理対象のテキストやデータ' },
  { key: 'context', label: 'コンテキスト (Context)', description: '前提情報・背景知識' },
  { key: 'constraints', label: '制約 (Constraints)', description: '守るべきルール・条件' },
  { key: 'output', label: '出力形式 (Output)', description: '回答のフォーマット指定' },
];

function ScoreBar({ score }: { score: number }) {
  const percentage = Math.round(score * 100);
  const color =
    score >= 0.8 ? 'bg-green-500' :
    score >= 0.5 ? 'bg-yellow-500' :
    'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 w-8 text-right">{percentage}%</span>
    </div>
  );
}

export const PromptDiagnosticPanel: React.FC<PromptDiagnosticPanelProps> = ({
  markdown,
}) => {
  const analysis: PromptStructureAnalysis = useMemo(
    () => analyzePromptStructure(markdown),
    [markdown],
  );

  const foundCount = RTICCO_SECTIONS.filter((s) => analysis.has[s.key]).length;
  const score = foundCount / RTICCO_SECTIONS.length;

  if (!analysis.looksLikePrompt) {
    return (
      <div className="prompt-diagnostic-panel p-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          プロンプト診断
        </h3>
        <div className="text-xs text-gray-500 bg-gray-50 rounded p-3">
          このドキュメントはプロンプトとして検出されていません。
          RTICCO構造（役割・タスク等の見出し）を追加すると診断が有効になります。
        </div>
      </div>
    );
  }

  return (
    <div className="prompt-diagnostic-panel p-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        プロンプト診断
      </h3>

      {/* スコアサマリー */}
      <div className="mb-3">
        <div className="text-sm font-medium text-gray-700 mb-1">
          RTICCO スコア: {foundCount}/{RTICCO_SECTIONS.length}
        </div>
        <ScoreBar score={score} />
      </div>

      {/* セクション一覧 */}
      <div className="space-y-1">
        {RTICCO_SECTIONS.map((section) => {
          const exists = analysis.has[section.key];
          return (
            <div
              key={section.key}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                exists ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}
            >
              <span>{exists ? '✅' : '❌'}</span>
              <span className="font-medium">{section.label}</span>
              {!exists && (
                <span className="text-gray-400 ml-auto text-[10px]">未定義</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 改善提案 */}
      {analysis.missing.length > 0 && (
        <div className="mt-3 text-xs text-gray-500 bg-yellow-50 rounded p-2">
          <strong className="text-yellow-700">改善提案:</strong>
          <ul className="mt-1 space-y-0.5 list-disc list-inside">
            {analysis.missing.map((key) => {
              const section = RTICCO_SECTIONS.find((s) => s.key === key);
              return (
                <li key={key}>
                  「{section?.label ?? key}」セクションを追加
                  <span className="text-gray-400 ml-1">- {section?.description}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PromptDiagnosticPanel;
