/**
 * prose-lint.ts
 *
 * 日本語技術文書向け文体チェックエンジン。
 * textlint-rule-preset-ja-technical-writing のルールセットを
 * 外部ライブラリ不要の純粋 TypeScript で実装。
 *
 * 対象ルール:
 *  - SENT001: sentence-length（一文の長さ制限）
 *  - STYLE001: no-mix-dearu-desumasu（文体の統一）
 *  - STYLE002: ja-no-weak-phrase（弱い表現の検出）
 *  - STYLE003: ja-no-redundant-expression（冗長な表現の検出）
 *  - STYLE004: no-doubled-wo（「を」の二重使用の検出）
 */

export type ProseLintSeverity = 'error' | 'warning' | 'info';

export interface ProseLintIssue {
  ruleId: string;
  message: string;
  line: number;    // 1-based
  column: number;  // 1-based, 0 if unknown
  severity: ProseLintSeverity;
  suggestion?: string;
}

export interface ProseLintResult {
  issues: ProseLintIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

// ─── 定数 ────────────────────────────────────────────────────────

/** 一文の最大文字数（この長さを超えたら警告） */
export const MAX_SENTENCE_LENGTH = 100;

/** ですます調と判定する文末パターン */
const DESU_MASU_ENDING = /(?:です|ます|でした|ました|でしょう|ません|ましょう|ませんでした)[。！？」!?]?$/;

/** だ・である調と判定する文末パターン */
const DA_DEARU_ENDING = /(?:だ|である|だった|ではない|だろう|ではなかった)[。！？」!?]?$/;

/** 弱い表現パターン */
const WEAK_PHRASES: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /かもしれません/,
    message: '「かもしれません」は弱い表現です。断定的な表現を検討してください。',
  },
  {
    pattern: /かもしれない/,
    message: '「かもしれない」は弱い表現です。断定的な表現を検討してください。',
  },
  {
    pattern: /と思われます/,
    message: '「と思われます」は弱い表現です。断定的な表現を検討してください。',
  },
  {
    pattern: /と思います/,
    message: '「と思います」は弱い表現です。断定的な表現を検討してください。',
  },
  {
    pattern: /と思う/,
    message: '「と思う」は弱い表現です。断定的な表現を検討してください。',
  },
  {
    pattern: /ではないでしょうか/,
    message: '「ではないでしょうか」は弱い表現です。断定的な表現を検討してください。',
  },
  {
    pattern: /ような気がします/,
    message: '「ような気がします」は弱い表現です。断定的な表現を検討してください。',
  },
  {
    pattern: /ような気がする/,
    message: '「ような気がする」は弱い表現です。断定的な表現を検討してください。',
  },
];

/** 冗長な表現パターン */
const REDUNDANT_EXPRESSIONS: Array<{
  pattern: RegExp;
  message: string;
  suggestion: string;
}> = [
  {
    pattern: /ことができ(る|ます)/,
    message: '「〜ことができる」は冗長な表現です。',
    suggestion: '「できる」または可能形（読み込める、設定できる等）に短縮できます。',
  },
  {
    pattern: /を行(う|い)(ます)?/,
    message: '「を行う」は冗長な場合があります。',
    suggestion: '「する」に置き換えを検討してください。',
  },
  {
    pattern: /という形で/,
    message: '「という形で」は冗長な表現です。',
    suggestion: '「で」または「として」に短縮できます。',
  },
  {
    pattern: /ということになり(ます)?/,
    message: '「ということになります」は冗長な表現です。',
    suggestion: '「〜です」または「〜となります」に短縮できます。',
  },
  {
    pattern: /という点に(おいて|ついて)/,
    message: '「という点において」は冗長な表現です。',
    suggestion: '「〜では」または「〜について」に短縮できます。',
  },
];

// ─── ヘルパー関数 ────────────────────────────────────────────────

/**
 * YAML Front Matter を除去し、本文の先頭行インデックス（0-based）を返す。
 * Front Matter はファイル先頭の --- から始まり --- または ... で終わる。
 */
export function getFrontMatterEndLine(lines: string[]): number {
  if (lines.length === 0 || lines[0]?.trim() !== '---') return 0;
  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i]?.trim() ?? '';
    if (trimmed === '---' || trimmed === '...') return i + 1;
  }
  return 0; // 閉じタグがない場合はスキップしない
}

/**
 * コードブロック内かどうかを示す boolean 配列を返す（インデックスは 0-based）。
 * フェンス行（``` で始まる行）自体も true とする。
 */
export function buildCodeBlockMask(lines: string[]): boolean[] {
  const mask = new Array<boolean>(lines.length).fill(false);
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^```/.test(lines[i]?.trimStart() ?? '')) {
      inCode = !inCode;
      mask[i] = true; // フェンス行自体もスキップ対象
    } else {
      mask[i] = inCode;
    }
  }
  return mask;
}

/**
 * 行内のインラインコード（`...`）を同じ長さのスペースに置換する。
 * 列番号計算のために元の長さを維持する。
 */
export function removeInlineCode(line: string): string {
  return line.replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
}

/** 行が見出し（# で始まる）かどうかを判定する */
function isHeadingLine(line: string): boolean {
  return /^#{1,6}\s/.test(line.trim());
}

// ─── ルール実装 ──────────────────────────────────────────────────

/**
 * SENT001: sentence-length
 *
 * 一文が MAX_SENTENCE_LENGTH 文字を超えている場合に警告する。
 * 見出し・コードブロック・空行はスキップ。
 * 文末記号（。！？）で文を区切り、各文の長さを検査する。
 */
export function checkSentenceLength(
  lines: string[],
  codeBlockMask: boolean[],
  frontMatterEnd: number,
): ProseLintIssue[] {
  const issues: ProseLintIssue[] = [];

  for (let i = frontMatterEnd; i < lines.length; i++) {
    if (codeBlockMask[i]) continue;
    const rawLine = lines[i] ?? '';
    if (rawLine.trim() === '') continue;
    if (isHeadingLine(rawLine)) continue;

    // インラインコードを除去してから長さを計測
    const line = removeInlineCode(rawLine);

    // 文末記号で分割して各文の長さを確認
    // split のルックビハインドで区切り文字を直前のセグメントに含める
    const segments = line.split(/(?<=[。！？])/);
    let col = 1;
    for (const seg of segments) {
      const trimmed = seg.trimEnd();
      if (trimmed.length > MAX_SENTENCE_LENGTH) {
        issues.push({
          ruleId: 'SENT001',
          message: `一文が ${trimmed.length} 文字あります（上限: ${MAX_SENTENCE_LENGTH} 文字）。`,
          line: i + 1,
          column: col,
          severity: 'warning',
        });
      }
      col += seg.length;
    }
  }

  return issues;
}

/**
 * STYLE001: no-mix-dearu-desumasu
 *
 * ですます調とだ・である調が同一文書内で混在している場合に警告する。
 * 両スタイルとも全体の 10% 以上検出された場合のみ警告
 * （引用・コメントアウト等による意図的な少量混用を除外するため）。
 * 少数派スタイルの行に対して警告を出す（最大 5 件）。
 */
export function checkMixDearuDesumasu(
  lines: string[],
  codeBlockMask: boolean[],
  frontMatterEnd: number,
): ProseLintIssue[] {
  const issues: ProseLintIssue[] = [];
  const desuMasuLines: number[] = []; // 1-based 行番号
  const daDearuLines: number[] = [];  // 1-based 行番号

  for (let i = frontMatterEnd; i < lines.length; i++) {
    if (codeBlockMask[i]) continue;
    const line = removeInlineCode(lines[i] ?? '');
    if (line.trim() === '') continue;
    if (isHeadingLine(line)) continue;

    // 文末記号で区切られた各文に対してスタイルを判定
    const sentences = line.split(/(?<=[。！？])/);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      if (DESU_MASU_ENDING.test(trimmed)) {
        if (!desuMasuLines.includes(i + 1)) desuMasuLines.push(i + 1);
      } else if (DA_DEARU_ENDING.test(trimmed)) {
        if (!daDearuLines.includes(i + 1)) daDearuLines.push(i + 1);
      }
    }
  }

  const total = desuMasuLines.length + daDearuLines.length;
  if (total === 0) return issues;

  const desuMasuRatio = desuMasuLines.length / total;
  const daDearuRatio = daDearuLines.length / total;

  // 両スタイルとも 10% 以上検出された場合のみ警告
  if (desuMasuRatio < 0.1 || daDearuRatio < 0.1) return issues;

  // 少数派スタイルに対して警告を出す（最大 5 件）
  const minorityLines =
    desuMasuLines.length <= daDearuLines.length ? desuMasuLines : daDearuLines;
  const minorityStyle =
    desuMasuLines.length <= daDearuLines.length ? 'ですます調' : 'だ・である調';

  for (const lineNum of minorityLines.slice(0, 5)) {
    issues.push({
      ruleId: 'STYLE001',
      message: `文体が混在しています。この行は${minorityStyle}ですが、文書全体では別のスタイルが多く使われています。`,
      line: lineNum,
      column: 0,
      severity: 'warning',
    });
  }

  return issues;
}

/**
 * STYLE002: ja-no-weak-phrase
 *
 * 弱い表現（かもしれません、と思います等）を検出する。
 * コードブロック・インラインコード内はスキップ。
 */
export function checkWeakPhrase(
  lines: string[],
  codeBlockMask: boolean[],
  frontMatterEnd: number,
): ProseLintIssue[] {
  const issues: ProseLintIssue[] = [];

  for (let i = frontMatterEnd; i < lines.length; i++) {
    if (codeBlockMask[i]) continue;
    const line = removeInlineCode(lines[i] ?? '');
    if (line.trim() === '') continue;

    for (const { pattern, message } of WEAK_PHRASES) {
      const globalPattern = new RegExp(pattern.source, 'g');
      let match: RegExpExecArray | null;
      while ((match = globalPattern.exec(line)) !== null) {
        issues.push({
          ruleId: 'STYLE002',
          message,
          line: i + 1,
          column: match.index + 1,
          severity: 'info',
        });
      }
    }
  }

  return issues;
}

/**
 * STYLE003: ja-no-redundant-expression
 *
 * 冗長な表現（することができる、を行う等）を検出し、改善提案を付ける。
 * コードブロック・インラインコード内はスキップ。
 */
export function checkRedundantExpression(
  lines: string[],
  codeBlockMask: boolean[],
  frontMatterEnd: number,
): ProseLintIssue[] {
  const issues: ProseLintIssue[] = [];

  for (let i = frontMatterEnd; i < lines.length; i++) {
    if (codeBlockMask[i]) continue;
    const line = removeInlineCode(lines[i] ?? '');
    if (line.trim() === '') continue;

    for (const { pattern, message, suggestion } of REDUNDANT_EXPRESSIONS) {
      const globalPattern = new RegExp(pattern.source, 'g');
      let match: RegExpExecArray | null;
      while ((match = globalPattern.exec(line)) !== null) {
        issues.push({
          ruleId: 'STYLE003',
          message,
          line: i + 1,
          column: match.index + 1,
          severity: 'info',
          suggestion,
        });
      }
    }
  }

  return issues;
}

/**
 * STYLE004: no-doubled-wo
 *
 * 一文内で格助詞「を」が 15 文字以内に 2 回使われている場合に警告する。
 * 日本語では通常一つの節に「を」は一度しか現れないため、
 * 重複は文の構造的な問題を示していることが多い。
 * コードブロック・インラインコード内はスキップ。
 */
export function checkDoubledWo(
  lines: string[],
  codeBlockMask: boolean[],
  frontMatterEnd: number,
): ProseLintIssue[] {
  const issues: ProseLintIssue[] = [];

  for (let i = frontMatterEnd; i < lines.length; i++) {
    if (codeBlockMask[i]) continue;
    const rawLine = removeInlineCode(lines[i] ?? '');
    if (rawLine.trim() === '') continue;
    if (isHeadingLine(rawLine)) continue;

    // 文ごとに分割して検査
    const sentences = rawLine.split(/[。！？]/);
    let sentenceStart = 0;

    for (const sentence of sentences) {
      if (sentence.trim() !== '') {
        // 「を」の出現位置を収集
        const positions: number[] = [];
        for (let j = 0; j < sentence.length; j++) {
          if (sentence[j] === 'を') {
            positions.push(j);
          }
        }

        // 15 文字以内に「を」が 2 回以上ある場合
        for (let k = 0; k < positions.length - 1; k++) {
          const posA = positions[k] ?? 0;
          const posB = positions[k + 1] ?? 0;
          if (posB - posA <= 15) {
            issues.push({
              ruleId: 'STYLE004',
              message: '「を」が近接して 2 回使われています。文の構造を見直してください。',
              line: i + 1,
              column: sentenceStart + posA + 1,
              severity: 'warning',
            });
            break; // 同じ文で 1 件だけ報告
          }
        }
      }
      sentenceStart += sentence.length + 1; // +1 for 文末記号
    }
  }

  return issues;
}

// ─── メインエントリポイント ─────────────────────────────────────

/**
 * Markdown テキストの文体を検査し、問題のある箇所をリポートする。
 *
 * @param markdown - 検査する Markdown テキスト
 * @returns 問題一覧と集計
 */
export function lintProse(markdown: string): ProseLintResult {
  if (!markdown.trim()) {
    return { issues: [], errorCount: 0, warningCount: 0, infoCount: 0 };
  }

  const lines = markdown.split('\n');
  const frontMatterEnd = getFrontMatterEndLine(lines);
  const codeBlockMask = buildCodeBlockMask(lines);

  const allIssues: ProseLintIssue[] = [
    ...checkSentenceLength(lines, codeBlockMask, frontMatterEnd),
    ...checkMixDearuDesumasu(lines, codeBlockMask, frontMatterEnd),
    ...checkWeakPhrase(lines, codeBlockMask, frontMatterEnd),
    ...checkRedundantExpression(lines, codeBlockMask, frontMatterEnd),
    ...checkDoubledWo(lines, codeBlockMask, frontMatterEnd),
  ];

  // 行番号・列番号でソート
  allIssues.sort((a, b) => a.line - b.line || a.column - b.column);

  return {
    issues: allIssues,
    errorCount: allIssues.filter((i) => i.severity === 'error').length,
    warningCount: allIssues.filter((i) => i.severity === 'warning').length,
    infoCount: allIssues.filter((i) => i.severity === 'info').length,
  };
}
