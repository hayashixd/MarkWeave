/**
 * pandoc-exporter.ts
 *
 * Pandoc を使った Word (.docx) / LaTeX (.tex) / ePub (.epub) エクスポートモジュール。
 * export-interop-design.md §7, §8, §9 に準拠。
 *
 * Tauri コマンド:
 *   check_pandoc   — Pandoc のインストール確認
 *   export_with_pandoc — Pandoc 経由のエクスポート実行
 */

import { invoke } from '@tauri-apps/api/core';

// ─────────────────────────────────────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────────────────────────────────────

/** Pandoc インストール確認結果 */
export interface PandocCheckResult {
  available: boolean;
  version: string | null;
  path: string | null;
}

/** Pandoc エクスポート対象フォーマット */
export type PandocFormat = 'docx' | 'latex' | 'epub';

/** Word (.docx) エクスポートオプション */
export interface DocxExportOptions {
  /** 目次を生成するか */
  includeToc: boolean;
  /** reference.docx のパス（省略時はPandocデフォルト） */
  referenceDoc?: string;
  /** コードのシンタックスハイライト */
  includeHighlight: boolean;
  /** ユーザー指定 Pandoc パス */
  pandocPath?: string;
}

/** LaTeX (.tex) エクスポートオプション */
export interface LatexExportOptions {
  /** 目次を生成するか */
  includeToc: boolean;
  /** LaTeX エンジン */
  engine: 'pdflatex' | 'xelatex' | 'lualatex';
  /** ユーザー指定 Pandoc パス */
  pandocPath?: string;
}

/** ePub エクスポートオプション */
export interface EpubExportOptions {
  /** 目次を生成するか */
  includeToc: boolean;
  /** 表紙画像パス */
  coverImage?: string;
  /** ドキュメントタイトル */
  title?: string;
  /** 著者名 */
  author?: string;
  /** 言語コード ('ja' | 'en' など) */
  language: string;
  /** ユーザー指定 Pandoc パス */
  pandocPath?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pandoc 確認
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pandoc のインストール状態を確認する。
 *
 * @param pandocPath - ユーザー指定の Pandoc パス（省略時は自動検出）
 */
export async function checkPandoc(pandocPath?: string): Promise<PandocCheckResult> {
  return invoke<PandocCheckResult>('check_pandoc', {
    pandocPath: pandocPath ?? null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Word (.docx) エクスポート
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Markdown テキストを Word (.docx) ファイルとしてエクスポートする。
 *
 * @param markdownContent - エクスポート対象の Markdown テキスト
 * @param outputPath      - 出力先ファイルパス
 * @param options         - エクスポートオプション
 */
export async function exportToDocx(
  markdownContent: string,
  outputPath: string,
  options: DocxExportOptions,
): Promise<void> {
  await invoke('export_with_pandoc', {
    content: markdownContent,
    options: {
      format: 'docx',
      outputPath,
      pandocPath: options.pandocPath ?? null,
      toc: options.includeToc,
      referenceDoc: options.referenceDoc ?? null,
      highlight: options.includeHighlight,
      latexEngine: null,
      coverImage: null,
      title: null,
      author: null,
      language: null,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LaTeX エクスポート
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Markdown テキストを LaTeX (.tex) ファイルとしてエクスポートする。
 *
 * @param markdownContent - エクスポート対象の Markdown テキスト
 * @param outputPath      - 出力先ファイルパス
 * @param options         - エクスポートオプション
 */
export async function exportToLatex(
  markdownContent: string,
  outputPath: string,
  options: LatexExportOptions,
): Promise<void> {
  await invoke('export_with_pandoc', {
    content: markdownContent,
    options: {
      format: 'latex',
      outputPath,
      pandocPath: options.pandocPath ?? null,
      toc: options.includeToc,
      referenceDoc: null,
      highlight: false,
      latexEngine: options.engine,
      coverImage: null,
      title: null,
      author: null,
      language: null,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ePub エクスポート
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Markdown テキストを ePub ファイルとしてエクスポートする。
 *
 * @param markdownContent - エクスポート対象の Markdown テキスト
 * @param outputPath      - 出力先ファイルパス
 * @param options         - エクスポートオプション
 */
export async function exportToEpub(
  markdownContent: string,
  outputPath: string,
  options: EpubExportOptions,
): Promise<void> {
  await invoke('export_with_pandoc', {
    content: markdownContent,
    options: {
      format: 'epub',
      outputPath,
      pandocPath: options.pandocPath ?? null,
      toc: options.includeToc,
      referenceDoc: null,
      highlight: false,
      latexEngine: null,
      coverImage: options.coverImage ?? null,
      title: options.title ?? null,
      author: options.author ?? null,
      language: options.language,
    },
  });
}
