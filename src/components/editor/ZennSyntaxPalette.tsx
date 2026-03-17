/**
 * Zenn 記法挿入パレット
 *
 * Zenn プロファイル有効時のみ表示される、
 * Zenn 固有記法（:::message, @[youtube] 等）を素早く挿入するためのパレット。
 *
 * 挿入は TipTap JSON ノード配列として行うことで、
 * raw テキストとして段落に変換されラウンドトリップを保つ。
 */

import type { Editor } from '@tiptap/react';

interface ZennSyntaxPaletteProps {
  editor: Editor;
}

interface PaletteItem {
  label: string;
  title: string;
  /** エディタに挿入する段落のテキスト行 */
  lines: string[];
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    label: ':::message',
    title: 'メッセージブロックを挿入',
    lines: [':::message', 'メッセージ内容', ':::'],
  },
  {
    label: ':::message alert',
    title: '警告ブロックを挿入',
    lines: [':::message alert', '警告メッセージ内容', ':::'],
  },
  {
    label: ':::details',
    title: 'アコーディオンを挿入',
    lines: [':::details タイトル', '折りたたみ内容', ':::'],
  },
  {
    label: '@[youtube]',
    title: 'YouTube 動画を埋め込む',
    lines: ['@[youtube](VIDEO_ID)'],
  },
  {
    label: '@[tweet]',
    title: 'ツイートを埋め込む',
    lines: ['@[tweet](https://twitter.com/user/status/ID)'],
  },
  {
    label: '@[speakerdeck]',
    title: 'SpeakerDeck スライドを埋め込む',
    lines: ['@[speakerdeck](SLIDE_ID)'],
  },
  {
    label: '@[codesandbox]',
    title: 'CodeSandbox を埋め込む',
    lines: ['@[codesandbox](https://codesandbox.io/embed/SANDBOX_ID)'],
  },
];

export function ZennSyntaxPalette({ editor }: ZennSyntaxPaletteProps) {
  const insertBlock = (lines: string[]) => {
    const nodes = lines.map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    }));
    editor.chain().focus().insertContent(nodes).run();
  };

  return (
    <div
      className="zenn-syntax-palette flex items-center gap-1 px-3 py-1 border-b border-blue-100 bg-blue-50 flex-wrap"
      role="toolbar"
      aria-label="Zenn 記法パレット"
    >
      <span className="text-xs text-blue-500 font-medium mr-1 flex-shrink-0">Zenn:</span>
      {PALETTE_ITEMS.map((item) => (
        <button
          key={item.label}
          type="button"
          title={item.title}
          onClick={() => insertBlock(item.lines)}
          className="text-xs px-2 py-0.5 rounded border border-blue-200 bg-white text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors flex-shrink-0 font-mono"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
