/**
 * AiCopyButton.tsx
 *
 * 「AIコピー」ボタンコンポーネント。
 *
 * クリックすると:
 *   1. 現在のMarkdownをAI最適化変換する
 *   2. 最適化済みテキストをクリップボードにコピーする
 *   3. 変更点レポートをポップオーバーで表示する（オプション）
 *
 * ドロップダウンメニュー:
 *   - 最適化してコピー（デフォルト）
 *   - 最適化プレビューを表示してからコピー
 *   - オプション（各変換のオン/オフ設定）
 */

import React, { useState, useCallback, useRef } from 'react';
import { optimizeAndCopy, buildReport, type OptimizationResult, type OptimizerOptions } from '../../ai/optimizer/ai-optimizer';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

type CopyState = 'idle' | 'copying' | 'copied' | 'error';

interface AiCopyButtonProps {
  /** 現在エディタに表示されているMarkdownテキストを取得する関数 */
  getMarkdown: () => string;
  /** ボタンに表示するラベル */
  label?: string;
  /** 変換完了後のコールバック（レポート表示などに使用） */
  onComplete?: (result: OptimizationResult) => void;
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

/**
 * AI最適化コピーボタン。
 *
 * @example
 * <AiCopyButton
 *   getMarkdown={() => editorView.state.doc.textContent}
 *   onComplete={(result) => setReport(buildReport(result))}
 * />
 */
export const AiCopyButton: React.FC<AiCopyButtonProps> = ({
  getMarkdown,
  label = 'AIコピー',
  onComplete,
}) => {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [report, setReport] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [options, setOptions] = useState<Partial<OptimizerOptions>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // ハンドラー
  // ---------------------------------------------------------------------------

  const handleCopy = useCallback(
    async (previewFirst = false) => {
      setCopyState('copying');
      setShowDropdown(false);

      try {
        const markdown = getMarkdown();
        if (!markdown.trim()) {
          setCopyState('idle');
          return;
        }

        const result = await optimizeAndCopy(markdown, options);
        const reportText = buildReport(result);
        setReport(reportText);

        if (previewFirst) {
          // プレビューモード: コピー前にレポートを表示
          setShowReport(true);
        }

        setCopyState('copied');
        onComplete?.(result);

        // 2秒後にアイドル状態に戻す
        setTimeout(() => setCopyState('idle'), 2000);
      } catch {
        setCopyState('error');
        setTimeout(() => setCopyState('idle'), 2000);
      }
    },
    [getMarkdown, options, onComplete]
  );

  // ---------------------------------------------------------------------------
  // レンダリング
  // ---------------------------------------------------------------------------

  const buttonLabel = {
    idle: label,
    copying: '変換中...',
    copied: 'コピー済み ✓',
    error: 'エラー',
  }[copyState];

  const buttonDisabled = copyState === 'copying';

  return (
    <div className="ai-copy-button-wrapper" style={{ position: 'relative', display: 'inline-flex' }}>
      {/* メインボタン */}
      <button
        className={`ai-copy-button ai-copy-button--${copyState}`}
        onClick={() => handleCopy(false)}
        disabled={buttonDisabled}
        title="Markdownを最適化してAIに貼りやすい形式でコピー"
      >
        {buttonLabel}
      </button>

      {/* ドロップダウントリガー */}
      <button
        className="ai-copy-button__dropdown-trigger"
        onClick={() => setShowDropdown((v) => !v)}
        disabled={buttonDisabled}
        aria-label="コピーオプション"
        aria-haspopup="true"
        aria-expanded={showDropdown}
      >
        ▼
      </button>

      {/* ドロップダウンメニュー */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="ai-copy-button__dropdown"
          role="menu"
        >
          <button role="menuitem" onClick={() => handleCopy(false)}>
            最適化してコピー
          </button>
          <button role="menuitem" onClick={() => handleCopy(true)}>
            最適化プレビューを表示してからコピー
          </button>
          <hr />
          <OptimizerOptionsMenu options={options} onChange={setOptions} />
        </div>
      )}

      {/* レポートポップオーバー */}
      {showReport && report && (
        <OptimizationReportPopover
          report={report}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// サブコンポーネント: オプションメニュー
// ---------------------------------------------------------------------------

interface OptimizerOptionsMenuProps {
  options: Partial<OptimizerOptions>;
  onChange: (options: Partial<OptimizerOptions>) => void;
}

const OptimizerOptionsMenu: React.FC<OptimizerOptionsMenuProps> = ({
  options,
  onChange,
}) => {
  const items: { key: keyof OptimizerOptions; label: string }[] = [
    { key: 'normalizeHeadings', label: '見出し階層を修正' },
    { key: 'annotateCodeBlocks', label: 'コードブロックに言語タグ付与' },
    { key: 'normalizeListMarkers', label: 'リスト記号を統一' },
    { key: 'trimExcessiveWhitespace', label: '過剰な空白行を削除' },
    { key: 'annotateLinks', label: 'リンクにURL注記を追加' },
    { key: 'normalizeCodeFences', label: 'コードフェンスを統一' },
  ];

  return (
    <div className="optimizer-options-menu">
      <p className="optimizer-options-menu__title">最適化オプション</p>
      {items.map(({ key, label }) => (
        <label key={key} className="optimizer-options-menu__item">
          <input
            type="checkbox"
            // デフォルトは undefined（全オン）なので undefined/true を同視
            checked={options[key] !== false}
            onChange={(e) => onChange({ ...options, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// サブコンポーネント: レポートポップオーバー
// ---------------------------------------------------------------------------

interface OptimizationReportPopoverProps {
  report: string;
  onClose: () => void;
}

const OptimizationReportPopover: React.FC<OptimizationReportPopoverProps> = ({
  report,
  onClose,
}) => {
  return (
    <div className="optimization-report-popover" role="dialog" aria-label="最適化レポート">
      <div className="optimization-report-popover__header">
        <strong>AIコピー 最適化レポート</strong>
        <button onClick={onClose} aria-label="閉じる">×</button>
      </div>
      <pre className="optimization-report-popover__body">{report}</pre>
      <div className="optimization-report-popover__footer">
        <button onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
};

export default AiCopyButton;
