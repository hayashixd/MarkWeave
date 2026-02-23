/**
 * AST（抽象構文木）型定義
 *
 * マークダウンドキュメントの内部表現。
 * mdast仕様 (https://github.com/syntax-tree/mdast) に準拠。
 */

// ブロックノード
export type BlockNode =
  | Heading
  | Paragraph
  | Table
  | CodeBlock
  | BlockQuote
  | List
  | ListItem
  | ThematicBreak
  | MathBlock
  | Html;

// インラインノード
export type InlineNode =
  | Text
  | Strong
  | Emphasis
  | Delete
  | InlineCode
  | Link
  | Image
  | MathInline
  | Break;

export interface Root {
  type: 'root';
  children: BlockNode[];
}

export interface Heading {
  type: 'heading';
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  children: InlineNode[];
}

export interface Paragraph {
  type: 'paragraph';
  children: InlineNode[];
}

export interface Table {
  type: 'table';
  align: ('left' | 'right' | 'center' | null)[];
  children: TableRow[];
}

export interface TableRow {
  type: 'tableRow';
  children: TableCell[];
}

export interface TableCell {
  type: 'tableCell';
  children: InlineNode[];
}

export interface CodeBlock {
  type: 'code';
  lang: string | null;
  value: string;
}

export interface BlockQuote {
  type: 'blockquote';
  children: BlockNode[];
}

export interface List {
  type: 'list';
  ordered: boolean;
  start: number | null;
  spread: boolean;
  children: ListItem[];
}

export interface ListItem {
  type: 'listItem';
  checked: boolean | null;
  spread: boolean;
  children: BlockNode[];
}

export interface ThematicBreak {
  type: 'thematicBreak';
}

export interface MathBlock {
  type: 'math';
  value: string;
}

export interface Html {
  type: 'html';
  value: string;
}

// インライン要素
export interface Text {
  type: 'text';
  value: string;
}

export interface Strong {
  type: 'strong';
  children: InlineNode[];
}

export interface Emphasis {
  type: 'emphasis';
  children: InlineNode[];
}

export interface Delete {
  type: 'delete';
  children: InlineNode[];
}

export interface InlineCode {
  type: 'inlineCode';
  value: string;
}

export interface Link {
  type: 'link';
  url: string;
  title: string | null;
  children: InlineNode[];
}

export interface Image {
  type: 'image';
  url: string;
  title: string | null;
  alt: string;
}

export interface MathInline {
  type: 'inlineMath';
  value: string;
}

export interface Break {
  type: 'break';
}
