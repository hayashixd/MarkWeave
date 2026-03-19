/**
 * Zenn 記法挿入パレット
 *
 * Zenn プロファイル有効時のみ表示される、
 * Zenn 固有記法を素早く挿入するためのパレット。
 *
 * :::message / :::message alert / :::details は ZennMessageBlock / ZennDetailsBlock
 * カスタムノードとして直接挿入し、即座に WYSIWYG 表示される。
 * @[...] 埋め込み記法は段落テキストとして挿入（Zenn 独自、WYSIWYG 非対応）。
 */

import type { Editor } from '@tiptap/react';

interface ZennSyntaxPaletteProps {
  editor: Editor;
}

export function ZennSyntaxPalette({ editor }: ZennSyntaxPaletteProps) {
  const insertMessageBlock = (messageType: 'message' | 'alert') => {
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'zennMessageBlock',
        attrs: {
          messageType,
          content: messageType === 'alert' ? '警告メッセージ内容' : 'メッセージ内容',
        },
      })
      .run();
  };

  const insertDetailsBlock = () => {
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'zennDetailsBlock',
        attrs: { title: 'タイトル', content: '折りたたみ内容' },
      })
      .run();
  };

  const insertEmbed = (lines: string[]) => {
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

      {/* ブロック記法 → ZennBlock ノードとして挿入 */}
      <button
        type="button"
        title="メッセージブロックを挿入"
        onClick={() => insertMessageBlock('message')}
        className="text-xs px-2 py-0.5 rounded border border-blue-200 bg-white text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors flex-shrink-0 font-mono"
      >
        :::message
      </button>
      <button
        type="button"
        title="警告ブロックを挿入"
        onClick={() => insertMessageBlock('alert')}
        className="text-xs px-2 py-0.5 rounded border border-blue-200 bg-white text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors flex-shrink-0 font-mono"
      >
        :::message alert
      </button>
      <button
        type="button"
        title="アコーディオンを挿入"
        onClick={() => insertDetailsBlock()}
        className="text-xs px-2 py-0.5 rounded border border-blue-200 bg-white text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors flex-shrink-0 font-mono"
      >
        :::details
      </button>

      {/* 埋め込み記法 → 段落テキストとして挿入 */}
      <button
        type="button"
        title="YouTube 動画を埋め込む"
        onClick={() => insertEmbed(['@[youtube](VIDEO_ID)'])}
        className="text-xs px-2 py-0.5 rounded border border-blue-200 bg-white text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors flex-shrink-0 font-mono"
      >
        @[youtube]
      </button>
      <button
        type="button"
        title="ツイートを埋め込む"
        onClick={() => insertEmbed(['@[tweet](https://twitter.com/user/status/ID)'])}
        className="text-xs px-2 py-0.5 rounded border border-blue-200 bg-white text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors flex-shrink-0 font-mono"
      >
        @[tweet]
      </button>
      <button
        type="button"
        title="SpeakerDeck スライドを埋め込む"
        onClick={() => insertEmbed(['@[speakerdeck](SLIDE_ID)'])}
        className="text-xs px-2 py-0.5 rounded border border-blue-200 bg-white text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors flex-shrink-0 font-mono"
      >
        @[speakerdeck]
      </button>
      <button
        type="button"
        title="CodeSandbox を埋め込む"
        onClick={() => insertEmbed(['@[codesandbox](https://codesandbox.io/embed/SANDBOX_ID)'])}
        className="text-xs px-2 py-0.5 rounded border border-blue-200 bg-white text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors flex-shrink-0 font-mono"
      >
        @[codesandbox]
      </button>
    </div>
  );
}
