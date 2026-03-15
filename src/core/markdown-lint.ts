/**
 * markdown-lint.ts
 *
 * Markdown ドキュメントの品質検査エンジン。
 * 見出しレベル飛び・リンク切れ・リスト記号不統一等を検出する。
 *
 * Phase 7: テクニカルライター/開発者向けの lint チェック機能。
 */

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export type LintSeverity = 'error' | 'warning' | 'info';

export interface LintIssue {
  /** ルールID */
  ruleId: string;
  /** 重要度 */
  severity: LintSeverity;
  /** 問題の説明（日本語） */
  message: string;
  /** 該当行番号（1始まり） */
  line: number;
  /** 該当列番号（1始まり、不明時は 0） */
  column: number;
}

export interface LintResult {
  /** 検出された問題の一覧 */
  issues: LintIssue[];
  /** エラー件数 */
  errorCount: number;
  /** 警告件数 */
  warningCount: number;
  /** 情報件数 */
  infoCount: number;
}

// ---------------------------------------------------------------------------
// Lint ルール定義
// ---------------------------------------------------------------------------

type LintRule = (lines: string[], fullText: string) => LintIssue[];

/** MD001: 見出しレベルの飛び検出 */
const headingLevelSkip: LintRule = (lines) => {
  const issues: LintIssue[] = [];
  let prevLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]!.match(/^(#{1,6})\s+/);
    if (!match) continue;
    const level = match[1]!.length;

    if (prevLevel > 0 && level > prevLevel + 1) {
      issues.push({
        ruleId: 'MD001',
        severity: 'warning',
        message: `見出しレベルが ${prevLevel} から ${level} に飛んでいます（H${prevLevel} → H${level}）`,
        line: i + 1,
        column: 1,
      });
    }
    prevLevel = level;
  }
  return issues;
};

/** MD003: 見出しスタイルの混在検出 */
const headingStyleConsistency: LintRule = (lines) => {
  const issues: LintIssue[] = [];
  let hasAtx = false;
  let hasSetext = false;

  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,6}\s+/.test(lines[i]!)) hasAtx = true;
    if (i > 0 && /^[=-]+\s*$/.test(lines[i]!) && lines[i - 1]!.trim().length > 0) {
      hasSetext = true;
    }
  }

  if (hasAtx && hasSetext) {
    issues.push({
      ruleId: 'MD003',
      severity: 'info',
      message: 'ATX 形式（#）と Setext 形式（===）の見出しが混在しています',
      line: 1,
      column: 0,
    });
  }
  return issues;
};

/** MD009: 行末の余計な空白 */
const trailingWhitespace: LintRule = (lines) => {
  const issues: LintIssue[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // 2スペースの改行（ハードブレーク）は許容
    if (/[^ ] {1}$/.test(line) || / {3,}$/.test(line)) {
      issues.push({
        ruleId: 'MD009',
        severity: 'info',
        message: '行末に余計な空白があります',
        line: i + 1,
        column: line.length,
      });
    }
  }
  return issues;
};

/** MD012: 連続する空行の検出 */
const consecutiveBlankLines: LintRule = (lines) => {
  const issues: LintIssue[] = [];
  let blankCount = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim() === '') {
      blankCount++;
      if (blankCount >= 3) {
        issues.push({
          ruleId: 'MD012',
          severity: 'info',
          message: `連続する空行が ${blankCount} 行あります（最大2行を推奨）`,
          line: i + 1,
          column: 0,
        });
      }
    } else {
      blankCount = 0;
    }
  }
  return issues;
};

/** MD032: リスト記号の不統一 */
const listMarkerConsistency: LintRule = (lines) => {
  const issues: LintIssue[] = [];
  const markers = new Set<string>();
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(\s*)([-*+])\s/);
    if (match) {
      markers.add(match[2]!);
    }
  }

  if (markers.size > 1) {
    issues.push({
      ruleId: 'MD032',
      severity: 'warning',
      message: `リスト記号が不統一です（${[...markers].join(', ')} が混在）。- に統一を推奨`,
      line: 1,
      column: 0,
    });
  }
  return issues;
};

/** MD040: コードブロックの言語指定なし */
const fencedCodeLanguage: LintRule = (lines) => {
  const issues: LintIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^```\s*$/.test(line)) {
      // 閉じフェンスかどうかを判定
      let isClosing = false;
      for (let j = i - 1; j >= 0; j--) {
        if (/^```/.test(lines[j]!)) {
          isClosing = true;
          break;
        }
      }
      if (!isClosing) {
        issues.push({
          ruleId: 'MD040',
          severity: 'warning',
          message: 'コードブロックに言語が指定されていません',
          line: i + 1,
          column: 4,
        });
      }
    }
  }
  return issues;
};

/** LINK001: 壊れた内部リンクの検出 */
const brokenInternalLinks: LintRule = (lines, _fullText) => {
  const issues: LintIssue[] = [];
  // ドキュメント内の見出しアンカーを収集
  const anchors = new Set<string>();
  for (const line of lines) {
    const match = line.match(/^#{1,6}\s+(.+)$/);
    if (match) {
      const slug = match[1]!
        .toLowerCase()
        .replace(/[^\w\s\u3040-\u9fff-]/g, '')
        .replace(/\s+/g, '-');
      anchors.add(slug);
    }
  }

  // #アンカーリンクをチェック
  const linkPattern = /\[([^\]]*)\]\(#([^)]+)\)/g;
  for (let i = 0; i < lines.length; i++) {
    let match;
    while ((match = linkPattern.exec(lines[i]!)) !== null) {
      const anchor = match[2]!;
      if (!anchors.has(anchor)) {
        issues.push({
          ruleId: 'LINK001',
          severity: 'warning',
          message: `内部リンク「#${anchor}」の参照先が見つかりません`,
          line: i + 1,
          column: match.index + 1,
        });
      }
    }
  }
  return issues;
};

/** IMG001: 画像の alt テキストなし */
const imageAltText: LintRule = (lines) => {
  const issues: LintIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]!.match(/!\[\]\(/);
    if (match) {
      issues.push({
        ruleId: 'IMG001',
        severity: 'warning',
        message: '画像に alt テキストが設定されていません',
        line: i + 1,
        column: (match.index ?? 0) + 1,
      });
    }
  }
  return issues;
};

// ---------------------------------------------------------------------------
// メインAPI
// ---------------------------------------------------------------------------

const ALL_RULES: LintRule[] = [
  headingLevelSkip,
  headingStyleConsistency,
  trailingWhitespace,
  consecutiveBlankLines,
  listMarkerConsistency,
  fencedCodeLanguage,
  brokenInternalLinks,
  imageAltText,
];

/**
 * Markdown テキストの lint チェックを実行する。
 *
 * @param markdown - チェック対象の Markdown テキスト
 * @returns lint 結果
 */
export function lintMarkdown(markdown: string): LintResult {
  const lines = markdown.split('\n');
  const allIssues: LintIssue[] = [];

  for (const rule of ALL_RULES) {
    const issues = rule(lines, markdown);
    allIssues.push(...issues);
  }

  // 行番号でソート
  allIssues.sort((a, b) => a.line - b.line || a.column - b.column);

  return {
    issues: allIssues,
    errorCount: allIssues.filter((i) => i.severity === 'error').length,
    warningCount: allIssues.filter((i) => i.severity === 'warning').length,
    infoCount: allIssues.filter((i) => i.severity === 'info').length,
  };
}
