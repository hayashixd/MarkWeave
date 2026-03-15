/**
 * Typora 式フォーカス時ソース表示 TipTap 拡張
 *
 * system-design.md §2.2 / typora-analysis.md §2.1 に準拠。
 *
 * カーソルが存在するブロック（段落・見出し等）に対して、
 * インラインマークの Markdown デリミタ（**、*、~~、`、[]() 等）を
 * ProseMirror Widget Decoration で表示する。
 * カーソルが離れると即座にデリミタが非表示になりレンダリング表示に戻る。
 *
 * 対象マーク:
 *   - bold:   **text**
 *   - italic: *text*
 *   - strike: ~~text~~
 *   - code:   `text`
 *   - link:   [text](url)
 *
 * 対象ブロックプレフィックス:
 *   - heading: # (レベル数に応じた # を表示)
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorState } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode, Mark } from '@tiptap/pm/model';

const pluginKey = new PluginKey('typoraFocus');

// マーク種別ごとのデリミタ定義とソート優先度
// 優先度が低いほど外側に配置される（bold が最外側）
const MARK_CONFIG: Record<string, { open: string; close: (mark: Mark) => string; priority: number }> = {
  bold: {
    open: '**',
    close: () => '**',
    priority: 0,
  },
  italic: {
    open: '*',
    close: () => '*',
    priority: 1,
  },
  strike: {
    open: '~~',
    close: () => '~~',
    priority: 2,
  },
  code: {
    open: '`',
    close: () => '`',
    priority: 3,
  },
  link: {
    open: '[',
    close: (mark: Mark) => `](${(mark.attrs.href as string) || ''})`,
    priority: 4,
  },
};

/**
 * カーソル位置から最も近い textblock ノードを取得する。
 * 段落、見出し、テーブルセル内の段落などが対象。
 */
function getFocusedTextblock(
  state: EditorState,
): { pos: number; node: ProseMirrorNode } | null {
  const { $head } = state.selection;
  for (let d = $head.depth; d >= 1; d--) {
    const node = $head.node(d);
    if (node.isTextblock) {
      return { pos: $head.before(d), node };
    }
  }
  return null;
}

/**
 * マーク範囲情報。ブロック内で連続する同一マークの開始・終了位置を保持する。
 */
interface MarkRange {
  markName: string;
  mark: Mark;
  from: number; // absolute document position
  to: number; // absolute document position
}

/**
 * ブロックノード内のすべてのマーク範囲を収集する。
 *
 * テキストノードを順に走査し、マークの開始と終了を検出する。
 * インラインアトムノード（mathInline 等）に付与されたマークも考慮し、
 * マーク範囲が途切れないようにする。
 */
function collectMarkRanges(
  blockNode: ProseMirrorNode,
  blockPos: number,
): MarkRange[] {
  const ranges: MarkRange[] = [];
  const contentStart = blockPos + 1;

  // アクティブなマークとその開始位置を追跡
  const activeMarks = new Map<string, { mark: Mark; from: number }>();

  blockNode.forEach((child: ProseMirrorNode, offset: number) => {
    const absPos = contentStart + offset;
    const childMarkNames = new Set(child.marks.map((m: Mark) => m.type.name));

    // 現在のノードに存在しないマークは閉じる
    for (const [key, info] of activeMarks) {
      if (!childMarkNames.has(key)) {
        ranges.push({
          markName: key,
          mark: info.mark,
          from: info.from,
          to: absPos,
        });
        activeMarks.delete(key);
      }
    }

    // 新しいマークを開く
    for (const mark of child.marks) {
      const name = mark.type.name;
      if (name in MARK_CONFIG && !activeMarks.has(name)) {
        activeMarks.set(name, { mark, from: absPos });
      }
    }
  });

  // ブロック末尾で残っているマークを閉じる
  const contentEnd = contentStart + blockNode.content.size;
  for (const [key, info] of activeMarks) {
    ranges.push({
      markName: key,
      mark: info.mark,
      from: info.from,
      to: contentEnd,
    });
  }

  return ranges;
}

/**
 * Widget Decoration を生成するヘルパー。
 */
function createDelimiterWidget(
  pos: number,
  text: string,
  side: number,
  key: string,
): Decoration {
  return Decoration.widget(
    pos,
    () => {
      const span = document.createElement('span');
      span.className = 'typora-focus-delimiter';
      span.textContent = text;
      return span;
    },
    { side, key },
  );
}

/**
 * 現在のエディタ状態からフォーカスブロックのデコレーションを計算する。
 */
function createDecorations(state: EditorState): DecorationSet {
  const focused = getFocusedTextblock(state);
  if (!focused) return DecorationSet.empty;

  const { pos: blockPos, node: blockNode } = focused;
  const decos: Decoration[] = [];

  // --- 見出しプレフィックス ---
  if (blockNode.type.name === 'heading') {
    const level = blockNode.attrs.level as number;
    const prefix = '#'.repeat(level) + ' ';
    decos.push(
      Decoration.widget(
        blockPos + 1,
        () => {
          const span = document.createElement('span');
          span.className = 'typora-focus-prefix';
          span.textContent = prefix;
          return span;
        },
        { side: -100, key: `heading-prefix-${blockPos}` },
      ),
    );
  }

  // --- インラインマークデリミタ ---
  const markRanges = collectMarkRanges(blockNode, blockPos);

  for (const range of markRanges) {
    const config = MARK_CONFIG[range.markName];
    if (!config) continue;

    const openText = config.open;
    const closeText = config.close(range.mark);

    // 開きデリミタ: フォーカスブロック内、マーク範囲の先頭
    // side を priority に基づいて設定（外側のマークが先に表示される）
    const openSide = -(50 - config.priority);
    decos.push(
      createDelimiterWidget(
        range.from,
        openText,
        openSide,
        `${range.markName}-open-${range.from}`,
      ),
    );

    // 閉じデリミタ: マーク範囲の末尾
    // 閉じは逆順（内側のマークが先に閉じる）
    const closeSide = 50 - config.priority;
    decos.push(
      createDelimiterWidget(
        range.to,
        closeText,
        closeSide,
        `${range.markName}-close-${range.to}`,
      ),
    );
  }

  return DecorationSet.create(state.doc, decos);
}

/**
 * Typora 式フォーカスソース表示拡張。
 *
 * WYSIWYG モードでカーソルが存在するブロックに対して、
 * Markdown のソースマーカーを decoration で表示する。
 */
export const TyporaFocusExtension = Extension.create({
  name: 'typoraFocus',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,

        state: {
          init(_: unknown, state: EditorState): DecorationSet {
            return createDecorations(state);
          },

          apply(
            tr: { docChanged: boolean; selectionSet: boolean },
            oldDecos: DecorationSet,
            _oldState: EditorState,
            newState: EditorState,
          ): DecorationSet {
            // ドキュメント変更またはセレクション変更時のみ再計算
            if (tr.docChanged || tr.selectionSet) {
              return createDecorations(newState);
            }
            return oldDecos;
          },
        },

        props: {
          decorations(state: EditorState): DecorationSet {
            return pluginKey.getState(state) as DecorationSet;
          },
        },
      }),
    ];
  },
});
