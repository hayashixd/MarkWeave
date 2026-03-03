/**
 * html-to-md.ts
 *
 * HTML テキストを Markdown テキストに変換する変換パイプライン。
 *
 * 変換には turndown を使用し、カスタムルールで精度を向上させる。
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

export interface HtmlToMdOptions {
  /** GitHub Flavored Markdown として出力するか */
  gfm: boolean;
  /** 見出しスタイル: atx（`# `）または setext（下線スタイル） */
  headingStyle: 'atx' | 'setext';
  /** リストの記号 */
  bulletListMarker: '-' | '*' | '+';
}

// TODO: 変換ロジック実装時に使用する
// const defaultOptions: HtmlToMdOptions = {
//   gfm: true,
//   headingStyle: 'atx',
//   bulletListMarker: '-',
// };

/**
 * HTML → Markdown 変換時に情報が失われる要素の種類。
 */
export type LossType =
  | 'inline-style'    // style属性によるスタイル（色・サイズ等）
  | 'custom-class'    // クラス属性
  | 'div-structure'   // divによる構造
  | 'semantic-element'// section, article等のセマンティック要素
  | 'svg'             // SVGコンテンツ
  | 'script'          // スクリプトタグ
  | 'unsupported-tag';// その他対応外タグ

export interface ConversionWarning {
  type: LossType;
  message: string;
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
 * HTML テキストを Markdown テキストに変換する。
 *
 * @param html    - 入力 HTML 文字列
 * @param options - 変換オプション
 * @returns 変換結果（Markdownテキスト + 警告リスト）
 *
 * @example
 * const { markdown, warnings } = await convertHtmlToMd('<h1>Hello</h1>');
 * if (warnings.length > 0) showWarningDialog(warnings);
 */
export async function convertHtmlToMd(
  html: string,
  options: Partial<HtmlToMdOptions> = {}
): Promise<HtmlToMdResult> {
  void options; // TODO: オプションを使った変換ロジックを実装
  // TODO: turndown + turndown-plugin-gfm を使って変換
  // const TurndownService = (await import('turndown')).default;
  // const { gfm } = await import('turndown-plugin-gfm');
  // const td = new TurndownService({ headingStyle: opts.headingStyle, ... });
  // if (opts.gfm) td.use(gfm);
  // addCustomRules(td);
  // const markdown = td.turndown(html);
  // const warnings = detectLoss(html);
  // return { markdown, warnings };
  void html;
  throw new Error('convertHtmlToMd: not implemented yet');
}

/**
 * HTML文字列を解析し、Markdown変換時に情報が失われる箇所を検出する。
 *
 * @param html - 検査対象の HTML 文字列
 * @returns 情報ロス警告リスト
 */
export function detectLoss(html: string): ConversionWarning[] {
  // TODO: 正規表現 or DOMパーサで各要素を検査
  // - style属性の存在チェック
  // - div/section/article の存在チェック
  // - svg/script タグの存在チェック
  void html;
  return [];
}
