/**
 * HTML 専用ツールバー
 *
 * Phase 5: HTML 編集モード固有のツールバーコントロール。
 *
 * 追加コントロール:
 * - テキスト色ピッカー
 * - 背景色ピッカー
 * - フォントサイズ選択
 * - テキスト配置（左/中央/右/均等）
 * - div ブロック挿入
 * - モード切替ボタン（WYSIWYG / ソース / スプリット）
 *
 * 設計書: docs/05_Features/HTML/html-editing-design.md §4.3, §7.3
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { HtmlEditorMode } from './HtmlEditor';

interface HtmlToolbarProps {
  editor: Editor;
  mode: HtmlEditorMode;
  onSwitchMode: (mode: HtmlEditorMode) => void;
  onToggleMetadata: () => void;
  metadataOpen?: boolean;
}

export function HtmlToolbar({
  editor,
  mode,
  onSwitchMode,
  onToggleMetadata,
  metadataOpen = false,
}: HtmlToolbarProps) {
  return (
    <div
      className="editor-toolbar flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-200 bg-white flex-shrink-0 overflow-x-auto"
      role="toolbar"
      aria-label="HTML 書式ツールバー"
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

          {/* HTML固有インライン */}
          <ToolbarButton
            icon={<span className="bg-yellow-200 px-0.5 text-xs">M</span>}
            tooltip="ハイライト (mark)"
            active={editor.isActive('highlight')}
            onClick={() => editor.commands.toggleHighlight()}
          />
          <ToolbarButton
            icon={<span className="text-xs">X<sup className="text-[8px]">2</sup></span>}
            tooltip="上付き文字 (sup)"
            active={editor.isActive('superscript')}
            onClick={() => editor.commands.toggleSuperscript()}
          />
          <ToolbarButton
            icon={<span className="text-xs">X<sub className="text-[8px]">2</sub></span>}
            tooltip="下付き文字 (sub)"
            active={editor.isActive('subscript')}
            onClick={() => editor.commands.toggleSubscript()}
          />
          <ToolbarDivider />

          {/* テキスト色 */}
          <ColorPickerButton
            editor={editor}
            type="text"
            tooltip="テキスト色"
          />
          {/* 背景色 */}
          <ColorPickerButton
            editor={editor}
            type="background"
            tooltip="背景色"
          />
          {/* フォントサイズ */}
          <FontSizeSelect editor={editor} />
          <ToolbarDivider />

          {/* テキスト配置 */}
          <TextAlignButtons editor={editor} />
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
                <text x="1" y="5.5" fontSize="5" fontWeight="bold">1.</text>
                <text x="1" y="9.5" fontSize="5" fontWeight="bold">2.</text>
                <text x="1" y="13.5" fontSize="5" fontWeight="bold">3.</text>
                <rect x="6" y="3" width="8" height="2" rx="0.5" />
                <rect x="6" y="7" width="8" height="2" rx="0.5" />
                <rect x="6" y="11" width="8" height="2" rx="0.5" />
              </svg>
            }
            tooltip="番号付きリスト"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
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
                <rect x="1" y="7" width="14" height="2" rx="1" />
              </svg>
            }
            tooltip="水平線"
            active={false}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          />
          <ToolbarDivider />

          {/* div 挿入 */}
          <ToolbarButton
            icon={<span className="text-xs font-mono">&lt;div&gt;</span>}
            tooltip="div ブロック挿入"
            active={editor.isActive('divBlock')}
            onClick={() => editor.commands.insertDivBlock()}
          />
          {/* セマンティック要素 */}
          <SemanticBlockDropdown editor={editor} />
          <ToolbarDivider />

          {/* メタデータパネル */}
          <ToolbarButton
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 3h12v2H2V3zm0 4h8v2H2V7zm0 4h10v2H2V11z" opacity="0.7" />
              </svg>
            }
            tooltip="ページ設定（メタデータ）"
            active={metadataOpen}
            onClick={onToggleMetadata}
          />
          <ToolbarDivider />
        </>
      )}

      {/* モード切替ボタン */}
      <ModeSwitch mode={mode} onSwitchMode={onSwitchMode} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// モード切替ボタン
// ---------------------------------------------------------------------------

function ModeSwitch({
  mode,
  onSwitchMode,
}: {
  mode: HtmlEditorMode;
  onSwitchMode: (mode: HtmlEditorMode) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 ml-auto" role="radiogroup" aria-label="編集モード">
      <ModeSwitchButton
        label="WYSIWYG"
        active={mode === 'wysiwyg'}
        onClick={() => onSwitchMode('wysiwyg')}
      />
      <ModeSwitchButton
        label="ソース"
        active={mode === 'source'}
        onClick={() => onSwitchMode('source')}
      />
      <ModeSwitchButton
        label="スプリット"
        active={mode === 'split'}
        onClick={() => onSwitchMode('split')}
      />
    </div>
  );
}

function ModeSwitchButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700 font-medium'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ブロック種別セレクタ
// ---------------------------------------------------------------------------

function BlockTypeSelect({ editor }: { editor: Editor }) {
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

// ---------------------------------------------------------------------------
// カラーピッカーボタン
// ---------------------------------------------------------------------------

function ColorPickerButton({
  editor,
  type,
  tooltip,
}: {
  editor: Editor;
  type: 'text' | 'background';
  tooltip: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const colors = [
    '#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff',
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6',
    '#ec4899', '#14b8a6', '#6366f1', '#a855f7', '#f43f5e', '#0ea5e9',
  ];

  // 現在適用中の色を取得
  const getCurrentColor = (): string | null => {
    if (type === 'text') {
      const attrs = editor.getAttributes('textColor');
      return attrs?.color ?? null;
    } else {
      const attrs = editor.getAttributes('backgroundColor');
      return attrs?.color ?? null;
    }
  };

  const currentColor = getCurrentColor();

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const applyColor = useCallback(
    (color: string) => {
      if (type === 'text') {
        editor.commands.setTextColor(color);
      } else {
        editor.commands.setBackgroundColor(color);
      }
      setOpen(false);
    },
    [editor, type],
  );

  const clearColor = useCallback(() => {
    if (type === 'text') {
      editor.commands.unsetTextColor();
    } else {
      editor.commands.unsetBackgroundColor();
    }
    setOpen(false);
  }, [editor, type]);

  const isText = type === 'text';
  const indicatorColor = currentColor || (isText ? '#374151' : 'transparent');

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        title={tooltip}
        aria-label={tooltip}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex flex-col items-center justify-center w-8 h-8 rounded transition-colors ${
          open
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        {isText ? (
          <>
            <span className="text-sm font-bold leading-none">A</span>
            <span
              className="w-4 h-1 rounded-sm mt-0.5"
              style={{ backgroundColor: indicatorColor }}
            />
          </>
        ) : (
          <>
            <span
              className="text-sm font-bold leading-none px-1 rounded"
              style={{
                backgroundColor: currentColor || '#fef08a',
                color: currentColor ? getContrastText(currentColor) : undefined,
              }}
            >
              A
            </span>
          </>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-48">
          <div className="text-xs text-gray-500 mb-2 font-medium">
            {isText ? 'テキスト色' : '背景色'}
          </div>
          <div className="grid grid-cols-6 gap-1 mb-2">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`${color} を設定`}
                className={`w-6 h-6 rounded border transition-all ${
                  currentColor === color
                    ? 'ring-2 ring-blue-500 border-blue-500'
                    : 'border-gray-200 hover:ring-2 hover:ring-blue-400'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => applyColor(color)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={clearColor}
            className="w-full text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 py-1 rounded transition-colors"
          >
            色をクリア
          </button>
          <div className="mt-1 pt-1 border-t border-gray-100 flex items-center gap-2">
            <label className="text-xs text-gray-500">カスタム:</label>
            <input
              type="color"
              value={currentColor || '#000000'}
              className="w-6 h-6 cursor-pointer border-0 p-0 rounded"
              onChange={(e) => applyColor(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** 背景色に対してコントラストのあるテキスト色を返す */
function getContrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// ---------------------------------------------------------------------------
// フォントサイズ選択
// ---------------------------------------------------------------------------

function FontSizeSelect({ editor }: { editor: Editor }) {
  const sizes = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px'];

  // 現在のフォントサイズを取得
  const currentSize = editor.getAttributes('fontSize')?.size ?? '';

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '') {
      editor.commands.unsetFontSize();
    } else {
      editor.commands.setFontSize(value);
    }
    editor.chain().focus().run();
  };

  return (
    <select
      value={currentSize}
      onChange={handleChange}
      className="text-xs border border-gray-300 rounded px-1 py-1 bg-white text-gray-700 cursor-pointer hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 w-[72px]"
      title="フォントサイズ"
      aria-label="フォントサイズ"
    >
      <option value="">サイズ</option>
      {sizes.map((size) => (
        <option key={size} value={size}>
          {size}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// テキスト配置ボタン
// ---------------------------------------------------------------------------

function TextAlignButtons({ editor }: { editor: Editor }) {
  const aligns: Array<{ value: string; icon: React.ReactNode; label: string }> =
    [
      {
        value: 'left',
        label: '左揃え',
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="0" y="1" width="14" height="2" rx="0.5" />
            <rect x="0" y="5" width="10" height="2" rx="0.5" />
            <rect x="0" y="9" width="12" height="2" rx="0.5" />
          </svg>
        ),
      },
      {
        value: 'center',
        label: '中央揃え',
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="0" y="1" width="14" height="2" rx="0.5" />
            <rect x="2" y="5" width="10" height="2" rx="0.5" />
            <rect x="1" y="9" width="12" height="2" rx="0.5" />
          </svg>
        ),
      },
      {
        value: 'right',
        label: '右揃え',
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="0" y="1" width="14" height="2" rx="0.5" />
            <rect x="4" y="5" width="10" height="2" rx="0.5" />
            <rect x="2" y="9" width="12" height="2" rx="0.5" />
          </svg>
        ),
      },
      {
        value: 'justify',
        label: '均等割付',
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="0" y="1" width="14" height="2" rx="0.5" />
            <rect x="0" y="5" width="14" height="2" rx="0.5" />
            <rect x="0" y="9" width="14" height="2" rx="0.5" />
          </svg>
        ),
      },
    ];

  return (
    <>
      {aligns.map(({ value, icon, label }) => (
        <ToolbarButton
          key={value}
          icon={icon}
          tooltip={label}
          active={editor.isActive({ textAlign: value })}
          onClick={() => editor.commands.setTextAlign(value)}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// セマンティックブロック挿入ドロップダウン
// ---------------------------------------------------------------------------

function SemanticBlockDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const elements = [
    { tag: 'section', label: 'section' },
    { tag: 'article', label: 'article' },
    { tag: 'header', label: 'header' },
    { tag: 'footer', label: 'footer' },
    { tag: 'nav', label: 'nav' },
  ];

  // 現在カーソル位置のセマンティック要素タグを取得
  const activeTag = editor.isActive('semanticBlock')
    ? (editor.getAttributes('semanticBlock')?.tag as string) || 'section'
    : null;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        title="セマンティック要素を挿入"
        aria-label="セマンティック要素を挿入"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-0.5 px-1.5 h-8 rounded transition-colors ${
          activeTag
            ? 'bg-blue-100 text-blue-700'
            : open
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <span className="text-[10px] font-mono">
          &lt;{activeTag || 'section'}&gt;
        </span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className="opacity-50">
          <path d="M1 3l3 3 3-3H1z" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[140px] py-1">
          {elements.map(({ tag, label }) => (
            <button
              key={tag}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                activeTag === tag
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => {
                editor.commands.insertSemanticBlock(tag);
                setOpen(false);
              }}
            >
              &lt;{label}&gt;
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 共通コンポーネント
// ---------------------------------------------------------------------------

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
        active
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {icon}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-gray-300 mx-1 flex-shrink-0" />;
}
