/**
 * HTML WYSIWYG エディタコンポーネント
 *
 * Phase 5: HTML ファイルを Markdown と同様の直感的な操作で編集する。
 *
 * 3つのモードを提供:
 * - WYSIWYG: レンダリング結果を見ながら編集
 * - ソース: 生 HTML を直接編集（シンタックスハイライト + 補完）
 * - スプリット: ソース / プレビュー 並列表示
 *
 * 設計書: docs/05_Features/HTML/html-editing-design.md §3, §4, §7
 */

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCellWithStyle, TableHeaderWithStyle } from '../../extensions/TableCellWithStyle';
import Image from '@tiptap/extension-image';
import { common, createLowlight } from 'lowlight';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIMEComposition } from './useIMEComposition';
import {
  HighlightMark,
  SuperscriptMark,
  SubscriptMark,
  TextColorMark,
  BackgroundColorMark,
  FontSizeMark,
  TextAlignExtension,
  DivBlockNode,
  SemanticBlockNode,
} from '../../extensions/HtmlExtensions';
import { htmlToTipTap } from '../../lib/html-to-tiptap';
import type { HtmlMetadata } from '../../lib/html-to-tiptap';
import { tiptapToHtml } from '../../lib/tiptap-to-html';
import type { TipTapDoc } from '../../lib/markdown-to-tiptap';
import { HtmlSourceEditor } from './HtmlSourceEditor';
import { HtmlSplitView } from './HtmlSplitView';
import { HtmlToolbar } from './HtmlToolbar';
import { MetadataPanel } from '../HtmlMeta/MetadataPanel';
import type { HtmlMetadata as MetaPanelMeta } from '../../core/parser/html-parser';

export type HtmlEditorMode = 'wysiwyg' | 'source' | 'split';

export interface HtmlEditorProps {
  /** 初期 HTML テキスト */
  initialContent?: string;
  /** コンテンツ変更時のコールバック (HTML テキスト) */
  onContentChange?: (html: string) => void;
  /** 読み取り専用モード */
  readOnly?: boolean;
  /** エディタインスタンス作成後のコールバック */
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void;
}

export function HtmlEditor({
  initialContent = '',
  onContentChange,
  readOnly = false,
  onEditorReady,
}: HtmlEditorProps) {
  const [mode, setMode] = useState<HtmlEditorMode>('wysiwyg');
  const [sourceText, setSourceText] = useState(initialContent);
  const [metadata, setMetadata] = useState<HtmlMetadata>({
    title: '',
    metaDescription: '',
    cssLinks: [],
    scriptLinks: [],
  });
  const [metadataPanelOpen, setMetadataPanelOpen] = useState(false);
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false,
        link: false,
      }),
      CodeBlockLowlight.configure({
        lowlight: createLowlight(common),
        languageClassPrefix: 'language-',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: null, rel: null },
      }),
      Placeholder.configure({
        placeholder: 'HTML コンテンツを入力してください...',
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCellWithStyle,
      TableHeaderWithStyle,
      Image.configure({ inline: true, allowBase64: true }),
      // HTML 固有拡張
      HighlightMark,
      SuperscriptMark,
      SubscriptMark,
      TextColorMark,
      BackgroundColorMark,
      FontSizeMark,
      TextAlignExtension,
      DivBlockNode,
      SemanticBlockNode,
    ],
    editable: !readOnly,
    editorProps: {
      handleKeyDown(_view, event) {
        if (event.isComposing || event.keyCode === 229) {
          return false;
        }
        return false;
      },
    },
  });

  const ime = useIMEComposition(editor);

  // エディタ準備完了時にコールバック
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // 初期コンテンツの設定
  useEffect(() => {
    if (!editor || !initialContent) return;

    const result = htmlToTipTap(initialContent);
    editor.commands.setContent(
      result.doc as unknown as Record<string, unknown>,
    );
    setMetadata(result.metadata);
    setSourceText(initialContent);
  }, [editor, initialContent]);

  // コンテンツ変更の監視（WYSIWYG モード）
  useEffect(() => {
    if (!editor) return;

    const handler = () => {
      if (!ime.canProcess()) return;

      const json = editor.getJSON() as unknown as TipTapDoc;
      const html = tiptapToHtml(json, metadata);
      onContentChangeRef.current?.(html);
    };

    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
    };
  }, [editor, ime, metadata]);

  // モード切替
  const switchMode = useCallback(
    (newMode: HtmlEditorMode) => {
      if (!editor) return;

      if (mode === 'wysiwyg' && newMode !== 'wysiwyg') {
        // WYSIWYG → ソース/スプリット: TipTap → HTML
        const json = editor.getJSON() as unknown as TipTapDoc;
        const html = tiptapToHtml(json, metadata);
        setSourceText(html);
      } else if (mode !== 'wysiwyg' && newMode === 'wysiwyg') {
        // ソース/スプリット → WYSIWYG: HTML → TipTap
        const result = htmlToTipTap(sourceText);
        editor.commands.setContent(
          result.doc as unknown as Record<string, unknown>,
        );
        setMetadata(result.metadata);
        onContentChangeRef.current?.(sourceText);
      }

      setMode(newMode);
    },
    [editor, mode, sourceText, metadata],
  );

  // Ctrl+/ でモード切替
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        // WYSIWYG → Source → Split → WYSIWYG のサイクル
        const nextMode: Record<HtmlEditorMode, HtmlEditorMode> = {
          wysiwyg: 'source',
          source: 'split',
          split: 'wysiwyg',
        };
        switchMode(nextMode[mode]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [switchMode, mode]);

  // ソースモードでのテキスト変更
  const handleSourceTextChange = useCallback(
    (value: string) => {
      setSourceText(value);
      onContentChangeRef.current?.(value);
    },
    [],
  );

  // メタデータ変更ハンドラ
  const handleMetadataChange = useCallback(
    (updated: MetaPanelMeta) => {
      const newMeta: HtmlMetadata = {
        title: updated.title,
        metaDescription: updated.description,
        cssLinks: updated.cssLinks,
        scriptLinks: updated.jsLinks,
      };
      setMetadata(newMeta);
      // メタデータ変更もコンテンツ変更として通知
      if (editor && mode === 'wysiwyg') {
        const json = editor.getJSON() as unknown as TipTapDoc;
        const html = tiptapToHtml(json, newMeta);
        onContentChangeRef.current?.(html);
      }
    },
    [editor, mode],
  );

  // エディタ領域のクリックでフォーカスを設定
  const handleEditorAreaClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!editor) return;
      if (e.target === e.currentTarget || e.target === editorWrapperRef.current) {
        editor.chain().focus('end').run();
      }
    },
    [editor],
  );

  if (!editor) return null;

  // MetadataPanel 用に変換
  const metaPanelData: MetaPanelMeta = {
    title: metadata.title,
    description: metadata.metaDescription,
    cssLinks: metadata.cssLinks,
    jsLinks: metadata.scriptLinks,
  };

  return (
    <div className="editor-container flex flex-col h-full">
      {/* HTML 専用ツールバー */}
      <HtmlToolbar
        editor={editor}
        mode={mode}
        onSwitchMode={switchMode}
        onToggleMetadata={() => setMetadataPanelOpen((v) => !v)}
        metadataOpen={metadataPanelOpen}
      />

      {/* メタデータパネル */}
      {metadataPanelOpen && (
        <div className="border-b border-gray-200 bg-gray-50 flex-shrink-0 max-h-64 overflow-auto">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">ページ設定</h3>
            <button
              type="button"
              onClick={() => setMetadataPanelOpen(false)}
              aria-label="ページ設定を閉じる"
              className="text-gray-400 hover:text-gray-600 transition-colors w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3.17 3.17a.5.5 0 01.7 0L6 5.3l2.13-2.13a.5.5 0 01.7.7L6.71 6l2.12 2.13a.5.5 0 01-.7.7L6 6.71 3.87 8.83a.5.5 0 01-.7-.7L5.3 6 3.17 3.87a.5.5 0 010-.7z" />
              </svg>
            </button>
          </div>
          <div className="px-4 pb-3">
            <MetadataPanel
              metadata={metaPanelData}
              onChange={handleMetadataChange}
            />
          </div>
        </div>
      )}

      {/* エディタ本体 */}
      {mode === 'wysiwyg' ? (
        <div
          ref={editorWrapperRef}
          className="flex-1 overflow-y-auto cursor-text relative"
          onClick={handleEditorAreaClick}
        >
          <div className="max-w-[800px] mx-auto px-12 py-8">
            <EditorContent
              editor={editor}
              className="prose prose-neutral max-w-none focus:outline-none"
            />
          </div>
        </div>
      ) : mode === 'source' ? (
        <HtmlSourceEditor
          value={sourceText}
          onChange={handleSourceTextChange}
          readOnly={readOnly}
        />
      ) : (
        <HtmlSplitView
          value={sourceText}
          onChange={handleSourceTextChange}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
