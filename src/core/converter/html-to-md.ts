/**
 * html-to-md.ts
 *
 * HTML テキストを Markdown テキストに変換する変換パイプライン。
 *
 * 変換には turndown を使用し、カスタムルールで精度を向上させる。
 * html-editing-design.md §5.2, §10 に準拠。
 *
 * ⚠️ 注意:
 *   HTML → MD 変換は不可逆（ロッシー）です。
 *   HTMLの一部の表現（カラー、フォントサイズ等）はMarkdownで表現できません。
 *   変換前にユーザーへ警告を表示することを推奨します。
 *
 * 使用ライブラリ:
 *   - turndown
 *   - turndown-plugin-gfm（テーブル等 GitHub Flavored Markdown 対応）
 */

import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

export interface HtmlToMdOptions {
  /** GitHub Flavored Markdown として出力するか */
  gfm: boolean;
  /** 見出しスタイル: atx（`# `）または setext（下線スタイル） */
  headingStyle: 'atx' | 'setext';
  /** リストの記号 */
  bulletListMarker: '-' | '*' | '+';
}

const defaultOptions: HtmlToMdOptions = {
  gfm: true,
  headingStyle: 'atx',
  bulletListMarker: '-',
};

/**
 * HTML → Markdown 変換時に情報が失われる要素の種類。
 */
export type LossType =
  | 'inline-style'     // style属性によるスタイル（色・サイズ等）
  | 'custom-class'     // クラス属性
  | 'div-structure'    // divによる構造
  | 'semantic-element' // section, article等のセマンティック要素
  | 'cell-merge'       // テーブルのセル結合（colspan/rowspan）
  | 'svg'              // SVGコンテンツ
  | 'iframe'           // iframe 埋め込み
  | 'script'           // スクリプトタグ
  | 'style-tag'        // style タグ
  | 'video-audio'      // video / audio タグ
  | 'details-summary'  // details / summary タグ
  | 'unsupported-tag'; // その他対応外タグ

export interface ConversionWarning {
  type: LossType;
  message: string;
  /** 警告箇所の数 */
  count: number;
  /** 警告に関連するHTML要素の簡易表現（デバッグ用） */
  hint: string;
}

export interface HtmlToMdResult {
  /** 変換後の Markdown テキスト */
  markdown: string;
  /** 変換時に発生した情報ロスの警告リスト */
  warnings: ConversionWarning[];
}

/**
 * turndown インスタンスを生成し、カスタムルールを登録する。
 */
function createTurndownService(options: HtmlToMdOptions): TurndownService {
  const td = new TurndownService({
    headingStyle: options.headingStyle,
    hr: '---',
    bulletListMarker: options.bulletListMarker,
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });

  if (options.gfm) {
    td.use(gfm);
  }

  // --- カスタムルール ---

  // <mark> → ==text==（拡張記法）
  td.addRule('mark', {
    filter: 'mark',
    replacement: (content: string) => `==${content}==`,
  });

  // <sup> → ^text^（拡張記法）
  td.addRule('sup', {
    filter: 'sup',
    replacement: (content: string) => `^${content}^`,
  });

  // <sub> → ~text~（拡張記法）
  td.addRule('sub', {
    filter: 'sub',
    replacement: (content: string) => `~${content}~`,
  });

  // <figure> + <figcaption> → ![caption](src)
  td.addRule('figure', {
    filter: 'figure',
    replacement: (_content: string, node: Node) => {
      const el = node as HTMLElement;
      const img = el.querySelector('img');
      const figcaption = el.querySelector('figcaption');
      if (img) {
        const alt = figcaption?.textContent?.trim() || img.alt || '';
        const src = img.getAttribute('src') || '';
        return `\n\n![${alt}](${src})\n\n`;
      }
      return figcaption?.textContent?.trim() || '';
    },
  });

  // <video> / <audio> → リンクに変換
  td.addRule('videoAudio', {
    filter: ['video', 'audio'],
    replacement: (_content: string, node: Node) => {
      const el = node as HTMLElement;
      const src = el.getAttribute('src') ||
        el.querySelector('source')?.getAttribute('src') || '';
      const tag = el.tagName.toLowerCase();
      if (src) {
        return `\n\n[${tag}](${src})\n\n`;
      }
      return '';
    },
  });

  // <details> + <summary> → テキスト化
  td.addRule('details', {
    filter: 'details',
    replacement: (content: string, node: Node) => {
      const el = node as HTMLElement;
      const summary = el.querySelector('summary');
      const summaryText = summary?.textContent?.trim() || '';
      // summary 部分のテキストを除いた残りのコンテンツ
      const bodyContent = content.replace(summaryText, '').trim();
      return `\n\n**${summaryText}**\n\n${bodyContent}\n\n`;
    },
  });

  // <div>, <section>, <article>, <header>, <footer>, <nav> → 内容を展開
  td.addRule('semanticBlock', {
    filter: ['div', 'section', 'article', 'header', 'footer', 'nav', 'aside', 'main'],
    replacement: (content: string) => `\n\n${content.trim()}\n\n`,
  });

  // <span style="..."> → 内容のみ保持（スタイルは消失）
  td.addRule('styledSpan', {
    filter: (node: HTMLElement) =>
      node.nodeName === 'SPAN' && !!node.getAttribute('style'),
    replacement: (content: string) => content,
  });

  // <iframe> → 消失（セキュリティ上の理由）
  td.addRule('iframe', {
    filter: 'iframe',
    replacement: () => '',
  });

  // <script> → 消失
  td.addRule('script', {
    filter: 'script',
    replacement: () => '',
  });

  // <style> → 消失
  td.addRule('styleTag', {
    filter: 'style',
    replacement: () => '',
  });

  // <svg> → 消失
  td.addRule('svg', {
    filter: (node: HTMLElement) => node.nodeName.toLowerCase() === 'svg',
    replacement: () => '',
  });

  // 数式: <span class="math/katex"> → $...$
  td.addRule('inlineMath', {
    filter: (node: HTMLElement) =>
      node.nodeName === 'SPAN' &&
      (node.classList.contains('math') ||
        node.classList.contains('katex')),
    replacement: (content: string) => `$${content}$`,
  });

  // ブロック数式: <div class="math/katex"> → $$...$$
  td.addRule('blockMath', {
    filter: (node: HTMLElement) =>
      node.nodeName === 'DIV' &&
      (node.classList.contains('math') ||
        node.classList.contains('katex')),
    replacement: (content: string) => `\n$$\n${content}\n$$\n`,
  });

  // 画像 data-URI の保持
  td.addRule('imgDataUri', {
    filter: (node: HTMLElement) =>
      node.nodeName === 'IMG' &&
      (node as HTMLImageElement).src?.startsWith('data:image/'),
    replacement: (_content: string, node: Node) => {
      const img = node as HTMLImageElement;
      const alt = img.alt || '';
      const src = img.src || '';
      return `![${alt}](${src})`;
    },
  });

  return td;
}

/**
 * HTML テキストを Markdown テキストに変換する。
 *
 * @param html    - 入力 HTML 文字列
 * @param options - 変換オプション
 * @returns 変換結果（Markdownテキスト + 警告リスト）
 *
 * @example
 * const { markdown, warnings } = convertHtmlToMd('<h1>Hello</h1>');
 * if (warnings.length > 0) showWarningDialog(warnings);
 */
export function convertHtmlToMd(
  html: string,
  options: Partial<HtmlToMdOptions> = {}
): HtmlToMdResult {
  const opts = { ...defaultOptions, ...options };

  // 変換前にロスを検出
  const warnings = detectLoss(html);

  // turndown で変換
  const td = createTurndownService(opts);

  // body の中身だけを変換対象とする（完全な HTML ドキュメントの場合）
  const bodyContent = extractBodyContent(html);
  const markdown = td.turndown(bodyContent);

  return { markdown, warnings };
}

/**
 * HTML 文字列から <body> タグの中身を抽出する。
 * <body> タグがない場合はそのまま返す。
 */
function extractBodyContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return bodyMatch ? bodyMatch[1]! : html;
}

/**
 * HTML文字列を解析し、Markdown変換時に情報が失われる箇所を検出する。
 *
 * @param html - 検査対象の HTML 文字列
 * @returns 情報ロス警告リスト
 */
export function detectLoss(html: string): ConversionWarning[] {
  const warnings: ConversionWarning[] = [];

  // inline style 属性の検出
  const styleAttrMatches = html.match(/\sstyle\s*=\s*["'][^"']+["']/gi);
  if (styleAttrMatches && styleAttrMatches.length > 0) {
    warnings.push({
      type: 'inline-style',
      message: 'インラインスタイル（色・サイズ等）は変換時に失われます',
      count: styleAttrMatches.length,
      hint: 'style="..."',
    });
  }

  // class 属性の検出（ただし math/katex は除外）
  const classMatches = html.match(/\sclass\s*=\s*["'][^"']+["']/gi);
  if (classMatches) {
    const nonMathClasses = classMatches.filter(
      (m) => !/\b(math|katex)\b/i.test(m)
    );
    if (nonMathClasses.length > 0) {
      warnings.push({
        type: 'custom-class',
        message: 'カスタムクラス属性は変換時に失われます',
        count: nonMathClasses.length,
        hint: 'class="..."',
      });
    }
  }

  // div 構造の検出
  const divMatches = html.match(/<div[\s>]/gi);
  if (divMatches && divMatches.length > 0) {
    warnings.push({
      type: 'div-structure',
      message: 'div ブロックの構造は変換時に失われます（内容は保持されます）',
      count: divMatches.length,
      hint: '<div>',
    });
  }

  // セマンティック要素の検出
  const semanticTags = ['section', 'article', 'header', 'footer', 'nav', 'aside', 'main'];
  let semanticCount = 0;
  for (const tag of semanticTags) {
    const re = new RegExp(`<${tag}[\\s>]`, 'gi');
    const matches = html.match(re);
    if (matches) semanticCount += matches.length;
  }
  if (semanticCount > 0) {
    warnings.push({
      type: 'semantic-element',
      message: 'セマンティック要素（section, article 等）の構造は変換時に失われます',
      count: semanticCount,
      hint: '<section>, <article>, ...',
    });
  }

  // テーブルのセル結合
  const cellMergeMatches = html.match(/\b(colspan|rowspan)\s*=\s*["'][^"']*["']/gi);
  if (cellMergeMatches && cellMergeMatches.length > 0) {
    warnings.push({
      type: 'cell-merge',
      message: 'テーブルのセル結合（colspan/rowspan）は変換時に失われます',
      count: cellMergeMatches.length,
      hint: 'colspan="...", rowspan="..."',
    });
  }

  // SVG
  const svgMatches = html.match(/<svg[\s>]/gi);
  if (svgMatches && svgMatches.length > 0) {
    warnings.push({
      type: 'svg',
      message: 'SVG コンテンツは変換時に削除されます',
      count: svgMatches.length,
      hint: '<svg>',
    });
  }

  // iframe
  const iframeMatches = html.match(/<iframe[\s>]/gi);
  if (iframeMatches && iframeMatches.length > 0) {
    warnings.push({
      type: 'iframe',
      message: 'iframe 埋め込みコンテンツは変換時に削除されます',
      count: iframeMatches.length,
      hint: '<iframe>',
    });
  }

  // script
  const scriptMatches = html.match(/<script[\s>]/gi);
  if (scriptMatches && scriptMatches.length > 0) {
    warnings.push({
      type: 'script',
      message: 'スクリプトタグは変換時に削除されます',
      count: scriptMatches.length,
      hint: '<script>',
    });
  }

  // style タグ
  const styleTagMatches = html.match(/<style[\s>]/gi);
  if (styleTagMatches && styleTagMatches.length > 0) {
    warnings.push({
      type: 'style-tag',
      message: 'style タグは変換時に削除されます',
      count: styleTagMatches.length,
      hint: '<style>',
    });
  }

  // video / audio
  const mediaMatches = html.match(/<(video|audio)[\s>]/gi);
  if (mediaMatches && mediaMatches.length > 0) {
    warnings.push({
      type: 'video-audio',
      message: 'video / audio タグはリンクに変換されます',
      count: mediaMatches.length,
      hint: '<video>, <audio>',
    });
  }

  // details / summary
  const detailsMatches = html.match(/<details[\s>]/gi);
  if (detailsMatches && detailsMatches.length > 0) {
    warnings.push({
      type: 'details-summary',
      message: 'details / summary はテキストに展開されます（折りたたみ機能は失われます）',
      count: detailsMatches.length,
      hint: '<details>',
    });
  }

  return warnings;
}
