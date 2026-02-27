/**
 * TipTap エディタコンポーネント
 *
 * Phase 1 対応要素:
 * - 見出し (H1-H6)
 * - 段落
 * - 太字・斜体
 * - リスト（箇条書き・番号付き）
 * - インラインコード
 * - コードブロック
 * - 引用
 * - 水平線
 * - リンク
 *
 * CLAUDE.md 制約:
 * - IME 入力中の isComposing ガード
 * - パフォーマンスバジェット (入力レイテンシ < 16ms)
 */

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useCallback, useEffect, useRef } from 'react';
import { useIMEComposition } from './useIMEComposition';
import { SmartPasteExtension } from '../../extensions/SmartPasteExtension';
import { markdownToTipTap } from '../../lib/markdown-to-tiptap';
import { tiptapToMarkdown } from '../../lib/tiptap-to-markdown';
import type { TipTapDoc } from '../../lib/markdown-to-tiptap';

export interface EditorProps {
  /** 初期 Markdown テキスト */
  initialContent?: string;
  /** コンテンツ変更時のコールバック (Markdown テキスト) */
  onContentChange?: (markdown: string) => void;
  /** 読み取り専用モード */
  readOnly?: boolean;
  /** プレースホルダーテキスト */
  placeholder?: string;
}

export function MarkdownEditor({
  initialContent = '',
  onContentChange,
  readOnly = false,
  placeholder = '入力を開始...',
}: EditorProps) {
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: { languageClassPrefix: 'language-' },
        // StarterKit v3 に含まれる Link を無効化し、個別設定版を使用
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          // リンク属性のフィルタリング: target/rel を付与しない
          // (markdown-tiptap-conversion.md §7 に準拠)
          target: null,
          rel: null,
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TaskList,
      TaskItem.configure({
        nested: true, // ネストしたタスクリストを許可
      }),
      SmartPasteExtension,
    ],
    editable: !readOnly,
    // IME 入力中にトランザクションを発行しない
    editorProps: {
      handleKeyDown(_view, event) {
        // IME 変換中の Enter キーは ProseMirror に渡さない
        if (event.isComposing || event.keyCode === 229) {
          return false;
        }
        return false;
      },
    },
  });

  const ime = useIMEComposition(editor);

  // 初期コンテンツの設定
  useEffect(() => {
    if (!editor || !initialContent) return;

    const doc = markdownToTipTap(initialContent);
    editor.commands.setContent(doc as unknown as Record<string, unknown>);
  }, [editor, initialContent]);

  // コンテンツ変更の監視
  useEffect(() => {
    if (!editor) return;

    const handler = () => {
      // IME 変換中はシリアライズしない (markdown-tiptap-conversion.md §9)
      if (!ime.canProcess()) return;

      const json = editor.getJSON() as unknown as TipTapDoc;
      const markdown = tiptapToMarkdown(json);
      onContentChangeRef.current?.(markdown);
    };

    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
    };
  }, [editor, ime]);

  // 外部から Markdown を設定するメソッド
  const setMarkdown = useCallback(
    (markdown: string) => {
      if (!editor) return;
      const doc = markdownToTipTap(markdown);
      editor.commands.setContent(doc as unknown as Record<string, unknown>);
    },
    [editor],
  );

  // 現在の Markdown を取得するメソッド
  const getMarkdown = useCallback((): string | null => {
    if (!editor) return null;
    // IME 変換中はシリアライズしない
    if (!ime.canProcess()) return null;

    const json = editor.getJSON() as unknown as TipTapDoc;
    return tiptapToMarkdown(json);
  }, [editor, ime]);

  if (!editor) return null;

  return (
    <div className="editor-container flex flex-col h-full">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto px-8 py-4">
        <EditorContent
          editor={editor}
          className="prose prose-neutral max-w-none focus:outline-none"
        />
      </div>
      <EditorHandle setMarkdown={setMarkdown} getMarkdown={getMarkdown} />
    </div>
  );
}

/**
 * 外部から setMarkdown / getMarkdown を呼ぶための非表示コンポーネント。
 * 親コンポーネントが ref 的にアクセスする場合に使用。
 */
function EditorHandle(_props: {
  setMarkdown: (md: string) => void;
  getMarkdown: () => string | null;
}) {
  return null;
}

/**
 * 簡易ツールバー (Phase 1)
 */
function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  return (
    <div className="editor-toolbar flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
      <ToolbarButton
        label="B"
        title="太字 (Ctrl+B)"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="I"
        title="斜体 (Ctrl+I)"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className="italic"
      />
      <ToolbarButton
        label="S"
        title="取り消し線"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className="line-through"
      />
      <ToolbarButton
        label="<>"
        title="インラインコード"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <ToolbarDivider />
      {([1, 2, 3] as const).map((level) => (
        <ToolbarButton
          key={level}
          label={`H${level}`}
          title={`見出し${level} (Ctrl+Alt+${level})`}
          active={editor.isActive('heading', { level })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level }).run()
          }
        />
      ))}
      <ToolbarDivider />
      <ToolbarButton
        label="UL"
        title="箇条書きリスト"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="OL"
        title="番号付きリスト"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        label="Quote"
        title="引用"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        label="Code"
        title="コードブロック"
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ToolbarDivider />
      <ToolbarButton
        label="—"
        title="水平線"
        active={false}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />
    </div>
  );
}

function ToolbarButton({
  label,
  title,
  active,
  onClick,
  className = '',
}: {
  label: string;
  title: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`px-2 py-1 text-sm rounded transition-colors ${className} ${
        active
          ? 'bg-blue-100 text-blue-700 font-semibold'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-gray-300 mx-1" />;
}

export default MarkdownEditor;
