/**
 * template-registry.ts
 *
 * AIテンプレートの型定義・レジストリ・プレースホルダー置換を管理するモジュール。
 */

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export type TemplateCategory =
  | 'blog'      // ブログ・記事
  | 'code'      // コード解説・レビュー
  | 'summary'   // 要約・整理
  | 'reasoning' // 推論・分析
  | 'general'   // 汎用プロンプト
  | 'meeting'   // 議事録・会議
  | 'translate'; // 翻訳

export type PlaceholderType = 'text' | 'textarea' | 'select' | 'code';

export interface Placeholder {
  /** テンプレート内の `{{KEY}}` と対応するキー */
  key: string;
  /** ダイアログに表示するラベル */
  label: string;
  /** 入力フィールドの説明 */
  description: string;
  /** 入力タイプ */
  type: PlaceholderType;
  /** デフォルト値 */
  defaultValue?: string;
  /** select タイプのときの選択肢 */
  options?: string[];
  required: boolean;
}

export interface AiTemplate {
  /** 一意なID */
  id: string;
  /** 表示名（日本語） */
  name: string;
  /** 概要説明 */
  description: string;
  /** カテゴリ */
  category: TemplateCategory;
  /** 検索・フィルタ用タグ */
  tags: string[];
  /**
   * プレースホルダー入りの Markdown コンテンツ。
   * `{{KEY}}` 形式でプレースホルダーを記述する。
   */
  content: string;
  /** プレースホルダーの定義 */
  placeholders: Placeholder[];
}

// ---------------------------------------------------------------------------
// テンプレートレジストリ
// ---------------------------------------------------------------------------

const registry = new Map<string, AiTemplate>();

/**
 * テンプレートをレジストリに登録する。
 *
 * @param template - 登録するテンプレート
 */
export function registerTemplate(template: AiTemplate): void {
  if (registry.has(template.id)) {
    console.warn(`Template "${template.id}" is already registered. Overwriting.`);
  }
  registry.set(template.id, template);
}

/**
 * テンプレートをレジストリから削除する。
 *
 * @param id - 削除するテンプレートのID
 */
export function unregisterTemplate(id: string): void {
  registry.delete(id);
}

/**
 * IDでテンプレートを取得する。
 *
 * @param id - テンプレートID
 * @returns テンプレート（存在しない場合は undefined）
 */
export function getTemplate(id: string): AiTemplate | undefined {
  return registry.get(id);
}

/**
 * テンプレートがカスタム（ユーザー定義）かどうかを判定する。
 *
 * @param id - テンプレートID
 * @returns カスタムテンプレートの場合 true
 */
export function isCustomTemplate(id: string): boolean {
  return id.startsWith('custom-');
}

/**
 * 全テンプレートを取得する。
 *
 * @param category - 指定時はそのカテゴリのみ返す
 * @returns テンプレート配列
 */
export function listTemplates(category?: TemplateCategory): AiTemplate[] {
  const all = Array.from(registry.values());
  if (!category) return all;
  return all.filter((t) => t.category === category);
}

/**
 * テンプレートをキーワードで検索する。
 * 名前・説明・タグを対象とする。
 *
 * @param query - 検索キーワード
 * @returns マッチしたテンプレート配列
 */
export function searchTemplates(query: string): AiTemplate[] {
  const q = query.toLowerCase();
  return Array.from(registry.values()).filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

// ---------------------------------------------------------------------------
// プレースホルダー置換
// ---------------------------------------------------------------------------

/**
 * テンプレートコンテンツのプレースホルダー `{{KEY}}` を実際の値で置換する。
 *
 * @param template - 対象テンプレート
 * @param values   - キーと値のマップ（未指定キーはデフォルト値 or 空文字になる）
 * @returns プレースホルダーを置換した Markdown 文字列
 *
 * @example
 * const md = fillTemplate(template, { TOPIC: 'TypeScript入門', AUDIENCE: '初心者' });
 */
export function fillTemplate(
  template: AiTemplate,
  values: Record<string, string>
): string {
  let content = template.content;

  for (const placeholder of template.placeholders) {
    const value = values[placeholder.key] ?? placeholder.defaultValue ?? '';
    const pattern = new RegExp(`\\{\\{${placeholder.key}\\}\\}`, 'g');
    content = content.replace(pattern, value);
  }

  return content;
}

/**
 * テンプレートに必要なプレースホルダーのうち、
 * 値が未入力・未設定のものを返す。
 *
 * @param template - 対象テンプレート
 * @param values   - 現在入力済みの値マップ
 * @returns 未入力の必須プレースホルダーリスト
 */
export function getMissingRequired(
  template: AiTemplate,
  values: Record<string, string>
): Placeholder[] {
  return template.placeholders.filter(
    (p) => p.required && !values[p.key] && !p.defaultValue
  );
}
