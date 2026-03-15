/**
 * 外部リンクの安全な開き方（security-design.md §4.3 準拠）
 *
 * TipTap エディタ内の <a href="..."> クリックをインターセプトし、
 * 外部 URL は OS のデフォルトブラウザで開く。
 * WebView 内でのページ遷移を防止する。
 */

import { useEffect } from 'react';
import { open } from '@tauri-apps/plugin-shell';

/**
 * エディタ領域内のリンククリックをインターセプトする。
 * - http/https リンク → OS ブラウザで開く
 * - # アンカーリンク → エディタ内スクロール
 * - javascript: URL → 無視（DOMPurify が除去するが念のため）
 */
export function useExternalLinkHandler(containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // javascript: URL は完全にブロック
      if (href.toLowerCase().startsWith('javascript:')) {
        event.preventDefault();
        return;
      }

      // 外部 URL は OS ブラウザで開く
      if (href.startsWith('http://') || href.startsWith('https://')) {
        event.preventDefault();
        open(href).catch((err) => {
          console.error('外部リンクを開けませんでした:', err);
        });
        return;
      }

      // アンカーリンクはエディタ内スクロール
      if (href.startsWith('#')) {
        event.preventDefault();
        const targetId = href.slice(1);
        const targetEl = container.querySelector(`[id="${CSS.escape(targetId)}"]`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
        return;
      }

      // その他のスキーム（mailto: 等）も OS に委譲
      if (href.includes(':')) {
        event.preventDefault();
        open(href).catch((err) => {
          console.error('リンクを開けませんでした:', err);
        });
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [containerRef]);
}
