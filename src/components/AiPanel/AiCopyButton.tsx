/**
 * AiCopyButton.tsx
 *
 * 「AI向けに清書してコピー」ボタンコンポーネント。
 *
 * クリックすると:
 *   1. 差分プレビューモーダル（AiDiffPreview）を開く（デフォルト）
 *   2. ユーザーがビフォー/アフターを確認してからコピー実行
 *
 * ドロップダウンメニュー:
 *   - プレビューなしですぐにコピー（省略モード）
 *   - オプション（各変換のオン/オフ設定）
 */

import React, { useState, useCallback, useRef } from 'react';
import { optimizeAndCopy, type OptimizationResult, type OptimizerOptions } from '../../ai/optimizer/ai-optimizer';
import { AiDiffPreview } from './AiDiffPreview';

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
 * AI清書コピーボタン。
 *
 * @example
 * <AiCopyButton
 *   getMarkdown={() => editorView.state.doc.textContent}
 *   onComplete={(result) => console.log(result)}
 * />
 */
export const AiCopyButton: React.FC<AiCopyButtonProps> = ({
  getMarkdown,
  label = 'AI向けに清書してコピー',
  onComplete,
}) => {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [showDropdown, setShowDropdown] = useState(false);
  const [options, setOptions] = useState<Partial<OptimizerOptions>>({});
  const [showDiffPreview, setShowDiffPreview] = useState(false);
  const [previewMarkdown, setPreviewMarkdown] = useState('');
  const [lastResult, setLastResult] = useState<OptimizationResult | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // ハンドラー
  // ---------------------------------------------------------------------------

  /** デフォルトアクション: 差分プレビューモーダルを開く */
  const handleOpenPreview = useCallback(() => {
    const markdown = getMarkdown();
    if (!markdown.trim()) return;
    setPreviewMarkdown(markdown);
    setShowDiffPreview(true);
    setShowDropdown(false);
  }, [getMarkdown]);

  /** ドロップダウンからの即時コピー（プレビューなし） */
  const handleQuickCopy = useCallback(async () => {
    setCopyState('copying');
    setShowDropdown(false);
    try {
      const markdown = getMarkdown();
      if (!markdown.trim()) {
        setCopyState('idle');
        return;
      }
      const result = await optimizeAndCopy(markdown, options);
      setLastResult(result);
      setCopyState('copied');
      onComplete?.(result);
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  }, [getMarkdown, options, onComplete]);

  /** 差分プレビューモーダルからのコピー完了コールバック */
  const handleDiffCopy = useCallback((result: OptimizationResult) => {
    setLastResult(result);
    setShowDiffPreview(false);
    setCopyState('copied');
    onComplete?.(result);
    setTimeout(() => setCopyState('idle'), 2000);
  }, [onComplete]);

  // ---------------------------------------------------------------------------
  // レンダリング
  // ---------------------------------------------------------------------------

  const totalChanges = lastResult?.transforms.reduce((sum, t) => sum + t.count, 0) ?? 0;
  const copiedLabel = totalChanges > 0 ? `コピー済み ✓ (${totalChanges}件修正)` : 'コピー済み ✓';

  const buttonLabel = {
    idle: label,
    copying: '変換中...',
    copied: copiedLabel,
    error: 'エラー',
  }[copyState];

  const buttonDisabled = copyState === 'copying';

  return (
    <div className="ai-copy-button-wrapper" style={{ position: 'relative', display: 'inline-flex' }}>
      {/* メインボタン: 差分プレビューを開く */}
      <button
        className={`ai-copy-button ai-copy-button--${copyState}`}
        onClick={handleOpenPreview}
        disabled={buttonDisabled}
        title="Markdownを清書してAIに貼りやすい形式でコピー（変更点を確認してからコピー）"
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
          <button role="menuitem" onClick={handleQuickCopy}>
            プレビューなしですぐにコピー
          </button>
          <hr />
          <OptimizerOptionsMenu options={options} onChange={setOptions} />
        </div>
      )}

      {/* 差分プレビューモーダル */}
      <AiDiffPreview
        originalMarkdown={previewMarkdown}
        open={showDiffPreview}
        onClose={() => setShowDiffPreview(false)}
        onCopy={handleDiffCopy}
      />
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

export default AiCopyButton;
