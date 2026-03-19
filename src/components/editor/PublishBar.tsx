/**
 * 公開バー（PublishBar）
 *
 * プラットフォームが Zenn / Qiita として検出された場合にエディタ上部に常時表示される
 * 薄いバー。フロントマターパネルを展開しなくても Markdown をコピーできる。
 *
 * - プラットフォームバッジ（Zenn / Qiita）
 * - 「Markdown をコピー」ボタン
 * - Zenn 記事の場合のみ「Qiita 用に変換してコピー」ボタン
 */

import { useCallback } from 'react';
import { useToastStore } from '../../store/toastStore';
import {
  buildMarkdownWithFrontMatter,
  convertZennToQiitaMarkdown,
  validateBeforeCopy,
} from '../../lib/platforms/platform-copy';

interface PublishBarProps {
  platform: 'zenn' | 'qiita';
  yaml: string;
  getBodyMarkdown: () => string;
}

export function PublishBar({ platform, yaml, getBodyMarkdown }: PublishBarProps) {
  const showToast = useToastStore((s) => s.show);

  const handleCopy = useCallback(async () => {
    const validationError = validateBeforeCopy(platform, yaml);
    if (validationError) {
      showToast('error', validationError);
      return;
    }
    const body = getBodyMarkdown();
    const md = buildMarkdownWithFrontMatter(yaml, body);
    try {
      await navigator.clipboard.writeText(md);
      showToast('success', 'クリップボードにコピーしました');
    } catch {
      showToast('error', 'コピーに失敗しました');
    }
  }, [platform, yaml, getBodyMarkdown, showToast]);

  const handleConvertAndCopy = useCallback(async () => {
    const validationError = validateBeforeCopy('zenn', yaml);
    if (validationError) {
      showToast('error', validationError);
      return;
    }
    const body = getBodyMarkdown();
    const md = convertZennToQiitaMarkdown(yaml, body);
    try {
      await navigator.clipboard.writeText(md);
      showToast('success', 'Qiita 用 Markdown をコピーしました');
    } catch {
      showToast('error', 'コピーに失敗しました');
    }
  }, [yaml, getBodyMarkdown, showToast]);

  return (
    <div
      className="publish-bar flex items-center gap-2 px-3 py-1 border-b bg-gray-50 border-gray-200"
      role="toolbar"
      aria-label="公開操作バー"
    >
      {/* プラットフォームバッジ */}
      <span
        className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
          platform === 'zenn'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-green-100 text-green-700'
        }`}
      >
        {platform === 'zenn' ? '⚡ Zenn' : '🗂 Qiita'}
      </span>

      {/* Markdown コピー */}
      <button
        type="button"
        onClick={handleCopy}
        className="text-xs px-2.5 py-0.5 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:border-gray-400 transition-colors flex-shrink-0"
        title={`${platform === 'zenn' ? 'Zenn' : 'Qiita'} 用 Markdown をコピー`}
      >
        📋 Markdown をコピー
      </button>

      {/* Zenn → Qiita 変換コピー（Zenn のみ） */}
      {platform === 'zenn' && (
        <button
          type="button"
          onClick={handleConvertAndCopy}
          className="text-xs px-2.5 py-0.5 rounded border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-colors flex-shrink-0"
          title="Zenn 固有記法を除去して Qiita 用にコピー"
        >
          ⇄ Qiita 用に変換してコピー
        </button>
      )}
    </div>
  );
}
