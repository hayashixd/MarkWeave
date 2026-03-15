/**
 * AiDiffPreview.tsx
 *
 * AIコピー最適化の前後差分プレビューモーダル。
 * ai-design.md §5 フロー3 に準拠。
 *
 * Before / After 比較ビューで変更点を視覚的に確認し、
 * コピー実行前に最適化内容を検証できる。
 */

import React, { useState, useMemo, useCallback } from 'react';
import { optimize, buildReport, type OptimizationResult, type OptimizerOptions } from '../../ai/optimizer/ai-optimizer';

interface AiDiffPreviewProps {
  /** 元のMarkdownテキスト */
  originalMarkdown: string;
  /** モーダルが開いているか */
  open: boolean;
  /** 閉じるコールバック */
  onClose: () => void;
}

/** 行単位のdiff結果 */
interface DiffLine {
  type: 'same' | 'added' | 'removed';
  text: string;
  lineNumber?: number;
}

/**
 * 簡易な行diff計算。
 * LCSベースではなく行マッチングで高速に処理。
 */
function computeLineDiff(original: string, optimized: string): DiffLine[] {
  const origLines = original.split('\n');
  const optLines = optimized.split('\n');
  const result: DiffLine[] = [];

  let oi = 0;
  let ni = 0;

  while (oi < origLines.length || ni < optLines.length) {
    if (oi >= origLines.length) {
      // 元テキスト終了 → 残りは追加
      result.push({ type: 'added', text: optLines[ni]!, lineNumber: ni + 1 });
      ni++;
    } else if (ni >= optLines.length) {
      // 新テキスト終了 → 残りは削除
      result.push({ type: 'removed', text: origLines[oi]!, lineNumber: oi + 1 });
      oi++;
    } else if (origLines[oi] === optLines[ni]) {
      // 同一行
      result.push({ type: 'same', text: origLines[oi]!, lineNumber: oi + 1 });
      oi++;
      ni++;
    } else {
      // 不一致: 前方探索で最適なマッチを探す
      const lookAhead = 5;
      let foundInOpt = -1;
      let foundInOrig = -1;

      for (let k = 1; k <= lookAhead; k++) {
        if (ni + k < optLines.length && origLines[oi] === optLines[ni + k]) {
          foundInOpt = ni + k;
          break;
        }
        if (oi + k < origLines.length && origLines[oi + k] === optLines[ni]) {
          foundInOrig = oi + k;
          break;
        }
      }

      if (foundInOpt >= 0) {
        // 新テキスト側に追加行あり
        for (let k = ni; k < foundInOpt; k++) {
          result.push({ type: 'added', text: optLines[k]!, lineNumber: k + 1 });
        }
        ni = foundInOpt;
      } else if (foundInOrig >= 0) {
        // 元テキスト側に削除行あり
        for (let k = oi; k < foundInOrig; k++) {
          result.push({ type: 'removed', text: origLines[k]!, lineNumber: k + 1 });
        }
        oi = foundInOrig;
      } else {
        // マッチなし: 削除+追加として扱う
        result.push({ type: 'removed', text: origLines[oi]!, lineNumber: oi + 1 });
        result.push({ type: 'added', text: optLines[ni]!, lineNumber: ni + 1 });
        oi++;
        ni++;
      }
    }
  }

  return result;
}

export const AiDiffPreview: React.FC<AiDiffPreviewProps> = ({
  originalMarkdown,
  open,
  onClose,
}) => {
  const [options, setOptions] = useState<Partial<OptimizerOptions>>({});
  const [copied, setCopied] = useState(false);

  const result: OptimizationResult = useMemo(
    () => optimize(originalMarkdown, options),
    [originalMarkdown, options],
  );

  const report = useMemo(() => buildReport(result), [result]);

  const diffLines = useMemo(
    () => computeLineDiff(originalMarkdown, result.optimizedText),
    [originalMarkdown, result.optimizedText],
  );

  const changedCount = diffLines.filter((l) => l.type !== 'same').length;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(result.optimizedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // フォールバック
      const textarea = document.createElement('textarea');
      textarea.value = result.optimizedText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result.optimizedText]);

  const toggleOption = useCallback(
    (key: keyof OptimizerOptions) => {
      setOptions((prev) => ({
        ...prev,
        [key]: prev[key] === false ? undefined : false,
      }));
    },
    [],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-[800px] max-w-[95vw] h-[600px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold">AI コピー差分プレビュー</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg"
            aria-label="閉じる"
          >
            &times;
          </button>
        </div>

        {/* 本体 */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* オプションバー */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-2">
            {([
              ['normalizeHeadings', '見出し修正'],
              ['annotateCodeBlocks', '言語タグ'],
              ['normalizeListMarkers', 'リスト統一'],
              ['trimExcessiveWhitespace', '空白削除'],
              ['normalizeCodeFences', 'フェンス統一'],
            ] as [keyof OptimizerOptions, string][]).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={options[key] !== false}
                  onChange={() => toggleOption(key)}
                  className="rounded"
                />
                {label}
              </label>
            ))}
          </div>

          {/* Diff 表示 */}
          <div className="flex-1 overflow-auto px-4 py-2 font-mono text-xs">
            {changedCount === 0 ? (
              <div className="text-gray-500 text-center py-8">
                変更はありません（すでに最適化済み）
              </div>
            ) : (
              <table className="w-full border-collapse">
                <tbody>
                  {diffLines.map((line, i) => (
                    <tr
                      key={i}
                      className={
                        line.type === 'added'
                          ? 'bg-green-50'
                          : line.type === 'removed'
                          ? 'bg-red-50'
                          : ''
                      }
                    >
                      <td className="text-gray-400 pr-2 text-right select-none w-8 align-top">
                        {line.lineNumber}
                      </td>
                      <td className="text-gray-400 pr-2 select-none w-4 align-top">
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                      </td>
                      <td
                        className={`whitespace-pre-wrap break-all ${
                          line.type === 'added'
                            ? 'text-green-800'
                            : line.type === 'removed'
                            ? 'text-red-800 line-through'
                            : 'text-gray-700'
                        }`}
                      >
                        {line.text || '\u00A0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* レポート */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
            <pre className="whitespace-pre-wrap">{report}</pre>
          </div>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            閉じる
          </button>
          <button
            onClick={handleCopy}
            className="px-4 py-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded"
          >
            {copied ? 'コピー済み ✓' : 'この設定でコピー'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiDiffPreview;
