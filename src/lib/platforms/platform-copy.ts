/**
 * プラットフォーム向けコピー・変換ユーティリティ
 *
 * - buildMarkdownWithFrontMatter: YAML + 本文を結合した完全な Markdown を生成
 * - convertZennBodyToQiita: Zenn 固有記法を除去して Qiita 向けに変換
 * - convertZennToQiitaMarkdown: YAML + 本文を一括で Zenn→Qiita 変換
 */

import { parseZennFrontmatter } from './zenn';
import { serializeQiitaFrontmatter } from './qiita';
import type { QiitaFrontmatter } from './qiita';

/**
 * YAML Front Matter と本文を結合した完全な Markdown を返す。
 * クリップボードへのコピーや Qiita CLI 向けエクスポートに使用する。
 */
export function buildMarkdownWithFrontMatter(yaml: string, body: string): string {
  if (!yaml.trim()) return body;
  return `---\n${yaml}\n---\n\n${body}`;
}

/**
 * Zenn 固有記法を Qiita 向けに変換する（本文のみ）。
 *
 * - :::message / :::details ブロック → 内容を保持してブロック記法を除去
 * - @[youtube] / @[tweet] / @[speakerdeck] / @[codesandbox] 埋め込みを除去
 */
export function convertZennBodyToQiita(body: string): string {
  let result = body;

  // :::message (alert) ブロック → 内容のみ保持
  result = result.replace(
    /^:::message(?:\s+alert)?\n([\s\S]*?)^:::\n?/gm,
    (_match: string, content: string) => content,
  );

  // :::details タイトル ブロック → 内容のみ保持
  result = result.replace(
    /^:::details[^\n]*\n([\s\S]*?)^:::\n?/gm,
    (_match: string, content: string) => content,
  );

  // @[...] 埋め込みを除去
  result = result.replace(/^@\[(?:youtube|tweet|speakerdeck|codesandbox)\]\([^)]*\)\n?/gm, '');

  return result;
}

/**
 * Zenn 記事（YAML + 本文）を Qiita 向け Markdown に変換する。
 *
 * - YAML: Zenn frontmatter → Qiita frontmatter（title / topics → tags）
 * - 本文: Zenn 固有記法を除去
 */
export function convertZennToQiitaMarkdown(zennYaml: string, body: string): string {
  const zennFm = parseZennFrontmatter(zennYaml);
  const qiitaFm: QiitaFrontmatter = {
    title: zennFm.title,
    tags: zennFm.topics.slice(0, 5),
    private: false,
  };
  const qiitaYaml = serializeQiitaFrontmatter(qiitaFm);
  const convertedBody = convertZennBodyToQiita(body);
  return buildMarkdownWithFrontMatter(qiitaYaml, convertedBody);
}
