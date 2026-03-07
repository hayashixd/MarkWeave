/**
 * YAML Front Matter パーサ・シリアライザ
 *
 * editor-ux-design.md §1 に準拠。
 * remark-frontmatter を使わず、シンプルな正規表現で処理する。
 */

export interface FrontMatterResult {
  /** `---` ブロック内の生 YAML テキスト（`---` 行は含まない） */
  yaml: string;
  /** Front Matter を除いた本文 Markdown */
  body: string;
}

/**
 * Markdown 先頭の YAML Front Matter を抽出する。
 * Front Matter がない場合は `{ yaml: '', body: markdown }` を返す。
 */
export function parseFrontMatter(markdown: string): FrontMatterResult {
  // `---\n...\n---` の形式（Unix/Windows 改行どちらにも対応）
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) return { yaml: '', body: markdown };
  return {
    yaml: match[1] ?? '',
    body: match[2] ?? '',
  };
}

/**
 * YAML と本文を結合して完全な Markdown を生成する。
 */
export function serializeFrontMatter(yaml: string, body: string): string {
  if (!yaml.trim()) return body;
  return `---\n${yaml}\n---\n${body}`;
}

/**
 * YAML テキストからサマリー文字列を生成する（折りたたみ時の表示用）。
 * 例: "My Post | 2026-03-07 | #markdown #editor"
 */
export function getYamlSummary(yaml: string): string {
  const parts: string[] = [];

  const titleMatch = yaml.match(/^title:\s*(.+)$/m);
  if (titleMatch) {
    parts.push(titleMatch[1].trim().replace(/^['"]|['"]$/g, ''));
  }

  const dateMatch = yaml.match(/^date:\s*(.+)$/m);
  if (dateMatch) {
    parts.push(dateMatch[1].trim());
  }

  const tagsInlineMatch = yaml.match(/^tags:\s*\[(.+)\]$/m);
  if (tagsInlineMatch) {
    const tags = tagsInlineMatch[1]
      .split(',')
      .map((t) => '#' + t.trim().replace(/^['"]|['"]$/g, ''))
      .join(' ');
    parts.push(tags);
  }

  // リスト形式 tags: \n  - tag
  if (!tagsInlineMatch) {
    const tagsBlockMatch = yaml.match(/^tags:\s*\n((?:[ \t]*-[ \t].+\n?)+)/m);
    if (tagsBlockMatch) {
      const tags = tagsBlockMatch[1]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('- '))
        .map((l) => '#' + l.slice(2).trim())
        .join(' ');
      parts.push(tags);
    }
  }

  return parts.join(' · ') || 'フロントマター';
}

/**
 * YAML テキストから主要フィールドの型付きオブジェクトを取得する。
 * 用途: Front Matter パネルでの構造化表示
 */
export interface ParsedFrontMatterFields {
  title?: string;
  date?: string;
  tags?: string[];
  draft?: boolean;
  description?: string;
}

export function parseYamlFields(yaml: string): ParsedFrontMatterFields {
  const result: ParsedFrontMatterFields = {};

  const titleMatch = yaml.match(/^title:\s*(.+)$/m);
  if (titleMatch) result.title = titleMatch[1].trim().replace(/^['"]|['"]$/g, '');

  const dateMatch = yaml.match(/^date:\s*(.+)$/m);
  if (dateMatch) result.date = dateMatch[1].trim();

  const draftMatch = yaml.match(/^draft:\s*(true|false)$/m);
  if (draftMatch) result.draft = draftMatch[1] === 'true';

  const descMatch = yaml.match(/^description:\s*(.+)$/m);
  if (descMatch) result.description = descMatch[1].trim().replace(/^['"]|['"]$/g, '');

  // インライン配列 tags: [a, b]
  const tagsInline = yaml.match(/^tags:\s*\[(.+)\]$/m);
  if (tagsInline) {
    result.tags = tagsInline[1].split(',').map((t) => t.trim().replace(/^['"]|['"]$/g, ''));
  }

  // ブロック配列 tags:\n  - a\n  - b
  if (!result.tags) {
    const tagsBlock = yaml.match(/^tags:\s*\n((?:[ \t]*-[ \t].+\n?)+)/m);
    if (tagsBlock) {
      result.tags = tagsBlock[1]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('- '))
        .map((l) => l.slice(2).trim());
    }
  }

  return result;
}
