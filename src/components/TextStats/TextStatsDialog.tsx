/**
 * 文書統計ダイアログ
 *
 * text-statistics-design.md §1, §2 に準拠。
 * 文字数・単語数・段落数・読了時間・可読性スコアを表示する。
 */

import { useMemo, useCallback } from 'react';
import {
  calculateReadability,
  getReadabilityLabel,
  formatPercent,
} from '../../lib/readability-score';

interface TextStatsDialogProps {
  text: string;
  onClose: () => void;
}

export interface TextStats {
  chars: number;
  charsNoSpace: number;
  words: number;
  paragraphs: number;
  sentences: number;
}

/**
 * テキスト統計を計算する
 * text-statistics-design.md §1.3 のロジックに準拠
 */
export function countTextStats(plainText: string): TextStats {
  const chars = [...plainText].length;

  const noSpace = plainText.replace(/\s/g, '');
  const charsNoSpace = [...noSpace].length;

  // 単語数: 英語（スペース区切り）+ CJK（文字数の1/2を概算）
  const asciiWords = (plainText.match(/\b[a-zA-Z0-9]+\b/g) ?? []).length;
  const cjkChars = (
    plainText.match(
      /[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7A3\u3400-\u4DBF]/g,
    ) ?? []
  ).length;
  const words = asciiWords + Math.ceil(cjkChars / 2);

  const paragraphs = plainText
    .split(/\n{2,}/)
    .filter((p) => p.trim()).length;
  const sentences = (plainText.match(/[.!?。！？]/g) ?? []).length;

  return { chars, charsNoSpace, words, paragraphs, sentences };
}

/**
 * 読了時間を推定する
 * text-statistics-design.md §2 に準拠
 */
export function estimateReadingTime(stats: TextStats): string {
  // 日本語基準: 分速 500 文字、英語基準: 分速 200 単語
  const cjkMinutes = stats.charsNoSpace / 500;
  const enMinutes = stats.words / 200;
  const minutes = Math.ceil(Math.max(cjkMinutes, enMinutes, 1));

  if (minutes < 1) return '1分未満';
  if (minutes < 60) return `${minutes}分`;
  return `${Math.floor(minutes / 60)}時間${minutes % 60}分`;
}

export function TextStatsDialog({ text, onClose }: TextStatsDialogProps) {
  const stats = useMemo(() => countTextStats(text), [text]);
  const readingTime = useMemo(() => estimateReadingTime(stats), [stats]);
  const readability = useMemo(() => calculateReadability(text), [text]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  return (
    <div
      className="text-stats-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="文書統計"
      aria-modal="true"
      tabIndex={-1}
    >
      <div className="text-stats-dialog">
        <div className="text-stats-dialog__header">
          <h3 className="text-stats-dialog__title">文書統計</h3>
          <button
            type="button"
            className="text-stats-dialog__close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <table className="text-stats-dialog__table">
          <tbody>
            <tr>
              <td className="text-stats-dialog__label">文字数（スペース含む）</td>
              <td className="text-stats-dialog__value">
                {stats.chars.toLocaleString()}
              </td>
            </tr>
            <tr>
              <td className="text-stats-dialog__label">文字数（スペースなし）</td>
              <td className="text-stats-dialog__value">
                {stats.charsNoSpace.toLocaleString()}
              </td>
            </tr>
            <tr>
              <td className="text-stats-dialog__label">単語数</td>
              <td className="text-stats-dialog__value">
                {stats.words.toLocaleString()}
              </td>
            </tr>
            <tr>
              <td className="text-stats-dialog__label">段落数</td>
              <td className="text-stats-dialog__value">
                {stats.paragraphs.toLocaleString()}
              </td>
            </tr>
            <tr>
              <td className="text-stats-dialog__label">文数</td>
              <td className="text-stats-dialog__value">
                {stats.sentences.toLocaleString()}
              </td>
            </tr>
            <tr>
              <td className="text-stats-dialog__label">推定読了時間</td>
              <td className="text-stats-dialog__value">{readingTime}</td>
            </tr>
          </tbody>
        </table>

        {readability.totalChars > 0 && (
          <>
            <div className="text-stats-dialog__section-header">可読性スコア</div>
            <div className="readability-score-summary">
              <div className="readability-score-badge" data-level={readability.level}>
                <span className="readability-score-badge__value">{readability.score}</span>
                <span className="readability-score-badge__label">{getReadabilityLabel(readability.level)}</span>
              </div>
            </div>
            <table className="text-stats-dialog__table">
              <tbody>
                <tr>
                  <td className="text-stats-dialog__label">漢字率</td>
                  <td className="text-stats-dialog__value">{formatPercent(readability.kanjiRatio)}</td>
                </tr>
                <tr>
                  <td className="text-stats-dialog__label">ひらがな率</td>
                  <td className="text-stats-dialog__value">{formatPercent(readability.hiraganaRatio)}</td>
                </tr>
                <tr>
                  <td className="text-stats-dialog__label">カタカナ率</td>
                  <td className="text-stats-dialog__value">{formatPercent(readability.katakanaRatio)}</td>
                </tr>
                <tr>
                  <td className="text-stats-dialog__label">平均文長</td>
                  <td className="text-stats-dialog__value">{readability.averageSentenceLength}文字/文</td>
                </tr>
                <tr>
                  <td className="text-stats-dialog__label">文数</td>
                  <td className="text-stats-dialog__value">{readability.sentenceCount}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
