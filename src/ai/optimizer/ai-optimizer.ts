/**
 * ai-optimizer.ts
 *
 * Markdown テキストを「AIが最も理解しやすい構造」に自動調整するメインモジュール。
 * クリップボードへのコピーも担当する。
 *
 * 処理パイプライン:
 *   入力テキスト
 *     → normalizeCodeFences   コードフェンスの正規化
 *     → normalizeHeadings     見出し階層の修正
 *     → annotateCodeBlocks    コードブロックへの言語タグ付与
 *     → normalizeListMarkers  リスト記号の統一
 *     → trimExcessiveWhitespace 過剰な空白行の削除
 *     → annotateLinks         リンクへのURL注記
 *     → 出力テキスト
 */

import {
  normalizeHeadings,
  annotateCodeBlocks,
  normalizeListMarkers,
  trimExcessiveWhitespace,
  annotateLinks,
  normalizeCodeFences,
  analyzePromptStructure,
  type TransformResult,
  type PromptStructureAnalysis,
} from './transforms';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** 各変換をオン/オフする設定 */
export interface OptimizerOptions {
  normalizeHeadings: boolean;
  annotateCodeBlocks: boolean;
  normalizeListMarkers: boolean;
  trimExcessiveWhitespace: boolean;
  annotateLinks: boolean;
  normalizeCodeFences: boolean;
}

/** 最適化の実行結果 */
export interface OptimizationResult {
  /** 最適化後の Markdown テキスト */
  optimizedText: string;
  /** 元のテキスト */
  originalText: string;
  /** 各変換の実行結果（変換ログ） */
  transforms: TransformResult[];
  /** プロンプト構造の分析結果 */
  promptAnalysis: PromptStructureAnalysis;
  /** 最適化前後の文字数 */
  charDiff: { before: number; after: number };
}

const defaultOptions: OptimizerOptions = {
  normalizeHeadings: true,
  annotateCodeBlocks: true,
  normalizeListMarkers: true,
  trimExcessiveWhitespace: true,
  annotateLinks: false, // デフォルトはオフ（ドキュメント用途では不要な場合が多い）
  normalizeCodeFences: true,
};

// ---------------------------------------------------------------------------
// メインAPI
// ---------------------------------------------------------------------------

/**
 * Markdown テキストを AI 最適化変換する。
 *
 * @param markdown - 最適化対象の Markdown テキスト
 * @param options  - 変換オプション（デフォルトで全変換オン）
 * @returns 最適化結果
 *
 * @example
 * const result = optimize(markdownText);
 * console.log(result.optimizedText);
 * console.log(result.transforms.filter(t => t.count > 0));
 */
export function optimize(
  markdown: string,
  options: Partial<OptimizerOptions> = {}
): OptimizationResult {
  const opts = { ...defaultOptions, ...options };
  const transforms: TransformResult[] = [];
  let current = markdown;

  // 変換パイプライン（順序が重要）
  if (opts.normalizeCodeFences) {
    const r = normalizeCodeFences(current);
    transforms.push(r);
    current = r.text;
  }
  if (opts.normalizeHeadings) {
    const r = normalizeHeadings(current);
    transforms.push(r);
    current = r.text;
  }
  if (opts.annotateCodeBlocks) {
    const r = annotateCodeBlocks(current);
    transforms.push(r);
    current = r.text;
  }
  if (opts.normalizeListMarkers) {
    const r = normalizeListMarkers(current);
    transforms.push(r);
    current = r.text;
  }
  if (opts.trimExcessiveWhitespace) {
    const r = trimExcessiveWhitespace(current);
    transforms.push(r);
    current = r.text;
  }
  if (opts.annotateLinks) {
    const r = annotateLinks(current);
    transforms.push(r);
    current = r.text;
  }

  const promptAnalysis = analyzePromptStructure(current);

  return {
    optimizedText: current,
    originalText: markdown,
    transforms,
    promptAnalysis,
    charDiff: {
      before: markdown.length,
      after: current.length,
    },
  };
}

/**
 * Markdown を最適化してクリップボードにコピーする。
 *
 * @param markdown - 最適化対象の Markdown テキスト
 * @param options  - 変換オプション
 * @returns 最適化結果（UIでの変更点表示に使用）
 *
 * @example
 * const result = await optimizeAndCopy(editorContent);
 * showReport(result);
 */
export async function optimizeAndCopy(
  markdown: string,
  options: Partial<OptimizerOptions> = {}
): Promise<OptimizationResult> {
  const result = optimize(markdown, options);

  try {
    await navigator.clipboard.writeText(result.optimizedText);
  } catch {
    // クリップボードAPIが使えない環境のフォールバック
    fallbackCopyToClipboard(result.optimizedText);
  }

  return result;
}

/**
 * Clipboard API が使えない環境向けのフォールバック。
 * 一時的な textarea を使ってコピーする。
 */
function fallbackCopyToClipboard(text: string): void {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

// ---------------------------------------------------------------------------
// レポート生成
// ---------------------------------------------------------------------------

/**
 * 最適化結果から人間向けのサマリーテキストを生成する。
 *
 * @param result - optimize() / optimizeAndCopy() の返り値
 * @returns ユーザーに表示するサマリー文字列
 */
export function buildReport(result: OptimizationResult): string {
  const applied = result.transforms.filter((t) => t.count > 0);
  const lines: string[] = [];

  if (applied.length === 0) {
    lines.push('✅ 最適化の必要はありませんでした（すでに整形済み）');
  } else {
    for (const t of applied) {
      lines.push(`✅ ${t.description}`);
    }
  }

  // プロンプト構造の警告
  if (result.promptAnalysis.looksLikePrompt && result.promptAnalysis.missing.length > 0) {
    const sectionNames: Record<string, string> = {
      role: '役割 (Role)',
      task: 'タスク (Task)',
      input: '入力 (Input)',
      context: 'コンテキスト (Context)',
      constraints: '制約 (Constraints)',
      output: '出力形式 (Output Format)',
    };
    const missingNames = result.promptAnalysis.missing
      .map((k) => sectionNames[k] ?? k)
      .join('、');
    lines.push(`⚠️  プロンプト構造: 「${missingNames}」が未定義`);
  }

  const diff = result.charDiff.after - result.charDiff.before;
  const diffStr = diff <= 0 ? `${Math.abs(diff)}文字削減` : `${diff}文字増加`;
  lines.push(`\n最適化後: ${result.charDiff.after}文字（元: ${result.charDiff.before}文字 / ${diffStr}）`);

  return lines.join('\n');
}
