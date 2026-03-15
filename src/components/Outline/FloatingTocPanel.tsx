/**
 * フローティング TOC パネル（右サイドに固定表示する目次）
 *
 * feature-list.md Phase 7「知識管理強化」に準拠:
 * - 右サイドに固定表示する目次パネル
 * - OutlinePanel と同様の見出し抽出・ナビゲーション機能を提供
 * - 現在位置のハイライト
 * - クリックでジャンプ
 * - 折りたたみトグル
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

interface HeadingItem {
  id: string;
  level: number;
  text: string;
  pos: number;
}

interface FloatingTocPanelProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
}

/** テキストからスラッグを生成 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '');
}

/** エディタから見出しを抽出する */
function extractHeadings(editor: Editor): HeadingItem[] {
  const headings: HeadingItem[] = [];
  editor.state.doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.type.name === 'heading') {
      headings.push({
        id: slugify(node.textContent) || `heading-${pos}`,
        level: node.attrs.level as number,
        text: node.textContent,
        pos,
      });
    }
  });
  return headings;
}

/** カーソル位置が含まれる見出しのインデックスを返す */
function findCurrentHeadingIndex(
  headings: HeadingItem[],
  cursorPos: number,
): number {
  let lastIndex = -1;
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    if (heading && heading.pos <= cursorPos) {
      lastIndex = i;
    } else {
      break;
    }
  }
  return lastIndex;
}

export function FloatingTocPanel({ editor, isOpen, onClose }: FloatingTocPanelProps) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const panelRef = useRef<HTMLDivElement>(null);

  // 見出しの抽出（エディタ更新時）
  useEffect(() => {
    if (!editor || !isOpen) {
      setHeadings([]);
      return;
    }

    const updateHeadings = () => {
      const extracted = extractHeadings(editor);
      setHeadings(extracted);
    };

    updateHeadings();
    editor.on('update', updateHeadings);
    return () => {
      editor.off('update', updateHeadings);
    };
  }, [editor, isOpen]);

  // 現在位置のハイライト（セレクション変化時）
  useEffect(() => {
    if (!editor || headings.length === 0 || !isOpen) return;

    const updateCurrent = () => {
      const { from } = editor.state.selection;
      const index = findCurrentHeadingIndex(headings, from);
      setCurrentIndex(index);
    };

    updateCurrent();
    editor.on('selectionUpdate', updateCurrent);
    return () => {
      editor.off('selectionUpdate', updateCurrent);
    };
  }, [editor, headings, isOpen]);

  // 現在の見出しが表示領域内にスクロールされるようにする
  useEffect(() => {
    if (currentIndex < 0 || !panelRef.current) return;
    const list = panelRef.current.querySelector('.floating-toc__list');
    if (!list) return;
    const items = list.querySelectorAll('[role="treeitem"]');
    const currentItem = items[currentIndex];
    if (currentItem) {
      currentItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentIndex]);

  // クリックでジャンプ
  const scrollToHeading = useCallback(
    (pos: number) => {
      if (!editor) return;
      editor.chain().focus().setTextSelection(pos + 1).run();

      requestAnimationFrame(() => {
        try {
          const coords = editor.view.coordsAtPos(pos);
          if (coords) {
            const editorDom = editor.view.dom as HTMLElement;
            const scrollParent =
              editorDom.closest('.overflow-y-auto') ?? editorDom.parentElement;
            if (scrollParent) {
              const rect = scrollParent.getBoundingClientRect();
              scrollParent.scrollTo({
                top:
                  scrollParent.scrollTop +
                  coords.top -
                  rect.top -
                  rect.height / 4,
                behavior: 'smooth',
              });
            }
          }
        } catch {
          // スクロール失敗は無視
        }
      });
    },
    [editor],
  );

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="floating-toc"
      role="navigation"
      aria-label="目次"
    >
      {/* ヘッダー */}
      <div className="floating-toc__header">
        <span className="floating-toc__title">目次</span>
        <button
          type="button"
          className="floating-toc__close"
          onClick={onClose}
          aria-label="目次を閉じる"
          title="目次を閉じる"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* コンテンツ */}
      {!editor ? (
        <div className="floating-toc__empty">
          <p>エディタを開いてください</p>
        </div>
      ) : headings.length === 0 ? (
        <div className="floating-toc__empty">
          <p>見出しがありません</p>
        </div>
      ) : (
        <ul className="floating-toc__list" role="tree">
          {headings.map((heading: HeadingItem) => {
            const originalIndex = headings.indexOf(heading);
            const isCurrent = originalIndex === currentIndex;

            return (
              <li
                key={`${heading.pos}-${heading.id}`}
                role="treeitem"
                aria-current={isCurrent ? 'location' : undefined}
              >
                <button
                  type="button"
                  className={`floating-toc__item ${isCurrent ? 'floating-toc__item--current' : ''}`}
                  style={{ paddingLeft: `${(heading.level - 1) * 10 + 8}px` }}
                  onClick={() => scrollToHeading(heading.pos)}
                  title={heading.text}
                >
                  <span className="floating-toc__text">
                    {heading.text || '(空の見出し)'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
