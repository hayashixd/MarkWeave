/**
 * スラッシュコマンド定義
 *
 * slash-commands-design.md §3 に準拠。
 * ペルソナ: 一般ライター・テクニカルライター・AIパワーユーザー
 */

import type { Editor } from '@tiptap/react';

export type SlashCommandCategory =
  | 'text'       // テキスト・見出し
  | 'list'       // リスト
  | 'block'      // ブロック要素
  | 'code'       // コード・数式
  | 'table'      // テーブル
  | 'media'      // メディア
  | 'ai'         // AI テンプレート
  | 'pkm'        // ナレッジ管理
  | 'snippet';   // ユーザースニペット

export interface SlashCommandDef {
  id: string;
  category: SlashCommandCategory;
  /** 表示名 */
  name: string;
  /** 検索キーワード（スペース区切りで複数登録） */
  keywords: string;
  /** 説明テキスト */
  description: string;
  /** カテゴリ絵文字アイコン */
  icon: string;
  /** コマンド実行関数 */
  action: (editor: Editor) => void;
}

export const CATEGORY_LABELS: Record<SlashCommandCategory, string> = {
  text: 'テキスト・見出し',
  list: 'リスト',
  block: 'ブロック',
  code: 'コード・数式',
  table: 'テーブル',
  media: 'メディア',
  ai: 'AI テンプレート',
  pkm: 'ナレッジ管理',
  snippet: 'スニペット',
};

export const SLASH_COMMANDS: SlashCommandDef[] = [
  // ===== テキスト・見出し =====
  {
    id: 'h1',
    category: 'text',
    name: '見出し H1',
    keywords: 'h1 heading1 見出し1 heading 見出し',
    description: '大きな見出し',
    icon: '🔠',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: 'h2',
    category: 'text',
    name: '見出し H2',
    keywords: 'h2 heading2 見出し2 heading 見出し',
    description: '中くらいの見出し',
    icon: '🔡',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'h3',
    category: 'text',
    name: '見出し H3',
    keywords: 'h3 heading3 見出し3 heading 見出し',
    description: '小さな見出し',
    icon: '🔤',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: 'h4',
    category: 'text',
    name: '見出し H4',
    keywords: 'h4 heading4 見出し4',
    description: '小見出し',
    icon: '📝',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 4 }).run(),
  },
  {
    id: 'paragraph',
    category: 'text',
    name: '段落',
    keywords: 'paragraph text 段落 テキスト 本文',
    description: '通常の段落テキスト',
    icon: '¶',
    action: (editor) => editor.chain().focus().setParagraph().run(),
  },

  // ===== リスト =====
  {
    id: 'bullet-list',
    category: 'list',
    name: '箇条書きリスト',
    keywords: 'ul list bullet リスト 箇条書き 点',
    description: '点付きリスト',
    icon: '•',
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'ordered-list',
    category: 'list',
    name: '番号付きリスト',
    keywords: 'ol ordered 番号 numbered list',
    description: '番号付きリスト',
    icon: '1.',
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'task-list',
    category: 'list',
    name: 'タスクリスト',
    keywords: 'todo task checkbox チェック タスク done',
    description: 'チェックボックス付きリスト',
    icon: '☑',
    action: (editor) => editor.chain().focus().toggleTaskList().run(),
  },

  // ===== ブロック =====
  {
    id: 'blockquote',
    category: 'block',
    name: '引用ブロック',
    keywords: 'quote blockquote 引用 名言 citation',
    description: '引用文を挿入',
    icon: '❝',
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'hr',
    category: 'block',
    name: '区切り線',
    keywords: 'hr divider line 区切り 水平線 separator',
    description: '水平の区切り線',
    icon: '—',
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },

  // ===== コード・数式 =====
  {
    id: 'code-block',
    category: 'code',
    name: 'コードブロック',
    keywords: 'code codeblock コード ソース source syntax',
    description: 'シンタックスハイライト付きコード',
    icon: '💻',
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'math-block',
    category: 'code',
    name: '数式（ブロック）',
    keywords: 'math formula 数式 数学 katex latex equation',
    description: 'KaTeX ブロック数式',
    icon: '𝒇',
    action: (editor) =>
      editor.chain().focus().insertContent({
        type: 'mathBlock',
        attrs: { content: 'E = mc^2' },
      }).run(),
  },
  {
    id: 'mermaid',
    category: 'code',
    name: 'Mermaid 図',
    keywords: 'mermaid diagram 図 chart フロー flow graph',
    description: 'Mermaid 図表を挿入',
    icon: '📊',
    action: (editor) =>
      editor.chain().focus().insertContent({
        type: 'codeBlock',
        attrs: { language: 'mermaid' },
        content: [{ type: 'text', text: 'graph TD\n    A --> B' }],
      }).run(),
  },

  // ===== テーブル =====
  {
    id: 'table-2x2',
    category: 'table',
    name: 'テーブル',
    keywords: 'table テーブル 表 grid 格子',
    description: '2列×2行のテーブルを挿入',
    icon: '⊞',
    action: (editor) =>
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 2, withHeaderRow: true })
        .run(),
  },
  {
    id: 'table-3x3',
    category: 'table',
    name: 'テーブル (3×3)',
    keywords: 'table 3x3 テーブル 3列 表',
    description: '3列×3行のテーブルを挿入',
    icon: '⊡',
    action: (editor) =>
      editor
        .chain()
        .focus()
        .insertTable({ rows: 4, cols: 3, withHeaderRow: true })
        .run(),
  },

  // ===== AI テンプレート =====
  {
    id: 'ai-template-panel',
    category: 'ai',
    name: 'AIテンプレート一覧',
    keywords: 'template テンプレート ai ブログ blog 要約 summary',
    description: 'テンプレートパネルを開く',
    icon: '✨',
    action: (_editor) => {
      // サイドバーのAIタブを開く
      window.dispatchEvent(new CustomEvent('open-ai-templates'));
    },
  },
  {
    id: 'ai-blog',
    category: 'ai',
    name: 'ブログ構成案',
    keywords: 'blog ブログ 記事 article ai',
    description: 'ブログ記事のAIテンプレートを挿入',
    icon: '📰',
    action: (_editor) => {
      window.dispatchEvent(new CustomEvent('open-ai-template', { detail: { templateId: 'blog-structure' } }));
    },
  },
  {
    id: 'ai-code-review',
    category: 'ai',
    name: 'コードレビュー依頼',
    keywords: 'code review コード レビュー ai',
    description: 'コードレビュー依頼テンプレートを挿入',
    icon: '🔍',
    action: (_editor) => {
      window.dispatchEvent(new CustomEvent('open-ai-template', { detail: { templateId: 'code-review' } }));
    },
  },
  {
    id: 'ai-meeting',
    category: 'ai',
    name: '議事録テンプレート',
    keywords: 'meeting 会議 議事録 minutes ai',
    description: '会議メモのテンプレートを挿入',
    icon: '📋',
    action: (_editor) => {
      window.dispatchEvent(new CustomEvent('open-ai-template', { detail: { templateId: 'meeting-notes' } }));
    },
  },
  // ===== ナレッジ管理 =====
  {
    id: 'daily-note',
    category: 'pkm',
    name: 'デイリーノート',
    keywords: 'daily デイリー 日記 journal today 今日 ノート note',
    description: '今日の日付でデイリーノートを新規作成',
    icon: '📅',
    action: (_editor) => {
      window.dispatchEvent(new CustomEvent('create-daily-note'));
    },
  },
  {
    id: 'wikilink',
    category: 'pkm',
    name: 'Wikiリンク挿入',
    keywords: 'wikilink ウィキ リンク link 参照 [[',
    description: '[[ファイル名]] 形式のWikiリンクを挿入開始',
    icon: '🔗',
    action: (editor) => {
      editor.chain().focus().insertContent('[[').run();
    },
  },
  {
    id: 'front-matter',
    category: 'pkm',
    name: 'Front Matter 追加',
    keywords: 'yaml frontmatter フロントマター メタデータ metadata',
    description: 'YAML Front Matter を追加（タイトル・日付・タグ）',
    icon: '📄',
    action: (_editor) => {
      window.dispatchEvent(new CustomEvent('add-front-matter'));
    },
  },
];

/**
 * クエリで候補を絞り込む（簡易ファジーマッチ）。
 * fuse.js が使えない環境のため、includes ベースの実装。
 *
 * @param query フィルタ文字列
 * @param extraCommands 動的に追加するコマンド（スニペット等）
 */
export function filterCommands(query: string, extraCommands: SlashCommandDef[] = []): SlashCommandDef[] {
  const all = [...SLASH_COMMANDS, ...extraCommands];
  if (!query.trim()) return all;

  const q = query.toLowerCase().trim();
  return all.filter((cmd) => {
    const searchText = `${cmd.name} ${cmd.keywords} ${cmd.description}`.toLowerCase();
    // 各単語に対してパーシャルマッチ
    return q.split('').every((ch) => searchText.includes(ch)) || searchText.includes(q);
  });
}
