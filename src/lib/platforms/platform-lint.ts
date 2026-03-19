/**
 * プラットフォーム別 Markdown 本文 Lint
 *
 * 公開先プラットフォームに対して不適切な記法を検出し、
 * ユーザーに警告を表示するためのエンジン。
 */

import type { Platform } from '../platform-detector';

export type PlatformLintSeverity = 'error' | 'warning' | 'info';

export interface PlatformLintIssue {
  severity: PlatformLintSeverity;
  message: string;
}

/**
 * タイトル文字列をプラットフォームに対して lint し、問題点のリストを返す。
 *
 * @param title    - 記事タイトル
 * @param platform - 対象プラットフォーム
 */
export function lintPlatformTitle(title: string, platform: Platform): PlatformLintIssue[] {
  if (platform === 'generic') return [];
  const issues: PlatformLintIssue[] = [];
  if (title.length > 60) {
    issues.push({
      severity: 'warning',
      message: `タイトルが${title.length}文字です（60文字以内を推奨）`,
    });
  }
  return issues;
}

/**
 * 本文 Markdown をプラットフォームに対して lint し、問題点のリストを返す。
 *
 * @param body     - 本文 Markdown（Front Matter なし）
 * @param platform - 対象プラットフォーム
 */
export function lintPlatformBody(body: string, platform: Platform): PlatformLintIssue[] {
  if (platform === 'generic') return [];

  const issues: PlatformLintIssue[] = [];

  if (platform === 'qiita') {
    // Zenn 固有ブロック記法
    if (/^:::message(?:\s|$)/m.test(body)) {
      issues.push({ severity: 'warning', message: ':::message ブロックは Qiita では表示されません' });
    }
    if (/^:::details(?:\s|$)/m.test(body)) {
      issues.push({ severity: 'warning', message: ':::details アコーディオンは Qiita では表示されません' });
    }

    // @[...] 埋め込み記法（Zenn 固有）
    const embedPatterns: Array<[RegExp, string]> = [
      [/@\[youtube\]/m, '@[youtube] 動画埋め込みは Qiita では使用できません'],
      [/@\[tweet\]/m, '@[tweet] 埋め込みは Qiita では使用できません'],
      [/@\[speakerdeck\]/m, '@[speakerdeck] 埋め込みは Qiita では使用できません'],
      [/@\[codesandbox\]/m, '@[codesandbox] 埋め込みは Qiita では使用できません'],
    ];
    for (const [re, msg] of embedPatterns) {
      if (re.test(body)) {
        issues.push({ severity: 'warning', message: msg });
      }
    }

    // Mermaid（Qiita 非対応）
    if (/^```mermaid\b/m.test(body)) {
      issues.push({ severity: 'warning', message: 'Mermaid 図は Qiita では表示されません' });
    }

    // 脚注（Qiita 非対応）
    if (/\[\^[^\]]+\]/.test(body)) {
      issues.push({ severity: 'info', message: '脚注は Qiita ではサポートされていません' });
    }
  }

  return issues;
}
