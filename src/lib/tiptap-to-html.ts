/**
 * TipTap JSON → HTML 変換
 *
 * TipTap (ProseMirror) の JSON 構造を HTML テキストに変換する。
 * tiptap-to-markdown.ts と対になるモジュール。
 *
 * 設計書: docs/05_Features/HTML/html-editing-design.md §5, §6
 */

import type { TipTapDoc, TipTapNode, TipTapMark } from './markdown-to-tiptap';
import type { HtmlMetadata } from './html-to-tiptap';

/**
 * TipTap JSON ドキュメントを HTML 文字列に変換する。
 *
 * @param doc      - TipTap JSON ドキュメント
 * @param metadata - HTMLメタデータ（フルドキュメント出力時に使用）
 * @param options  - シリアライズオプション
 * @returns HTML文字列
 */
export function tiptapToHtml(
  doc: TipTapDoc,
  metadata?: HtmlMetadata,
  options: HtmlSerializeOptions = {},
): string {
  const { fullDocument = true, indent = '  ' } = options;

  if (!doc.content || doc.content.length === 0) {
    if (fullDocument) {
      return buildFullDocument('', metadata, indent);
    }
    return '';
  }

  const bodyHtml = doc.content
    .map((node) => serializeBlockNode(node, indent, 0))
    .join('\n');

  if (fullDocument) {
    return buildFullDocument(bodyHtml, metadata, indent);
  }

  return bodyHtml + '\n';
}

export interface HtmlSerializeOptions {
  /** 完全なHTML文書として出力するか（デフォルト: true） */
  fullDocument?: boolean;
  /** インデント文字列（デフォルト: '  '） */
  indent?: string;
}

// ---------------------------------------------------------------------------
// フルドキュメント構築
// ---------------------------------------------------------------------------

function buildFullDocument(
  bodyHtml: string,
  metadata?: HtmlMetadata,
  indent = '  ',
): string {
  const title = escapeHtml(metadata?.title ?? '');
  const lines: string[] = [
    '<!DOCTYPE html>',
    '<html lang="ja">',
    '<head>',
    `${indent}<meta charset="UTF-8">`,
    `${indent}<meta name="viewport" content="width=device-width, initial-scale=1.0">`,
    `${indent}<title>${title}</title>`,
  ];

  if (metadata?.metaDescription) {
    lines.push(
      `${indent}<meta name="description" content="${escapeAttr(metadata.metaDescription)}">`,
    );
  }

  if (metadata?.cssLinks) {
    for (const href of metadata.cssLinks) {
      lines.push(`${indent}<link rel="stylesheet" href="${escapeAttr(href)}">`);
    }
  }

  if (metadata?.scriptLinks) {
    for (const src of metadata.scriptLinks) {
      lines.push(`${indent}<script src="${escapeAttr(src)}"></script>`);
    }
  }

  lines.push('</head>', '<body>');

  if (bodyHtml) {
    lines.push(bodyHtml);
  }

  lines.push('</body>', '</html>', '');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// ブロックノードのシリアライズ
// ---------------------------------------------------------------------------

function serializeBlockNode(
  node: TipTapNode,
  indent: string,
  depth: number,
): string {
  const pad = indent.repeat(depth);

  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1;
      const tag = `h${level}`;
      const content = serializeInlineContent(node.content);
      return `${pad}<${tag}>${content}</${tag}>`;
    }

    case 'paragraph': {
      const content = serializeInlineContent(node.content);
      return `${pad}<p>${content}</p>`;
    }

    case 'bulletList': {
      if (!node.content) return `${pad}<ul></ul>`;
      const items = node.content
        .map((item) => serializeListItem(item, indent, depth + 1))
        .join('\n');
      return `${pad}<ul>\n${items}\n${pad}</ul>`;
    }

    case 'orderedList': {
      if (!node.content) return `${pad}<ol></ol>`;
      const start = (node.attrs?.start as number) ?? 1;
      const startAttr = start !== 1 ? ` start="${start}"` : '';
      const items = node.content
        .map((item) => serializeListItem(item, indent, depth + 1))
        .join('\n');
      return `${pad}<ol${startAttr}>\n${items}\n${pad}</ol>`;
    }

    case 'taskList': {
      if (!node.content) return `${pad}<ul></ul>`;
      const items = node.content
        .map((item) => serializeTaskItem(item, indent, depth + 1))
        .join('\n');
      return `${pad}<ul>\n${items}\n${pad}</ul>`;
    }

    case 'blockquote': {
      if (!node.content) return `${pad}<blockquote></blockquote>`;
      const content = node.content
        .map((child) => serializeBlockNode(child, indent, depth + 1))
        .join('\n');
      return `${pad}<blockquote>\n${content}\n${pad}</blockquote>`;
    }

    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? '';
      const code =
        node.content?.map((c) => c.text ?? '').join('') ?? '';
      const langAttr = lang ? ` class="language-${escapeAttr(lang)}"` : '';
      return `${pad}<pre><code${langAttr}>${escapeHtml(code)}</code></pre>`;
    }

    case 'horizontalRule':
      return `${pad}<hr>`;

    case 'table':
      return serializeTable(node, indent, depth);

    case 'mathBlock': {
      const latex = (node.attrs?.latex as string) ?? '';
      return `${pad}<div class="math-block">$$${escapeHtml(latex)}$$</div>`;
    }

    case 'mermaidBlock': {
      const mermaidCode = (node.attrs?.code as string) ?? '';
      return `${pad}<pre class="mermaid">${escapeHtml(mermaidCode)}</pre>`;
    }

    case 'divBlock': {
      const className = node.attrs?.class as string | undefined;
      const classAttr = className ? ` class="${escapeAttr(className)}"` : '';
      if (!node.content) return `${pad}<div${classAttr}></div>`;
      const content = node.content
        .map((child) => serializeBlockNode(child, indent, depth + 1))
        .join('\n');
      return `${pad}<div${classAttr}>\n${content}\n${pad}</div>`;
    }

    case 'semanticBlock': {
      const tag = (node.attrs?.tag as string) ?? 'section';
      if (!node.content) return `${pad}<${tag}></${tag}>`;
      const content = node.content
        .map((child) => serializeBlockNode(child, indent, depth + 1))
        .join('\n');
      return `${pad}<${tag}>\n${content}\n${pad}</${tag}>`;
    }

    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// リスト項目のシリアライズ
// ---------------------------------------------------------------------------

function serializeListItem(
  node: TipTapNode,
  indent: string,
  depth: number,
): string {
  const pad = indent.repeat(depth);

  if (!node.content) return `${pad}<li></li>`;

  if (
    node.content.length === 1 &&
    node.content[0]!.type === 'paragraph'
  ) {
    const content = serializeInlineContent(node.content[0]!.content);
    return `${pad}<li>${content}</li>`;
  }

  const content = node.content
    .map((child) => serializeBlockNode(child, indent, depth + 1))
    .join('\n');
  return `${pad}<li>\n${content}\n${pad}</li>`;
}

function serializeTaskItem(
  node: TipTapNode,
  indent: string,
  depth: number,
): string {
  const pad = indent.repeat(depth);
  const checked = node.attrs?.checked === true;
  const checkedAttr = checked ? ' checked' : '';

  if (!node.content) {
    return `${pad}<li><input type="checkbox"${checkedAttr} disabled></li>`;
  }

  if (
    node.content.length === 1 &&
    node.content[0]!.type === 'paragraph'
  ) {
    const content = serializeInlineContent(node.content[0]!.content);
    return `${pad}<li><input type="checkbox"${checkedAttr} disabled> ${content}</li>`;
  }

  const firstPara = node.content[0];
  const rest = node.content.slice(1);
  let result = `${pad}<li>\n`;
  if (firstPara?.type === 'paragraph') {
    const content = serializeInlineContent(firstPara.content);
    result += `${indent.repeat(depth + 1)}<p><input type="checkbox"${checkedAttr} disabled> ${content}</p>\n`;
  }
  for (const child of rest) {
    result += serializeBlockNode(child, indent, depth + 1) + '\n';
  }
  result += `${pad}</li>`;
  return result;
}

// ---------------------------------------------------------------------------
// テーブルのシリアライズ
// ---------------------------------------------------------------------------

function serializeTable(
  node: TipTapNode,
  indent: string,
  depth: number,
): string {
  if (!node.content || node.content.length === 0) return '';

  const pad = indent.repeat(depth);
  const rows = node.content;

  // 最初の行がヘッダーかどうか判定
  const firstRow = rows[0]!;
  const isHeader = firstRow.content?.some(
    (cell) => cell.type === 'tableHeader',
  );

  const lines: string[] = [`${pad}<table>`];

  if (isHeader) {
    lines.push(`${indent.repeat(depth + 1)}<thead>`);
    lines.push(serializeTableRow(firstRow, indent, depth + 2));
    lines.push(`${indent.repeat(depth + 1)}</thead>`);

    if (rows.length > 1) {
      lines.push(`${indent.repeat(depth + 1)}<tbody>`);
      for (let i = 1; i < rows.length; i++) {
        lines.push(serializeTableRow(rows[i]!, indent, depth + 2));
      }
      lines.push(`${indent.repeat(depth + 1)}</tbody>`);
    }
  } else {
    lines.push(`${indent.repeat(depth + 1)}<tbody>`);
    for (const row of rows) {
      lines.push(serializeTableRow(row, indent, depth + 2));
    }
    lines.push(`${indent.repeat(depth + 1)}</tbody>`);
  }

  lines.push(`${pad}</table>`);
  return lines.join('\n');
}

function serializeTableRow(
  row: TipTapNode,
  indent: string,
  depth: number,
): string {
  const pad = indent.repeat(depth);

  if (!row.content) return `${pad}<tr></tr>`;

  const cells = row.content
    .map((cell) => {
      const tag = cell.type === 'tableHeader' ? 'th' : 'td';
      const attrs: string[] = [];

      const colspan = cell.attrs?.colspan as number | undefined;
      const rowspan = cell.attrs?.rowspan as number | undefined;
      const style = cell.attrs?.style as string | undefined;

      if (colspan && colspan > 1) attrs.push(`colspan="${colspan}"`);
      if (rowspan && rowspan > 1) attrs.push(`rowspan="${rowspan}"`);
      if (style) attrs.push(`style="${escapeAttr(style)}"`);

      const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
      const content = cell.content
        ?.map((child) => {
          if (child.type === 'paragraph') {
            return serializeInlineContent(child.content);
          }
          return serializeBlockNode(child, indent, depth + 2);
        })
        .join('') ?? '';

      return `${indent.repeat(depth + 1)}<${tag}${attrStr}>${content}</${tag}>`;
    })
    .join('\n');

  return `${pad}<tr>\n${cells}\n${pad}</tr>`;
}

// ---------------------------------------------------------------------------
// インラインコンテンツのシリアライズ
// ---------------------------------------------------------------------------

function serializeInlineContent(nodes?: TipTapNode[]): string {
  if (!nodes || nodes.length === 0) return '';

  const result: string[] = [];

  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      result.push('<br>');
      continue;
    }

    if (node.type === 'image') {
      const src = escapeAttr((node.attrs?.src as string) ?? '');
      const alt = escapeAttr((node.attrs?.alt as string) ?? '');
      const title = node.attrs?.title as string | undefined;
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
      result.push(`<img src="${src}" alt="${alt}"${titleAttr}>`);
      continue;
    }

    if (node.type === 'mathInline') {
      const latex = (node.attrs?.latex as string) ?? '';
      result.push(`<span class="math-inline">$${escapeHtml(latex)}$</span>`);
      continue;
    }

    if (node.type !== 'text' || node.text == null) continue;

    let html = escapeHtml(node.text);
    const marks = node.marks ?? [];

    html = applyHtmlMarks(html, marks);
    result.push(html);
  }

  return result.join('');
}

/**
 * マークを HTML タグでラップする。
 * 内側から外側の順に適用する。
 */
function applyHtmlMarks(text: string, marks: TipTapMark[]): string {
  let result = text;

  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        result = `<strong>${result}</strong>`;
        break;
      case 'italic':
        result = `<em>${result}</em>`;
        break;
      case 'strike':
        result = `<s>${result}</s>`;
        break;
      case 'code':
        result = `<code>${result}</code>`;
        break;
      case 'link': {
        const href = escapeAttr((mark.attrs?.href as string) ?? '');
        const title = mark.attrs?.title as string | undefined;
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
        result = `<a href="${href}"${titleAttr}>${result}</a>`;
        break;
      }
      case 'highlight':
        result = `<mark>${result}</mark>`;
        break;
      case 'superscript':
        result = `<sup>${result}</sup>`;
        break;
      case 'subscript':
        result = `<sub>${result}</sub>`;
        break;
      case 'textColor': {
        const color = (mark.attrs?.color as string) ?? '';
        result = `<span style="color: ${escapeAttr(color)}">${result}</span>`;
        break;
      }
      case 'backgroundColor': {
        const bgColor = (mark.attrs?.color as string) ?? '';
        result = `<span style="background-color: ${escapeAttr(bgColor)}">${result}</span>`;
        break;
      }
      case 'fontSize': {
        const size = (mark.attrs?.size as string) ?? '';
        result = `<span style="font-size: ${escapeAttr(size)}">${result}</span>`;
        break;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
