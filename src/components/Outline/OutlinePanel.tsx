/**
 * アウトラインパネル（見出しナビゲーション）
 *
 * editor-ux-design.md §3 に準拠:
 * - TipTap の onUpdate でリアルタイムに見出しを抽出
 * - クリックで対応ブロックへスクロール + フォーカス
 * - 現在位置のハイライト（セレクション変化を追跡）
 * - フィルタ入力で見出しテキストを絞り込み
 * - 見出しレベルに応じたインデント表示
 */

import type React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Editor } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface HeadingItem {
  id: string;
  level: number;
  text: string;
  pos: number;
}

interface OutlinePanelProps {
  editor: Editor | null;
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
  // カーソルより前にある最も近い見出しを探す
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

export function OutlinePanel({ editor }: OutlinePanelProps) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [filter, setFilter] = useState('');

  // 見出しの抽出（エディタ更新時）
  useEffect(() => {
    if (!editor) {
      setHeadings([]);
      return;
    }

    const updateHeadings = () => {
      const extracted = extractHeadings(editor);
      setHeadings(extracted);
    };

    // 初回抽出
    updateHeadings();

    // エディタ更新時に再抽出
    editor.on('update', updateHeadings);
    return () => {
      editor.off('update', updateHeadings);
    };
  }, [editor]);

  // 現在位置のハイライト（セレクション変化時）
  useEffect(() => {
    if (!editor || headings.length === 0) return;

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
  }, [editor, headings]);

  // クリックでジャンプ
  const scrollToHeading = useCallback(
    (pos: number) => {
      if (!editor) return;

      // カーソルを見出しの先頭に設定してフォーカス
      editor.chain().focus().setTextSelection(pos + 1).run();

      // スクロールはエディタ側で自動的に行われるが、
      // 念のため明示的にスクロール
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

  // フィルタ適用
  const filteredHeadings = useMemo(() => {
    if (!filter) return headings;
    const lower = filter.toLowerCase();
    return headings.filter((h: HeadingItem) => h.text.toLowerCase().includes(lower));
  }, [headings, filter]);

  if (!editor) {
    return (
      <div className="outline-panel__empty">
        <p>エディタを開いてください</p>
      </div>
    );
  }

  if (headings.length === 0) {
    return (
      <div className="outline-panel__empty">
        <p>見出しがありません</p>
        <p className="outline-panel__hint">
          # を入力して見出しを作成してください
        </p>
      </div>
    );
  }

  return (
    <div className="outline-panel" role="navigation" aria-label="ドキュメントアウトライン">
      {/* フィルタ入力 */}
      <div className="outline-panel__filter">
        <input
          type="text"
          placeholder="フィルタ..."
          value={filter}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
          className="outline-panel__filter-input"
          aria-label="アウトラインフィルタ"
        />
      </div>

      {/* 見出しリスト */}
      <ul className="outline-panel__list" role="tree">
        {filteredHeadings.map((heading: HeadingItem) => {
          // 元のheadingsでのインデックスを探して currentIndex と比較
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
                className={`outline-panel__item ${isCurrent ? 'outline-panel__item--current' : ''}`}
                style={{ paddingLeft: `${(heading.level - 1) * 12 + 8}px` }}
                onClick={() => scrollToHeading(heading.pos)}
                title={heading.text}
              >
                <span className="outline-panel__level">
                  H{heading.level}
                </span>
                <span className="outline-panel__text">
                  {heading.text || '(空の見出し)'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {filter && filteredHeadings.length === 0 && (
        <div className="outline-panel__empty">
          <p>「{filter}」に一致する見出しがありません</p>
        </div>
      )}
    </div>
  );
}
