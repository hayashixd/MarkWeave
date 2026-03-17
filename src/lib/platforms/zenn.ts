/**
 * Zenn Front Matter の型定義・パース・シリアライズ
 *
 * Zenn 記事の標準 frontmatter:
 *   title: "記事タイトル"
 *   emoji: "📝"
 *   type: "tech"   # tech | idea
 *   topics: ["typescript", "react"]
 *   published: false
 */

export interface ZennFrontmatter {
  title: string;
  emoji: string;
  type: 'tech' | 'idea';
  topics: string[];
  published: boolean;
}

export const ZENN_DEFAULTS: ZennFrontmatter = {
  title: '',
  emoji: '📝',
  type: 'tech',
  topics: [],
  published: false,
};

/**
 * YAML 文字列から Zenn Front Matter を解析する。
 * 存在しないフィールドはデフォルト値で補完する。
 */
export function parseZennFrontmatter(yaml: string): ZennFrontmatter {
  const titleMatch = yaml.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const emojiMatch = yaml.match(/^emoji:\s*["']?(.+?)["']?\s*$/m);
  const typeMatch = yaml.match(/^type:\s*["']?(tech|idea)["']?\s*$/m);
  const publishedMatch = yaml.match(/^published:\s*(true|false)\s*$/m);

  let topics: string[] = [];

  // インライン配列: topics: ["a", "b"]
  const topicsInline = yaml.match(/^topics:\s*\[([^\]]*)\]\s*$/m);
  if (topicsInline) {
    const raw = topicsInline[1]!.trim();
    if (raw) {
      topics = raw
        .split(',')
        .map((t) => t.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }
  } else {
    // ブロックリスト: topics:\n  - typescript
    const topicsBlock = yaml.match(/^topics:\s*\n((?:[ \t]+-[ \t].+\n?)+)/m);
    if (topicsBlock) {
      topics = topicsBlock[1]!
        .split('\n')
        .map((l) => l.replace(/^[ \t]+-[ \t]/, '').trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }
  }

  return {
    title: titleMatch?.[1]?.replace(/^["']|["']$/g, '').trim() ?? '',
    emoji: emojiMatch?.[1]?.replace(/^["']|["']$/g, '').trim() ?? '📝',
    type: (typeMatch?.[1] as 'tech' | 'idea') ?? 'tech',
    topics,
    published: publishedMatch?.[1] === 'true',
  };
}

/**
 * Zenn Front Matter オブジェクトを YAML 文字列にシリアライズする。
 */
export function serializeZennFrontmatter(fm: ZennFrontmatter): string {
  const topicsStr =
    fm.topics.length > 0
      ? `[${fm.topics.map((t) => `"${t}"`).join(', ')}]`
      : '[]';
  return [
    `title: "${fm.title}"`,
    `emoji: "${fm.emoji}"`,
    `type: "${fm.type}"`,
    `topics: ${topicsStr}`,
    `published: ${fm.published}`,
  ].join('\n');
}
