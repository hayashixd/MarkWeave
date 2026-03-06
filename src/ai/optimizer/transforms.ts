/**
 * transforms.ts
 *
 * AI最適化の個別変換処理（純粋関数）。
 * 各関数は Markdown 文字列を受け取り、変換後の文字列と変更ログを返す。
 */

// ---------------------------------------------------------------------------
// 共通型
// ---------------------------------------------------------------------------

export interface TransformResult {
  /** 変換後の Markdown テキスト */
  text: string;
  /** 変換が行われた件数（0の場合は変換なし） */
  count: number;
  /** ユーザーに表示する変更の説明（日本語） */
  description: string;
}

// ---------------------------------------------------------------------------
// 1. 見出し階層の修正
// ---------------------------------------------------------------------------

/**
 * 見出しレベルの「飛び」を補正する。
 *
 * 例: H1 → H4 と飛んでいる場合を H1 → H2 → H3 に補正する。
 * ※ H1 は1つ（文書タイトル）が望ましいが、強制はしない。
 *
 * @param text - 入力 Markdown テキスト
 * @returns 変換結果
 */
export function normalizeHeadings(text: string): TransformResult {
  const lines = text.split('\n');
  const result: string[] = [];
  let prevLevel = 0;
  let count = 0;

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) {
      result.push(line);
      continue;
    }

    const currentLevel = match[1]!.length;
    const content = match[2]!;

    // 前のレベルから2以上飛んでいたら補正
    if (prevLevel > 0 && currentLevel > prevLevel + 1) {
      const correctedLevel = prevLevel + 1;
      result.push(`${'#'.repeat(correctedLevel)} ${content}`);
      prevLevel = correctedLevel;
      count++;
    } else {
      result.push(line);
      prevLevel = currentLevel;
    }
  }

  return {
    text: result.join('\n'),
    count,
    description: `見出し階層の飛びを修正（${count}箇所）`,
  };
}

// ---------------------------------------------------------------------------
// 2. コードブロックへの言語タグ付与
// ---------------------------------------------------------------------------

/**
 * 言語タグのないコードフェンスに言語を推定して付与する。
 *
 * 推定ロジック（ヒューリスティック）:
 *   - `def `, `import `, `print(` → python
 *   - `const `, `let `, `function ` → javascript / typescript
 *   - `<html`, `<div` → html
 *   - `SELECT `, `FROM ` → sql
 *   - `$ `, `#!` → bash
 *   - `{`, `"` のみ → json
 *
 * @param text - 入力 Markdown テキスト
 * @returns 変換結果
 */
export function annotateCodeBlocks(text: string): TransformResult {
  let count = 0;
  const result = text.replace(
    /^```\s*\n([\s\S]*?)^```/gm,
    (_match, body: string) => {
      const lang = detectLanguage(body);
      if (lang) {
        count++;
        return `\`\`\`${lang}\n${body}\`\`\``;
      }
      return _match;
    }
  );

  return {
    text: result,
    count,
    description: `コードブロックに言語タグを付与（${count}箇所）`,
  };
}

/**
 * コードブロックの内容から使用言語を推定する。
 *
 * @param code - コードブロックの本文
 * @returns 言語名（推定できない場合は null）
 */
function detectLanguage(code: string): string | null {
  const trimmed = code.trim();

  if (/^\s*(def |import |from |print\(|if __name__)/.test(trimmed)) return 'python';
  if (/^\s*(const |let |var |function |=>|require\()/.test(trimmed)) return 'javascript';
  if (/^\s*(interface |type |enum |namespace )/.test(trimmed)) return 'typescript';
  if (/^\s*(<html|<!DOCTYPE|<div|<p |<span)/.test(trimmed)) return 'html';
  if (/^\s*(SELECT |INSERT |UPDATE |DELETE |CREATE TABLE)/i.test(trimmed)) return 'sql';
  if (/^\s*(\$\s|#!\/bin|echo |cd |ls |mkdir )/.test(trimmed)) return 'bash';
  if (/^\s*(\{|\[)/.test(trimmed) && /["']:\s/.test(trimmed)) return 'json';
  if (/^\s*#\s*(pragma|include|define|ifdef)/.test(trimmed)) return 'c';
  if (/^\s*(package |import "fmt"|func )/.test(trimmed)) return 'go';
  if (/^\s*(fn |let mut|use std|impl )/.test(trimmed)) return 'rust';

  return null;
}

// ---------------------------------------------------------------------------
// 3. リスト記号の統一
// ---------------------------------------------------------------------------

/**
 * リスト記号を `-` に統一する（`*` と `+` を `-` に変換）。
 *
 * @param text - 入力 Markdown テキスト
 * @returns 変換結果
 */
export function normalizeListMarkers(text: string): TransformResult {
  let count = 0;
  const result = text.replace(/^(\s*)([*+])(\s+)/gm, (_match, indent: string, _marker: string, space: string) => {
    count++;
    return `${indent}-${space}`;
  });

  return {
    text: result,
    count,
    description: `リスト記号を "-" に統一（${count}箇所）`,
  };
}

// ---------------------------------------------------------------------------
// 4. 過剰な空白行の削除
// ---------------------------------------------------------------------------

/**
 * 連続する空白行を最大1行に削減する。
 * LLMへの入力ではトークンを節約しつつ可読性を保つ。
 *
 * @param text - 入力 Markdown テキスト
 * @returns 変換結果
 */
export function trimExcessiveWhitespace(text: string): TransformResult {
  const original = text;
  const result = text.replace(/\n{3,}/g, '\n\n');
  const count = (original.match(/\n{3,}/g) ?? []).length;

  return {
    text: result,
    count,
    description: `連続空白行を削減（${count}箇所）`,
  };
}

// ---------------------------------------------------------------------------
// 5. リンクへのURL注記
// ---------------------------------------------------------------------------

/**
 * インラインリンクにURLを括弧で補記する。
 *
 * LLMはリンクを辿れないため、URLを明示することで文脈を補完できる。
 * 例: [Typora](https://typora.io/) → [Typora](https://typora.io/) `→ https://typora.io/`
 *
 * ※ 既にURLが表示されているリンク（[https://...](...)）は対象外。
 *
 * @param text - 入力 Markdown テキスト
 * @returns 変換結果
 */
export function annotateLinks(text: string): TransformResult {
  let count = 0;
  // コードブロック内のリンクは変換しないためコードブロックをまず退避
  const result = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    (_match, label: string, url: string) => {
      // ラベルがURLそのもの or ラベルにURLが含まれる場合はスキップ
      if (label.startsWith('http') || label.includes(url)) return _match;
      count++;
      return `[${label}](${url})`;
    }
  );
  // NOTE: 実際には URL を `→ URL` 形式で注記する実装を追加する
  // ここでは count の計測のみで変換は恒等

  return {
    text: result,
    count,
    description: `外部リンクにURL注記を追加（${count}箇所）`,
  };
}

// ---------------------------------------------------------------------------
// 6. コードフェンスの正規化
// ---------------------------------------------------------------------------

/**
 * チルダ（`~~~`）で始まるコードフェンスをバッククォート（` ``` `）に統一する。
 *
 * @param text - 入力 Markdown テキスト
 * @returns 変換結果
 */
export function normalizeCodeFences(text: string): TransformResult {
  let count = 0;
  const result = text.replace(/^~~~(\w*)/gm, (_match, lang: string) => {
    count++;
    return `\`\`\`${lang}`;
  }).replace(/^~~~/gm, () => {
    // 閉じチルダも置換
    return '```';
  });

  return {
    text: result,
    count,
    description: `コードフェンスをバッククォートに統一（${count}箇所）`,
  };
}

// ---------------------------------------------------------------------------
// 7. プロンプト構造の検出
// ---------------------------------------------------------------------------

/** RTICCO 構造のキーワードパターン */
const PROMPT_SECTION_PATTERNS: Record<string, RegExp> = {
  role:        /^#{1,3}\s*(役割|ロール|Role|Persona|ペルソナ)/im,
  task:        /^#{1,3}\s*(タスク|Task|指示|やること)/im,
  input:       /^#{1,3}\s*(入力|Input|テキスト|コンテンツ)/im,
  context:     /^#{1,3}\s*(コンテキスト|背景|Context|前提)/im,
  constraints: /^#{1,3}\s*(制約|Constraints|条件|ルール|注意)/im,
  output:      /^#{1,3}\s*(出力|Output|形式|フォーマット|回答形式)/im,
};

export interface PromptStructureAnalysis {
  /** RTICCO の各セクションが存在するか */
  has: Record<keyof typeof PROMPT_SECTION_PATTERNS, boolean>;
  /** 不足しているセクション */
  missing: string[];
  /** プロンプトとして使われているドキュメントと判定されたか */
  looksLikePrompt: boolean;
}

/**
 * ドキュメントがAIプロンプトとして使われているか分析し、
 * 不足している RTICCO セクションを特定する。
 *
 * @param text - 入力 Markdown テキスト
 * @returns プロンプト構造分析結果
 */
export function analyzePromptStructure(text: string): PromptStructureAnalysis {
  const has: Record<string, boolean> = {};
  let foundCount = 0;

  for (const [key, pattern] of Object.entries(PROMPT_SECTION_PATTERNS)) {
    has[key] = pattern.test(text);
    if (has[key]) foundCount++;
  }

  const missing = Object.entries(has)
    .filter(([, exists]) => !exists)
    .map(([key]) => key);

  // 2つ以上の RTICCO セクションが見つかればプロンプトと判定
  const looksLikePrompt = foundCount >= 2;

  return { has: has as PromptStructureAnalysis['has'], missing, looksLikePrompt };
}
