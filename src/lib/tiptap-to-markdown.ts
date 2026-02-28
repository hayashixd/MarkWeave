/**
 * TipTap JSON → Markdown 変換
 *
 * TipTap (ProseMirror) の JSON 構造を Markdown テキストに変換する。
 *
 * 正規化ルール（markdown-tiptap-conversion.md に準拠）:
 * - 見出し: ATX形式 (`# H1`)
 * - リストマーカー: `-`
 * - 強調: `**text**`
 * - 斜体: `*text*`
 * - ファイル末尾: 単一改行 `\n`
 * - テーブル: GFM パイプ記法
 */

import type { TipTapDoc, TipTapNode, TipTapMark } from './markdown-to-tiptap';

/**
 * TipTap JSON ドキュメントを Markdown 文字列に変換する
 */
export function tiptapToMarkdown(doc: TipTapDoc): string {
  if (!doc.content || doc.content.length === 0) {
    return '';
  }

  const blocks = doc.content.map((node, index) =>
    serializeBlockNode(node, index, doc.content!),
  );

  // ブロック間に空行を挿入し、末尾に改行を追加
  return blocks.join('\n\n') + '\n';
}

function serializeBlockNode(
  node: TipTapNode,
  _index: number,
  _siblings: TipTapNode[],
): string {
  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1;
      const prefix = '#'.repeat(level);
      const text = serializeInlineContent(node.content);
      return `${prefix} ${text}`;
    }

    case 'paragraph': {
      return serializeInlineContent(node.content);
    }

    case 'bulletList': {
      return serializeList(node, false);
    }

    case 'orderedList': {
      return serializeList(node, true);
    }

    case 'taskList': {
      return serializeTaskList(node);
    }

    case 'blockquote': {
      if (!node.content) return '>';
      const inner = node.content
        .map((child, i) => serializeBlockNode(child, i, node.content!))
        .join('\n\n');
      return inner
        .split('\n')
        .map((line) => (line === '' ? '>' : `> ${line}`))
        .join('\n');
    }

    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? '';
      const code = node.content?.map((c) => c.text ?? '').join('') ?? '';
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }

    case 'horizontalRule':
      return '---';

    case 'table':
      return serializeTable(node);

    case 'mathBlock': {
      const latex = (node.attrs?.latex as string) ?? '';
      return `$$\n${latex}\n$$`;
    }

    case 'mermaidBlock': {
      const mermaidCode = (node.attrs?.code as string) ?? '';
      return `\`\`\`mermaid\n${mermaidCode}\n\`\`\``;
    }

    default:
      return '';
  }
}

/**
 * テーブルノードを GFM パイプ記法の Markdown に変換する。
 *
 * ヘッダー行（1行目）のセルに設定された style 属性から
 * text-align を読み取ってセパレータ行に反映する。
 */
function serializeTable(node: TipTapNode): string {
  if (!node.content || node.content.length === 0) return '';

  const rows = node.content;
  const headerRow = rows[0];
  const bodyRows = rows.slice(1);

  if (!headerRow || !headerRow.content || headerRow.content.length === 0) return '';

  const colCount = headerRow.content.length;

  // ヘッダーセルのスタイルから配置を抽出
  const alignments = headerRow.content.map((cell) => {
    const style = cell.attrs?.style as string | undefined;
    if (!style) return null;
    if (style.includes('text-align: center')) return 'center';
    if (style.includes('text-align: right')) return 'right';
    if (style.includes('text-align: left')) return 'left';
    return null;
  });

  // ヘッダー行
  const headerCells = headerRow.content.map((cell) => {
    const para = cell.content?.[0];
    return serializeInlineContent(para?.content) || ' ';
  });
  const headerLine = `| ${headerCells.join(' | ')} |`;

  // セパレータ行（配置記号付き）
  const separatorCells = alignments.map((align) => {
    if (align === 'center') return ':---:';
    if (align === 'right') return '---:';
    if (align === 'left') return ':---';
    return '---';
  });
  const separatorLine = `| ${separatorCells.join(' | ')} |`;

  // データ行
  const bodyLines = bodyRows.map((row) => {
    if (!row.content) return `| ${' |'.repeat(colCount)}`;
    const cells = row.content.map((cell) => {
      const para = cell.content?.[0];
      return serializeInlineContent(para?.content) || ' ';
    });
    // 列数が足りない場合は空セルで補完
    while (cells.length < colCount) cells.push(' ');
    return `| ${cells.join(' | ')} |`;
  });

  return [headerLine, separatorLine, ...bodyLines].join('\n');
}

function serializeList(node: TipTapNode, ordered: boolean): string {
  if (!node.content) return '';

  const startNum = (node.attrs?.start as number) ?? 1;

  return node.content
    .map((item, idx) => {
      const marker = ordered ? `${startNum + idx}.` : '-';
      return serializeListItem(item, marker);
    })
    .join('\n');
}

function serializeListItem(node: TipTapNode, marker: string): string {
  if (!node.content) return marker;

  const parts: string[] = [];

  for (let i = 0; i < node.content.length; i++) {
    const child = node.content[i]!;

    if (child.type === 'paragraph') {
      const text = serializeInlineContent(child.content);
      if (i === 0) {
        parts.push(`${marker} ${text}`);
      } else {
        // 2つ目以降の段落はインデント
        const indent = ' '.repeat(marker.length + 1);
        parts.push(`\n${indent}${text}`);
      }
    } else if (
      child.type === 'bulletList' ||
      child.type === 'orderedList' ||
      child.type === 'taskList'
    ) {
      // ネストされたリスト
      const indent = ' '.repeat(marker.length + 1);
      const nested = serializeBlockNode(child, i, node.content);
      const indented = nested
        .split('\n')
        .map((line) => `${indent}${line}`)
        .join('\n');
      parts.push(indented);
    }
  }

  return parts.join('\n');
}

function serializeTaskList(node: TipTapNode): string {
  if (!node.content) return '';

  return node.content
    .map((item) => serializeTaskItem(item))
    .join('\n');
}

function serializeTaskItem(node: TipTapNode): string {
  if (!node.content) return '- [ ]';

  const checked = node.attrs?.checked === true;
  const checkbox = checked ? '[x]' : '[ ]';
  const parts: string[] = [];

  for (let i = 0; i < node.content.length; i++) {
    const child = node.content[i]!;

    if (child.type === 'paragraph') {
      const text = serializeInlineContent(child.content);
      if (i === 0) {
        parts.push(`- ${checkbox} ${text}`);
      } else {
        parts.push(`\n  ${text}`);
      }
    } else if (
      child.type === 'bulletList' ||
      child.type === 'orderedList' ||
      child.type === 'taskList'
    ) {
      const nested = serializeBlockNode(child, i, node.content);
      const indented = nested
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n');
      parts.push(indented);
    }
  }

  return parts.join('\n');
}

/**
 * インラインコンテンツを Markdown テキストに変換する。
 *
 * TipTap のフラットな marks 構造を解析し、
 * マークのスパン（開始・終了位置）を計算して適切に Markdown 記法を出力する。
 */
function serializeInlineContent(nodes?: TipTapNode[]): string {
  if (!nodes || nodes.length === 0) return '';

  const result: string[] = [];

  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      // CommonMark 仕様: 末尾スペース2つ + 改行 (trailing spaces + newline)
      result.push('  \n');
      continue;
    }

    if (node.type === 'mathInline') {
      const latex = (node.attrs?.latex as string) ?? '';
      result.push(`$${latex}$`);
      continue;
    }

    if (node.type !== 'text' || node.text == null) continue;

    let text = node.text;
    const marks = node.marks ?? [];

    // マークを内側から外側の順に適用
    // ProseMirror のマーク順序: bold, italic, code, link, strike, ...
    text = applyMarks(text, marks);
    result.push(text);
  }

  return result.join('');
}

function applyMarks(text: string, marks: TipTapMark[]): string {
  // code マークは他のマークと共存しないため先に処理
  const hasCode = marks.some((m) => m.type === 'code');
  if (hasCode) {
    return `\`${text}\``;
  }

  let result = text;

  // 内側から外側の順にラップ
  // italic → bold → strike → link
  const hasItalic = marks.some((m) => m.type === 'italic');
  const hasBold = marks.some((m) => m.type === 'bold');
  const hasStrike = marks.some((m) => m.type === 'strike');
  const linkMark = marks.find((m) => m.type === 'link');

  if (hasItalic) {
    result = `*${result}*`;
  }
  if (hasBold) {
    result = `**${result}**`;
  }
  if (hasStrike) {
    result = `~~${result}~~`;
  }
  if (linkMark) {
    const href = (linkMark.attrs?.href as string) ?? '';
    const title = linkMark.attrs?.title as string | undefined;
    if (title) {
      result = `[${result}](${href} "${title}")`;
    } else {
      result = `[${result}](${href})`;
    }
  }

  return result;
}
