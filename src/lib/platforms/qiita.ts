/**
 * Qiita Front Matter の型定義・パース・シリアライズ
 *
 * Qiita 記事の標準 frontmatter (Qiita CLI 形式):
 *   title: 記事タイトル
 *   tags:
 *     - name: TypeScript
 *     - name: React
 *   private: false
 */

export interface QiitaFrontmatter {
  title: string;
  tags: string[];
  private: boolean;
  /** チーム記事（Qiita Team / Organization 向け）。true のときのみ YAML に出力 */
  coediting?: boolean;
}

export const QIITA_DEFAULTS: QiitaFrontmatter = {
  title: '',
  tags: [],
  private: false,
};

/**
 * YAML 文字列から Qiita Front Matter を解析する。
 * 存在しないフィールドはデフォルト値で補完する。
 */
export function parseQiitaFrontmatter(yaml: string): QiitaFrontmatter {
  const titleMatch = yaml.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const privateMatch = yaml.match(/^private:\s*(true|false)\s*$/m);
  const coeditingMatch = yaml.match(/^coediting:\s*(true|false)\s*$/m);

  let tags: string[] = [];
  // tags:\n  - name: TypeScript 形式
  const tagsSection = yaml.match(/^tags:\s*\n((?:[ \t]+-[ \t]+name:[ \t]*.+\n?)+)/m);
  if (tagsSection) {
    tags = tagsSection[1]!
      .split('\n')
      .map((l) => l.match(/^\s+-\s+name:\s*["']?(.+?)["']?\s*$/)?.[1]?.trim() ?? '')
      .filter(Boolean);
  }

  return {
    title: titleMatch?.[1]?.replace(/^["']|["']$/g, '').trim() ?? '',
    tags,
    private: privateMatch?.[1] === 'true',
    coediting: coeditingMatch ? coeditingMatch[1] === 'true' : undefined,
  };
}

/**
 * Qiita Front Matter オブジェクトを YAML 文字列にシリアライズする。
 */
export function serializeQiitaFrontmatter(fm: QiitaFrontmatter): string {
  const tagsStr =
    fm.tags.length > 0
      ? `tags:\n${fm.tags.map((t) => `  - name: ${t}`).join('\n')}`
      : 'tags: []';
  const lines = [`title: "${fm.title}"`, tagsStr, `private: ${fm.private}`];
  if (fm.coediting) lines.push(`coediting: true`);
  return lines.join('\n');
}
