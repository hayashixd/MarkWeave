/**
 * TipTap エディタコンポーネント
 *
 * Phase 1 対応要素:
 * - 見出し (H1-H6)
 * - 段落
 * - 太字・斜体
 * - リスト（箇条書き・番号付き）
 * - インラインコード
 * - コードブロック（シンタックスハイライト）
 * - 引用
 * - 水平線
 * - リンク
 * - タスクリスト
 * - ソースモード切替（Ctrl+/）
 *
 * Phase 2 対応要素:
 * - テーブル（Tab/Shift+Tab セル移動、行・列操作コンテキストメニュー）
 *
 * Phase 3 対応要素:
 * - 検索・置換（Ctrl+F / Ctrl+H）
 * - アウトラインパネル（見出し抽出・ジャンプ）
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
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCellWithStyle, TableHeaderWithStyle } from '../../extensions/TableCellWithStyle';
import { TableDragExtension } from '../../extensions/TableDragExtension';
import { common, createLowlight } from 'lowlight';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIMEComposition } from './useIMEComposition';
import { SmartPasteExtension } from '../../extensions/SmartPasteExtension';
import { SafeInputRulesExtension } from '../../extensions/SafeInputRulesExtension';
import { markdownToTipTap } from '../../lib/markdown-to-tiptap';
import { tiptapToMarkdown } from '../../lib/tiptap-to-markdown';
import { IncrementalSerializer } from '../../lib/incremental-serialize';
import type { TipTapDoc } from '../../lib/markdown-to-tiptap';
import { TableContextMenu } from '../Table/TableContextMenu';
import type { TableContextMenuState } from '../Table/TableContextMenu';
import { SearchExtension } from '../../extensions/SearchExtension';
import { SearchBar } from '../Search/SearchBar';
import { QuickOpenModal } from '../QuickOpen/QuickOpenModal';
import { GoToLineDialog } from '../GoToLine/GoToLineDialog';
import { TextStatsDialog } from '../TextStats/TextStatsDialog';
import Image from '@tiptap/extension-image';
import { MathInline, MathBlock } from '../../extensions/MathExtension';
import { MermaidBlock } from '../../extensions/MermaidExtension';
import { ImageDropPasteExtension } from '../../extensions/ImageDropPasteExtension';
import { ImageAnnotationExtension } from '../../extensions/ImageAnnotationExtension';
import type { ImageAnnotationEvent } from '../../extensions/ImageAnnotationExtension';
import { ImageAnnotationModal } from '../ImageAnnotation';
import { TEXT_TRANSFORM_COMMANDS } from '../../core/text-transform';
import { BookmarkExtension } from '../../extensions/BookmarkExtension';
import { WordCompleteExtension } from '../../extensions/WordCompleteExtension';
import { SmartPasteBar } from '../SmartPaste/SmartPasteBar';
import type { SmartPasteAskEvent } from '../../extensions/SmartPasteExtension';
import { htmlToMarkdown } from '../../core/converter/smart-paste';
import { markdownToTipTap as mdToTipTapForPaste } from '../../lib/markdown-to-tiptap';
import { SourceEditor } from './SourceEditor';
import { useToastStore } from '../../store/toastStore';
import { AiCopyButton } from '../AiPanel/AiCopyButton';
import { TyporaFocusExtension } from '../../extensions/TyporaFocusExtension';
import { FocusModeExtension } from '../../extensions/FocusModeExtension';
import { useSettingsStore } from '../../store/settingsStore';
import {
  SlashCommandsExtension,
  type SlashCommandState,
} from '../../extensions/SlashCommandsExtension';
import { SlashCommandMenu } from '../SlashCommands/SlashCommandMenu';
import { FrontMatterPanel } from './FrontMatterPanel';
import { parseFrontMatter, serializeFrontMatter } from '../../lib/frontmatter';
import { WikilinkExtension, type WikilinkAutoState } from '../../extensions/WikilinkExtension';
import { WikilinkPopup } from './WikilinkPopup';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useRecentFilesStore } from '../../store/recentFilesStore';
import { AmbientSoundControl } from './AmbientSoundControl';
import { typewriterPlayer } from '../../lib/typewriter-sound';
import { VirtualScrollExtension } from '../../extensions/VirtualScrollExtension';
import { GitGutterIndicator } from './GitGutterIndicator';
import { useTabStore } from '../../store/tabStore';

export type EditorMode = 'wysiwyg' | 'source';

const LARGE_FILE_SOURCE_MODE_THRESHOLD_BYTES = 3 * 1024 * 1024;
/** performance-design.md §2: ノード数が閾値を超えたらソースモードに切替 */
const LARGE_FILE_NODE_COUNT_THRESHOLD = 3000;

export interface EditorProps {
  /** 初期 Markdown テキスト */
  initialContent?: string;
  /** コンテンツ変更時のコールバック (Markdown テキスト) */
  onContentChange?: (markdown: string) => void;
  /** 読み取り専用モード */
  readOnly?: boolean;
  /** プレースホルダーテキスト */
  placeholder?: string;
  /** エディタインスタンス作成後のコールバック（外部からアクセスするため） */
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void;
}

export function MarkdownEditor({
  initialContent = '',
  onContentChange,
  readOnly = false,
  placeholder = 'ここに入力を始めてください...\n\nヒント: ツールバーのボタンや、# + スペースで見出し、- + スペースでリスト、> + スペースで引用を作成できます。',
  onEditorReady,
}: EditorProps) {
  const [mode, setMode] = useState<EditorMode>('wysiwyg');

  // YAML Front Matter を本文から分離して管理
  const { yaml: initYaml } = parseFrontMatter(initialContent);
  const [frontMatterYaml, setFrontMatterYaml] = useState(initYaml);
  // Front Matter なしの本文を initialContent として使う
  const [sourceText, setSourceText] = useState(initialContent);
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;
  const lastEmittedContentRef = useRef<string>(initialContent);
  const suppressNextUpdateRef = useRef(0);
  const incrementalSerializerRef = useRef(new IncrementalSerializer());
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  // フロントマター変更時に参照するために ref に保持
  const frontMatterYamlRef = useRef(frontMatterYaml);
  frontMatterYamlRef.current = frontMatterYaml;

  // 集中モード系の設定を取得
  const { settings, updateSettings } = useSettingsStore();
  const focusMode = settings.editor.focusMode;
  const typewriterMode = settings.editor.typewriterMode;

  // Git ガター差分インジケーター用（Phase 7.5）
  const workspaceRootForGit = useWorkspaceStore((s) => s.root);
  const activeTabFilePath = useTabStore((s) => {
    const activeId = s.activeTabId;
    return s.tabs.find((t) => t.id === activeId)?.filePath ?? null;
  });

  // 検索バーの状態
  const [searchVisible, setSearchVisible] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  // クイックオープンの状態
  const [quickOpenVisible, setQuickOpenVisible] = useState(false);

  // 行番号ジャンプの状態
  const [goToLineVisible, setGoToLineVisible] = useState(false);

  // 文書統計ダイアログの状態
  const [textStatsVisible, setTextStatsVisible] = useState(false);

  const showToast = useToastStore((s) => s.show);

  // スマートペースト ask モードの状態
  const [smartPasteData, setSmartPasteData] = useState<SmartPasteAskEvent | null>(null);

  // スラッシュコマンドの状態
  const [slashState, setSlashState] = useState<SlashCommandState>({
    active: false,
    query: '',
    from: -1,
    coords: null,
  });

  // 画像アノテーションの状態 (Phase 7.5)
  const [annotationTarget, setAnnotationTarget] = useState<{
    src: string;
    filePath: string;
  } | null>(null);

  // Wikilink オートコンプリートの状態
  const [wikilinkAutoState, setWikilinkAutoState] = useState<WikilinkAutoState>({
    active: false,
    query: '',
    from: -1,
    coords: null,
  });

  // ワークスペースのファイル一覧をオートコンプリート候補として使う
  const { tree } = useWorkspaceStore();
  const { recentFiles } = useRecentFilesStore();

  // ファイル一覧をフラット化
  const workspaceFiles = (() => {
    const files: { name: string; path: string }[] = [];
    const walk = (nodes: typeof tree) => {
      for (const node of nodes) {
        if (node.type === 'file') {
          files.push({ name: node.name, path: node.path });
        } else if (node.children) {
          walk(node.children);
        }
      }
    };
    walk(tree);
    return files;
  })();

  // LRU ソート: 最近開いたファイルを先頭に
  const recentPathSet = new Map<string, number>(
    recentFiles.map((r, i): [string, number] => [r.path, i]),
  );
  const wikilinkCandidates = [...workspaceFiles].sort((a, b) => {
    const ai: number = recentPathSet.get(a.path) ?? Infinity;
    const bi: number = recentPathSet.get(b.path) ?? Infinity;
    return ai - bi;
  });

  // Wikilink 解決状態チェック用: 拡張子なしファイル名の Set
  const resolvedFileNames = new Set(
    workspaceFiles.map((f) => f.name.replace(/\.(md|html|txt)$/i, '').toLowerCase()),
  );

  // テーブルコンテキストメニューの状態
  const [tableMenu, setTableMenu] = useState<TableContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
  });
  const closeTableMenu = useCallback(() => {
    setTableMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        // StarterKit の codeBlock を無効化し、CodeBlockLowlight を使用
        codeBlock: false,
        // StarterKit v3 に含まれる Link を無効化し、個別設定版を使用
        link: false,
      }),
      CodeBlockLowlight.configure({
        lowlight: createLowlight(common),
        languageClassPrefix: 'language-',
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
      Table.configure({
        resizable: true, // Phase 2: 列幅リサイズ（ドラッグ）を有効化
      }),
      TableRow,
      TableCellWithStyle,
      TableHeaderWithStyle,
      TableDragExtension,
      SmartPasteExtension,
      SearchExtension,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      ImageDropPasteExtension,
      ImageAnnotationExtension,
      MathInline,
      MathBlock,
      MermaidBlock,
      BookmarkExtension,
      WordCompleteExtension,
      TyporaFocusExtension,
      FocusModeExtension.configure({ enabled: focusMode }),
      ...(settings.slashCommands?.enabled !== false
        ? [SlashCommandsExtension.configure({ onStateChange: setSlashState })]
        : []),
      VirtualScrollExtension.configure({ nodeThreshold: 500 }),
      WikilinkExtension.configure({
        onLinkClick: (target) => {
          window.dispatchEvent(new CustomEvent('open-wikilink', { detail: { target } }));
        },
        onAutoStateChange: setWikilinkAutoState,
        isTargetResolved: (target) => {
          if (resolvedFileNames.size === 0) return true; // ワークスペース未読込時は中立
          return resolvedFileNames.has(target.toLowerCase());
        },
      }),
      // IME ガード付きオートフォーマット (system-design.md §4.3)
      SafeInputRulesExtension,
    ],
    editable: !readOnly,
    // IME 入力中にトランザクションを発行しない
    editorProps: {
      // contenteditable 要素の ARIA 属性 (accessibility-design.md §2.2)
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'ドキュメント編集エリア',
      },
      handleKeyDown(view, event) {
        // IME 変換中の Enter キーは ProseMirror に渡さない
        if (event.isComposing || event.keyCode === 229) {
          return false;
        }

        // Ctrl+K: リンク挿入 (keyboard-shortcuts.md §1-1)
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key === 'k' &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          window.dispatchEvent(new CustomEvent('editor-link-insert'));
          return true;
        }

        // Ctrl+0〜6: 見出しレベル / 段落 (keyboard-shortcuts.md §1-2)
        if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
          const key = event.key;
          if (key >= '1' && key <= '6') {
            event.preventDefault();
            const level = parseInt(key) as 1 | 2 | 3 | 4 | 5 | 6;
            const editorInstance = view.state;
            // ProseMirror の dispatch を使って見出し切替
            const { tr } = editorInstance;
            if (tr) {
              // TipTap の chain API は view からは直接使えないため、
              // カスタムイベントで editor インスタンスに伝播させる
              window.dispatchEvent(new CustomEvent('editor-heading', { detail: { level } }));
            }
            return true;
          }
          if (key === '0') {
            event.preventDefault();
            window.dispatchEvent(new CustomEvent('editor-heading', { detail: { level: 0 } }));
            return true;
          }
        }

        return false;
      },
    },
  });

  const ime = useIMEComposition(editor);

  const applyExternalMarkdownToEditor = useCallback(
    (markdown: string) => {
      if (!editor) return;

      const doc = markdownToTipTap(markdown || '');

      // 外部からコンテンツが完全に置き換わるためキャッシュを無効化
      incrementalSerializerRef.current.invalidate();

      // setContent 起点の update イベントを 1 回だけ抑止し、
      // 親 state との往復更新ループを防ぐ
      suppressNextUpdateRef.current += 1;
      try {
        editor.commands.setContent(doc as unknown as Record<string, unknown>);
      } catch (error) {
        suppressNextUpdateRef.current = Math.max(0, suppressNextUpdateRef.current - 1);
        throw error;
      }
    },
    [editor],
  );

  // エディタ準備完了時にコールバック通知
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Ctrl+F / Ctrl+H ショートカット（検索バー表示）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;

      // Ctrl+F: 検索バーを開く
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setSearchVisible(true);
        setShowReplace(false);
        return;
      }

      // Ctrl+H: 置換バーを開く
      if ((e.ctrlKey || e.metaKey) && e.key === 'h' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setSearchVisible(true);
        setShowReplace(true);
        return;
      }

      // Ctrl+P: クイックオープン
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setQuickOpenVisible(true);
        return;
      }

      // Ctrl+G: 行番号ジャンプ
      if ((e.ctrlKey || e.metaKey) && e.key === 'g' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setGoToLineVisible(true);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // スマートペースト ask モードのイベントリスナー
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SmartPasteAskEvent>).detail;
      setSmartPasteData(detail);
    };
    window.addEventListener('smart-paste-ask', handler);
    return () => window.removeEventListener('smart-paste-ask', handler);
  }, []);

  // Ctrl+0〜6 のカスタムイベントハンドラ
  useEffect(() => {
    if (!editor) return;
    const handler = (e: Event) => {
      const { level } = (e as CustomEvent).detail as { level: number };
      if (level === 0) {
        // 段落に変換
        editor.chain().focus().setParagraph().run();
      } else {
        editor
          .chain()
          .focus()
          .toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 })
          .run();
      }
    };
    window.addEventListener('editor-heading', handler);
    return () => window.removeEventListener('editor-heading', handler);
  }, [editor]);

  // Ctrl+K リンク挿入のカスタムイベントハンドラ
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      if (editor.isActive('link')) {
        // 既存リンクを解除
        editor.chain().focus().unsetLink().run();
        return;
      }

      // Phase 1: window.prompt で URL を入力（Phase 3 でカスタムダイアログに置き換え）
      const url = window.prompt('リンクURLを入力してください:');
      if (!url) return;

      editor.chain().focus().setLink({ href: url }).run();
    };
    window.addEventListener('editor-link-insert', handler);
    return () => window.removeEventListener('editor-link-insert', handler);
  }, [editor]);

  // 初期コンテンツの設定（タブ切り替え時も含む）
  useEffect(() => {
    if (!editor) return;

    // エディタ起点の更新が親経由で戻ってきた場合、再注入ループを避ける
    if (initialContent === lastEmittedContentRef.current) {
      return;
    }

    const contentSizeBytes = new TextEncoder().encode(initialContent).length;
    if (contentSizeBytes >= LARGE_FILE_SOURCE_MODE_THRESHOLD_BYTES && mode === 'wysiwyg') {
      setSourceText(initialContent);
      setMode('source');
      showToast(
        'warning',
        'ファイルサイズが大きいため、フリーズを防止するためにソースモードで開きました。',
      );
      return;
    }

    if (mode === 'source') {
      setSourceText(initialContent);
      return;
    }

    // Front Matter を抽出して本文のみ TipTap に渡す
    const { yaml, body } = parseFrontMatter(initialContent);
    setFrontMatterYaml(yaml);

    applyExternalMarkdownToEditor(body || '');

    // performance-design.md §2: ノード数による大規模ファイル判定
    // パース後にノード数をチェックし、閾値超過時はソースモードへ切替
    if (editor) {
      const nodeCount = editor.state.doc.nodeSize;
      if (nodeCount >= LARGE_FILE_NODE_COUNT_THRESHOLD) {
        setSourceText(initialContent);
        setMode('source');
        showToast(
          'warning',
          `ノード数が多いため（${nodeCount}）、ソースモードで開きました。`,
        );
      }
    }
  }, [applyExternalMarkdownToEditor, editor, initialContent, mode, showToast]);

  // コンテンツ変更の監視
  useEffect(() => {
    if (!editor) return;

    const handler = () => {
      // IME 変換中はシリアライズしない (markdown-tiptap-conversion.md §9)
      if (!ime.canProcess()) return;
      if (suppressNextUpdateRef.current > 0) {
        suppressNextUpdateRef.current -= 1;
        return;
      }

      const json = editor.getJSON() as unknown as TipTapDoc;
      // インクリメンタルシリアライズ: 変更ブロックのみ再変換
      const markdown = incrementalSerializerRef.current.serialize(json);
      const fullMarkdown = serializeFrontMatter(frontMatterYamlRef.current, markdown);
      lastEmittedContentRef.current = fullMarkdown;
      // Front Matter を先頭に付けて完全な Markdown として通知
      onContentChangeRef.current?.(fullMarkdown);
    };

    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
    };
  }, [editor, ime]);

  // タイプライターモード: カーソル行を常に画面中央に保つ
  // typora-analysis.md §2.3.1 に準拠:
  // - デッドゾーン: ビューポート中央 ±10% 内ならスクロールしない
  // - IME ガード: isComposing 中はセンタリングを抑制
  // - prefers-reduced-motion: スムーズスクロールを無効化
  // - rAF で DOM 計測を 1 フレーム内に集約
  useEffect(() => {
    if (!editor || !typewriterMode || mode !== 'wysiwyg') return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const handleSelectionUpdate = () => {
      // IME 変換中はセンタリングを抑制
      if (ime.isComposing) return;

      requestAnimationFrame(() => {
        const { state, view } = editor;
        const { from } = state.selection;
        const coords = view.coordsAtPos(from);
        const wrapper = editorWrapperRef.current;
        if (!wrapper) return;

        const wrapperRect = wrapper.getBoundingClientRect();
        const centerY = wrapperRect.top + wrapperRect.height / 2;
        const deadZone = wrapperRect.height * 0.1; // ±10% デッドゾーン
        const offset = coords.top - centerY;

        // デッドゾーン内ならスクロールしない
        if (Math.abs(offset) <= deadZone) return;

        wrapper.scrollBy({
          top: offset,
          behavior: prefersReducedMotion ? 'instant' : 'smooth',
        });
      });
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor, typewriterMode, mode, ime]);

  // フォーカスモード / タイプライターモードのキーボードショートカット
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;

      // Ctrl+Shift+F: フォーカスモードのトグル (zen-mode-design.md に準拠)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        updateSettings({ editor: { focusMode: !settings.editor.focusMode } });
        return;
      }

      // Ctrl+Shift+T: タイプライターモードのトグル
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        updateSettings({ editor: { typewriterMode: !settings.editor.typewriterMode } });
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [settings.editor.focusMode, settings.editor.typewriterMode, updateSettings]);

  // Ctrl+/ でソースモード切替
  // keyboard-shortcuts.md §1-5, §4-2 に準拠
  const toggleMode = useCallback(() => {
    if (!editor) return;

    if (mode === 'wysiwyg') {
      // WYSIWYG → ソース: Front Matter を含む完全な Markdown をソースに表示
      const json = editor.getJSON() as unknown as TipTapDoc;
      const body = tiptapToMarkdown(json);
      const full = serializeFrontMatter(frontMatterYamlRef.current, body);
      setSourceText(full);
      setMode('source');
    } else {
      // ソース → WYSIWYG: ソース内の Front Matter を抽出して本文を TipTap に設定
      const { yaml, body } = parseFrontMatter(sourceText);
      setFrontMatterYaml(yaml);
      applyExternalMarkdownToEditor(body || '');
      onContentChangeRef.current?.(sourceText);
      setMode('wysiwyg');
    }
  }, [applyExternalMarkdownToEditor, editor, mode, sourceText]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        toggleMode();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleMode]);

  // ネイティブメニューからのカスタムイベント受信
  useEffect(() => {
    const onFind = () => {
      setSearchVisible(true);
      setShowReplace(false);
    };
    const onFindReplace = () => {
      setSearchVisible(true);
      setShowReplace(true);
    };
    const onTextStats = () => {
      setTextStatsVisible(true);
    };
    const onEditorMode = (e: Event) => {
      const detail = (e as CustomEvent<{ mode: string }>).detail;
      if (detail.mode === 'wysiwyg' && mode === 'source') toggleMode();
      if (detail.mode === 'source' && mode === 'wysiwyg') toggleMode();
    };
    const onPastePlain = async () => {
      try {
        const text = await navigator.clipboard.readText();
        editor?.commands.insertContent(text);
      } catch {
        /* clipboard access denied */
      }
    };
    const onZoom = (e: Event) => {
      const { action } = (e as CustomEvent<{ action: string }>).detail;
      const root = document.documentElement;
      const current = parseFloat(root.style.getPropertyValue('--app-zoom') || '1');
      if (action === 'reset') root.style.setProperty('--app-zoom', '1');
      else if (action === 'in')
        root.style.setProperty('--app-zoom', String(Math.min(current + 0.1, 2)));
      else if (action === 'out')
        root.style.setProperty('--app-zoom', String(Math.max(current - 0.1, 0.5)));
      root.style.zoom = root.style.getPropertyValue('--app-zoom');
    };

    window.addEventListener('menu-find', onFind);
    window.addEventListener('menu-find-replace', onFindReplace);
    window.addEventListener('menu-text-stats', onTextStats);
    window.addEventListener('menu-editor-mode', onEditorMode);
    window.addEventListener('menu-paste-plain', onPastePlain);
    window.addEventListener('menu-zoom', onZoom);
    return () => {
      window.removeEventListener('menu-find', onFind);
      window.removeEventListener('menu-find-replace', onFindReplace);
      window.removeEventListener('menu-text-stats', onTextStats);
      window.removeEventListener('menu-editor-mode', onEditorMode);
      window.removeEventListener('menu-paste-plain', onPastePlain);
      window.removeEventListener('menu-zoom', onZoom);
    };
  }, [editor, mode, toggleMode]);

  // タイプライター打鍵音フィードバック (Phase 7)
  useEffect(() => {
    if (!settings.editor.typewriterSound) return;
    const handler = (e: KeyboardEvent) => {
      // IME 入力中・修飾キー単体・機能キーでは発音しない
      if (e.isComposing || e.keyCode === 229) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // 文字入力・スペース・バックスペース・エンターのみ
      const isPrintable =
        e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Delete';
      if (!isPrintable) return;
      typewriterPlayer.playKey(settings.editor.typewriterStyle, settings.editor.typewriterVolume);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    settings.editor.typewriterSound,
    settings.editor.typewriterStyle,
    settings.editor.typewriterVolume,
  ]);

  // 画像アノテーションイベントリスナー (Phase 7.5)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ImageAnnotationEvent>).detail;
      const { src } = detail;

      // data URI の場合はアノテーション非対応（外部URLも対象外）
      if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
        showToast('warning', 'アノテーションはローカル画像ファイルのみ対応しています');
        return;
      }

      // filePath はタブの filePath から相対パスを解決して取得
      // 画像の src がそのまま絶対パスとして使える前提
      setAnnotationTarget({
        src,
        filePath: src,
      });
    };

    window.addEventListener('image-annotation-start', handler);
    return () => window.removeEventListener('image-annotation-start', handler);
  }, [showToast]);

  // コードブロックにコピーボタンを自動付与 (テクニカルライター/開発者ペルソナ向け)
  useEffect(() => {
    if (!editor || mode !== 'wysiwyg') return;
    const editorDom = editor.view.dom;

    const addCopyButtons = () => {
      const preElements = editorDom.querySelectorAll('pre');
      preElements.forEach((pre) => {
        if (pre.querySelector('.code-copy-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'code-copy-btn';
        btn.textContent = 'Copy';
        btn.title = 'コードをコピー';
        btn.contentEditable = 'false';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const code = pre.querySelector('code');
          if (code) {
            void navigator.clipboard.writeText(code.textContent ?? '');
            btn.textContent = '✓ Copied';
            btn.classList.add('code-copy-btn--copied');
            setTimeout(() => {
              btn.textContent = 'Copy';
              btn.classList.remove('code-copy-btn--copied');
            }, 1500);
          }
        });
        pre.style.position = 'relative';
        pre.appendChild(btn);
      });
    };

    addCopyButtons();
    const observer = new MutationObserver(addCopyButtons);
    observer.observe(editorDom, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [editor, mode]);

  // ソースモードでのテキスト変更（CodeMirror から直接文字列を受け取る）
  const handleSourceTextChange = useCallback((value: string) => {
    setSourceText(value);
    onContentChangeRef.current?.(value);
  }, []);

  // エディタ領域のクリックでフォーカスを設定
  const handleEditorAreaClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!editor) return;
      // クリックが直接 wrapper 上（ProseMirror 外の余白）の場合、末尾にフォーカス
      if (e.target === e.currentTarget || e.target === editorWrapperRef.current) {
        editor.chain().focus('end').run();
      }
    },
    [editor],
  );

  // 外部から Markdown を設定するメソッド
  const setMarkdown = useCallback(
    (markdown: string) => {
      if (!editor) return;
      const { yaml, body } = parseFrontMatter(markdown);
      setFrontMatterYaml(yaml);
      applyExternalMarkdownToEditor(body || '');
    },
    [applyExternalMarkdownToEditor, editor],
  );

  // 現在の Markdown を取得するメソッド（Front Matter 含む）
  const getMarkdown = useCallback((): string | null => {
    if (!editor) return null;
    // IME 変換中はシリアライズしない
    if (!ime.canProcess()) return null;

    const json = editor.getJSON() as unknown as TipTapDoc;
    const body = tiptapToMarkdown(json);
    return serializeFrontMatter(frontMatterYamlRef.current, body);
  }, [editor, ime]);

  // テーブルセル右クリック → コンテキストメニュー表示
  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!editor) return;
      // クリック対象がテーブルセル内かどうか判定
      const target = e.target as HTMLElement;
      const cellEl = target.closest('td, th');
      if (!cellEl) return;

      e.preventDefault();
      setTableMenu({ visible: true, x: e.clientX, y: e.clientY });
    },
    [editor],
  );

  // WYSIWYG モードでの Alt+ドラッグ検知
  // editor-ux-design.md §11.3: ステータスバーにツールチップ表示
  const rectSelectNotifiedRef = useRef(false);
  const handleWysiwygMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.altKey && !rectSelectNotifiedRef.current) {
      rectSelectNotifiedRef.current = true;
      useToastStore.getState().show('info', '矩形選択はソースモード（Ctrl+/）でのみ利用可能です');
      // 3秒後にフラグをリセット（連続通知を防止）
      setTimeout(() => {
        rectSelectNotifiedRef.current = false;
      }, 3000);
    }
  }, []);

  if (!editor) return null;

  return (
    <div className="editor-container flex flex-col h-full">
      <EditorToolbar
        editor={editor}
        mode={mode}
        onToggleMode={toggleMode}
        getMarkdown={() => getMarkdown() ?? ''}
      />
      {editor && <TableContextMenu editor={editor} menu={tableMenu} onClose={closeTableMenu} />}
      {/* クイックオープンモーダル（Ctrl+P） */}
      {quickOpenVisible && <QuickOpenModal onClose={() => setQuickOpenVisible(false)} />}
      {/* 行番号ジャンプダイアログ（Ctrl+G） */}
      {goToLineVisible && editor && (
        <GoToLineDialog
          totalLines={editor.state.doc.content.childCount}
          onGoToLine={(line) => {
            // WYSIWYG モード: ブロック番号でジャンプ
            let pos = 0;
            let blockIndex = 0;
            editor.state.doc.descendants((_node, nodePos) => {
              blockIndex++;
              if (blockIndex === line) {
                pos = nodePos;
                return false;
              }
            });
            editor
              .chain()
              .focus()
              .setTextSelection(pos + 1)
              .run();
            // スクロール
            const dom = editor.view.domAtPos(pos + 1);
            if (dom.node instanceof HTMLElement) {
              dom.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (dom.node.parentElement) {
              dom.node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
          onClose={() => setGoToLineVisible(false)}
        />
      )}
      {/* 文書統計ダイアログ */}
      {textStatsVisible && editor && (
        <TextStatsDialog
          text={editor.state.doc.textContent}
          onClose={() => setTextStatsVisible(false)}
        />
      )}
      {/* スマートペースト確認バー（ask モード） */}
      {smartPasteData && editor && (
        <SmartPasteBar
          onMarkdown={() => {
            const md = htmlToMarkdown(smartPasteData.html);
            const doc = mdToTipTapForPaste(md);
            if (doc.content && doc.content.length > 0) {
              editor.commands.insertContent(doc.content as unknown as Record<string, unknown>[]);
            }
            setSmartPasteData(null);
          }}
          onPlainText={() => {
            if (smartPasteData.plainText) {
              editor.commands.insertContent(smartPasteData.plainText);
            }
            setSmartPasteData(null);
          }}
          onDismiss={() => setSmartPasteData(null)}
        />
      )}
      {mode === 'wysiwyg' ? (
        <div
          ref={editorWrapperRef}
          className={[
            'flex-1 overflow-y-auto cursor-text relative',
            focusMode ? 'focus-mode-enabled' : '',
            typewriterMode ? 'typewriter-mode-enabled' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={handleEditorAreaClick}
          onContextMenu={handleContextMenu}
          onMouseDown={handleWysiwygMouseDown}
        >
          {/* Git ガター差分インジケーター (Phase 7.5) */}
          <GitGutterIndicator
            repoPath={workspaceRootForGit}
            filePath={activeTabFilePath}
            lineHeight={Math.round(settings.appearance.editorFontSize * settings.appearance.editorLineHeight)}
            editorContainerRef={editorWrapperRef}
          />
          {/* YAML Front Matter パネル (Phase 7) */}
          <div className="max-w-[800px] mx-auto px-12 pt-6">
            <FrontMatterPanel
              yaml={frontMatterYaml}
              onChange={(newYaml) => {
                setFrontMatterYaml(newYaml);
                frontMatterYamlRef.current = newYaml;
                // Front Matter 変更を本文と合わせて親に通知
                const json = editor?.getJSON() as unknown as TipTapDoc | undefined;
                if (json) {
                  const body = tiptapToMarkdown(json);
                  onContentChangeRef.current?.(serializeFrontMatter(newYaml, body));
                }
              }}
            />
          </div>
          {/* 検索バー（フローティング） */}
          {searchVisible && editor && (
            <SearchBar
              editor={editor}
              showReplace={showReplace}
              onClose={() => setSearchVisible(false)}
              onToggleReplace={() => setShowReplace((v) => !v)}
            />
          )}
          {/* スラッシュコマンドメニュー (Phase 7) */}
          {slashState.active && editor && (
            <SlashCommandMenu
              editor={editor}
              slashState={slashState}
              onClose={() => setSlashState({ active: false, query: '', from: -1, coords: null })}
            />
          )}
          {/* Wikilink オートコンプリートポップアップ (Phase 7.5) */}
          {wikilinkAutoState.active && editor && (
            <WikilinkPopup
              editor={editor}
              autoState={wikilinkAutoState}
              candidates={wikilinkCandidates}
              onClose={() =>
                setWikilinkAutoState({ active: false, query: '', from: -1, coords: null })
              }
            />
          )}
          <div className="max-w-[800px] mx-auto px-12 py-8">
            <EditorContent
              editor={editor}
              className="prose prose-neutral max-w-none focus:outline-none"
            />
          </div>
        </div>
      ) : (
        <SourceEditor value={sourceText} onChange={handleSourceTextChange} readOnly={readOnly} />
      )}
      <EditorHandle setMarkdown={setMarkdown} getMarkdown={getMarkdown} />
      {/* 画像アノテーションモーダル (Phase 7.5) */}
      {annotationTarget && (
        <ImageAnnotationModal
          imageSrc={annotationTarget.src}
          imagePath={annotationTarget.filePath}
          onClose={() => setAnnotationTarget(null)}
          onSaved={() => {
            setAnnotationTarget(null);
            showToast('success', 'アノテーション画像を保存しました');
            // エディタの画像を再表示するためにリフレッシュ
            editor?.commands.focus();
          }}
        />
      )}
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
 * ツールバー - 直感的な操作のためのフォーマットボタン群
 *
 * ペルソナ:
 * - マークダウンが分からないけどマークダウンで書きたいエンジニア
 * - マークダウンでの編集を楽に行いたいエンジニア
 * - 知識管理者・一般ライター: 集中モードのトグルボタン（フォーカス/タイプライター/Zen）
 */
function EditorToolbar({
  editor,
  mode,
  onToggleMode,
  getMarkdown,
}: {
  editor: ReturnType<typeof useEditor>;
  mode: EditorMode;
  onToggleMode: () => void;
  /** AIコピーボタン用: 現在の Markdown を取得する関数 */
  getMarkdown?: () => string;
}) {
  const { settings, updateSettings } = useSettingsStore();
  const focusMode = settings.editor.focusMode;
  const typewriterMode = settings.editor.typewriterMode;
  const zenMode = settings.editor.zenMode;

  if (!editor) return null;

  return (
    <div
      className="editor-toolbar flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-200 bg-white flex-shrink-0 overflow-x-auto"
      role="toolbar"
      aria-label="書式ツールバー"
    >
      {mode === 'wysiwyg' && (
        <>
          {/* ブロック種別セレクタ */}
          <BlockTypeSelect editor={editor} />
          <ToolbarDivider />

          {/* テキスト書式 */}
          <ToolbarButton
            icon={<span className="font-bold">B</span>}
            tooltip="太字 (Ctrl+B)"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            icon={<span className="italic">I</span>}
            tooltip="斜体 (Ctrl+I)"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            icon={<span className="line-through">S</span>}
            tooltip="取り消し線"
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />
          <ToolbarButton
            icon={<span className="font-mono text-xs bg-gray-200 px-1 rounded">&lt;/&gt;</span>}
            tooltip="インラインコード"
            active={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleCode().run()}
          />
          <ToolbarDivider />

          {/* リスト */}
          <ToolbarButton
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="3" cy="4" r="1.5" />
                <circle cx="3" cy="8" r="1.5" />
                <circle cx="3" cy="12" r="1.5" />
                <rect x="6" y="3" width="8" height="2" rx="0.5" />
                <rect x="6" y="7" width="8" height="2" rx="0.5" />
                <rect x="6" y="11" width="8" height="2" rx="0.5" />
              </svg>
            }
            tooltip="箇条書きリスト"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <text x="1" y="5.5" fontSize="5" fontWeight="bold">
                  1.
                </text>
                <text x="1" y="9.5" fontSize="5" fontWeight="bold">
                  2.
                </text>
                <text x="1" y="13.5" fontSize="5" fontWeight="bold">
                  3.
                </text>
                <rect x="6" y="3" width="8" height="2" rx="0.5" />
                <rect x="6" y="7" width="8" height="2" rx="0.5" />
                <rect x="6" y="11" width="8" height="2" rx="0.5" />
              </svg>
            }
            tooltip="番号付きリスト"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="2" width="2" height="12" rx="0.5" opacity="0.6" />
                <rect x="5" y="3" width="9" height="2" rx="0.5" />
                <rect x="5" y="7" width="7" height="2" rx="0.5" />
                <rect x="5" y="11" width="8" height="2" rx="0.5" />
              </svg>
            }
            tooltip="タスクリスト"
            active={editor.isActive('taskList')}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          />
          <ToolbarDivider />

          {/* ブロック要素 */}
          <ToolbarButton
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3 2h1v12H3V2zm3 2h8v2H6V4zm0 4h6v2H6V8z" opacity="0.7" />
              </svg>
            }
            tooltip="引用"
            active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
          <ToolbarButton
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect
                  x="1"
                  y="1"
                  width="14"
                  height="14"
                  rx="2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <text x="4" y="11" fontSize="8" fontFamily="monospace">
                  {'{}'}
                </text>
              </svg>
            }
            tooltip="コードブロック"
            active={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          />
          <ToolbarButton
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="7" width="14" height="2" rx="1" />
              </svg>
            }
            tooltip="水平線"
            active={false}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          />
          <ToolbarButton
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 12h8v1.5H2V12zm0-1L7 3h2l5 8H2zm3.5-1.5h5L8 5.5l-2.5 4z" opacity="0" />
                <path
                  d="M1.5 3C1.5 2.17 2.17 1.5 3 1.5h6.5l4 4V13c0 .83-.67 1.5-1.5 1.5H3c-.83 0-1.5-.67-1.5-1.5V3z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <path d="M8.5 1.5v4h4" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <path
                  d="M4 7.5h5M4 10h3.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            }
            tooltip="リンク挿入 (Ctrl+K)"
            active={editor.isActive('link')}
            onClick={() => window.dispatchEvent(new CustomEvent('editor-link-insert'))}
          />
          <ToolbarDivider />

          {/* テーブル挿入 */}
          <TableInsertButton editor={editor} />
          <ToolbarDivider />

          {/* テキスト整形 */}
          <TextTransformDropdown editor={editor} />
          <ToolbarDivider />
        </>
      )}
      <ToolbarButton
        icon={
          mode === 'wysiwyg' ? (
            <span className="font-mono text-xs">&lt;/&gt;</span>
          ) : (
            <span className="text-xs">WYSIWYG</span>
          )
        }
        tooltip={`${mode === 'wysiwyg' ? 'ソースモード' : 'WYSIWYG モード'}に切替 (Ctrl+/)`}
        active={mode === 'source'}
        onClick={onToggleMode}
      />

      {/* 集中・執筆モードボタン群 (Phase 7) */}
      {/* ペルソナ: 知識管理者・一般ライター・AIパワーユーザー */}
      <ToolbarDivider />
      <ToolbarButton
        icon={
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="7.5" cy="7.5" r="2" />
            <line x1="7.5" y1="1" x2="7.5" y2="3.5" />
            <line x1="7.5" y1="11.5" x2="7.5" y2="14" />
            <line x1="1" y1="7.5" x2="3.5" y2="7.5" />
            <line x1="11.5" y1="7.5" x2="14" y2="7.5" />
          </svg>
        }
        tooltip={`フォーカスモード${focusMode ? '（ON）' : '（OFF）'} (Ctrl+Shift+F)`}
        active={focusMode}
        onClick={() => updateSettings({ editor: { focusMode: !focusMode } })}
      />
      <ToolbarButton
        icon={
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <line x1="3" y1="7.5" x2="12" y2="7.5" />
            <line x1="1" y1="4" x2="14" y2="4" strokeOpacity="0.4" />
            <line x1="1" y1="11" x2="14" y2="11" strokeOpacity="0.4" />
            <polyline points="5.5,5.5 3,7.5 5.5,9.5" />
            <polyline points="9.5,5.5 12,7.5 9.5,9.5" />
          </svg>
        }
        tooltip={`タイプライターモード${typewriterMode ? '（ON）' : '（OFF）'} (Ctrl+Shift+T)`}
        active={typewriterMode}
        onClick={() => updateSettings({ editor: { typewriterMode: !typewriterMode } })}
      />
      <ToolbarButton
        icon={
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="1.5" y="1.5" width="12" height="12" rx="1" />
            <line x1="4" y1="5.5" x2="11" y2="5.5" />
            <line x1="4" y1="7.5" x2="11" y2="7.5" />
            <line x1="4" y1="9.5" x2="8" y2="9.5" />
          </svg>
        }
        tooltip={`Zen モード${zenMode ? '（ON）' : '（OFF）'} (F11)`}
        active={zenMode}
        onClick={() => updateSettings({ editor: { zenMode: !zenMode } })}
      />

      {/* アンビエントサウンド (Phase 7) */}
      {/* ペルソナ: 一般ライター・知識管理者 — 執筆集中のための環境音 */}
      <ToolbarDivider />
      <AmbientSoundControl />

      {/* AIコピーボタン (Phase 8) */}
      {/* ペルソナ: AIパワーユーザー — Markdownを最適化してClaudeやChatGPTに渡す */}
      {getMarkdown && mode === 'wysiwyg' && (
        <>
          <ToolbarDivider />
          <AiCopyButton getMarkdown={getMarkdown} label="✨ AI コピー" />
        </>
      )}
    </div>
  );
}

/**
 * ブロック種別セレクタ（見出しレベル / 段落の切り替え）
 */
function BlockTypeSelect({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const getCurrentBlockType = (): string => {
    for (let i = 1; i <= 6; i++) {
      if (editor.isActive('heading', { level: i })) return `h${i}`;
    }
    return 'paragraph';
  };

  const blockType = getCurrentBlockType();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'paragraph') {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = parseInt(value.replace('h', '')) as 1 | 2 | 3 | 4 | 5 | 6;
      editor.chain().focus().toggleHeading({ level }).run();
    }
  };

  return (
    <select
      value={blockType}
      onChange={handleChange}
      className="text-sm border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 cursor-pointer hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-[120px]"
      title="ブロック種別を選択"
      aria-label="ブロック種別"
    >
      <option value="paragraph">段落</option>
      <option value="h1">見出し 1</option>
      <option value="h2">見出し 2</option>
      <option value="h3">見出し 3</option>
      <option value="h4">見出し 4</option>
      <option value="h5">見出し 5</option>
      <option value="h6">見出し 6</option>
    </select>
  );
}

function ToolbarButton({
  icon,
  tooltip,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  tooltip: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={tooltip}
      onClick={onClick}
      aria-label={tooltip}
      aria-pressed={active}
      className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
        active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {icon}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-gray-300 mx-1 flex-shrink-0" />;
}

/**
 * テーブル挿入ボタン（行数・列数指定）
 *
 * ドロップダウンで行数×列数のグリッドを表示し、
 * ホバーした位置のテーブルを挿入する。
 */
function TableInsertButton({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<{ rows: number; cols: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const GRID_ROWS = 8;
  const GRID_COLS = 8;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const insertTable = (rows: number, cols: number) => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setOpen(false);
    setHovered(null);
  };

  if (!editor) return null;

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        title="テーブル挿入"
        aria-label="テーブル挿入"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
          editor.isActive('table')
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        {/* テーブルアイコン */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect
            x="1"
            y="1"
            width="14"
            height="14"
            rx="1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <line x1="1" y1="5" x2="15" y2="5" stroke="currentColor" strokeWidth="1" />
          <line x1="1" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="1" />
          <line x1="5.5" y1="1" x2="5.5" y2="15" stroke="currentColor" strokeWidth="1" />
          <line x1="10.5" y1="1" x2="10.5" y2="15" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>

      {open && (
        <div role="dialog" aria-label="テーブルサイズ選択" className="table-insert-picker">
          <div className="table-insert-picker__label">
            {hovered ? `${hovered.rows} × ${hovered.cols}` : 'テーブルを挿入'}
          </div>
          <div
            className="table-insert-picker__grid"
            style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1.25rem)` }}
          >
            {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => {
              const row = Math.floor(i / GRID_COLS) + 1;
              const col = (i % GRID_COLS) + 1;
              const active = hovered !== null && row <= hovered.rows && col <= hovered.cols;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`${row}行 ${col}列のテーブルを挿入`}
                  className={`table-insert-picker__cell${active ? ' table-insert-picker__cell--active' : ''}`}
                  onPointerEnter={() => setHovered({ rows: row, cols: col })}
                  onPointerLeave={() => setHovered(null)}
                  onClick={() => insertTable(row, col)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * テキスト整形ドロップダウン
 * editor-ux-design.md §12 に準拠。
 */
function TextTransformDropdown({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const applyTransform = (transform: (text: string) => string) => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;

    if (empty) {
      // 選択なし: ドキュメント全体を対象
      const fullText = editor.state.doc.textContent;
      const transformed = transform(fullText);
      // ドキュメント全体を置き換え
      editor.chain().focus().selectAll().deleteSelection().insertContent(transformed).run();
    } else {
      // 選択範囲を対象
      const selectedText = editor.state.doc.textBetween(from, to, '\n');
      const transformed = transform(selectedText);
      editor.chain().focus().deleteSelection().insertContent(transformed).run();
    }
    setOpen(false);
  };

  if (!editor) return null;

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        title="テキスト整形"
        aria-label="テキスト整形"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-8 h-8 rounded transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <text x="2" y="12" fontSize="11" fontWeight="bold">
            T
          </text>
          <path
            d="M10 11l3-3-3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="text-transform-dropdown">
          {TEXT_TRANSFORM_COMMANDS.map((cmd) => (
            <button
              key={cmd.id}
              type="button"
              className="text-transform-dropdown__item"
              onClick={() => applyTransform(cmd.transform)}
            >
              {cmd.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default MarkdownEditor;
