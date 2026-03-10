/**
 * Input Rules - 入力ルール（オートフォーマット）
 *
 * system-design.md §4.3 に準拠。
 *
 * 実装方針:
 * - TipTap StarterKit が提供する InputRules をそのまま使用
 *   (heading, bulletList, orderedList, blockquote, codeBlock, horizontalRule)
 * - IME ガード / 失敗時フォールバック / Undo 粒度は
 *   SafeInputRulesExtension (src/extensions/SafeInputRulesExtension.ts) で管理
 *
 * 対象トリガー (§4.3.1):
 * - "# " 〜 "###### " → Heading 1-6 (StarterKit)
 * - "- " / "* " / "+ " → Bullet List (StarterKit)
 * - "1. " → Ordered List (StarterKit)
 * - "> " → Blockquote (StarterKit)
 * - "```" + Enter → Code Block (CodeBlockLowlight extension)
 * - "---" + Enter → Horizontal Rule (StarterKit)
 * - "- [ ] " / "- [x] " → Task List Item (TaskItem extension)
 *
 * ガード条件 (§4.3.2):
 * 1. IME 変換中 (isComposing) → 発火しない
 * 2. code block / math block 内部 → TipTap のスキーマが自動抑制
 * 3. ソースモード / Split 左ペイン → WYSIWYG モード以外では InputRule 無効
 *
 * Undo 粒度 (§4.3.4):
 * - TipTap デフォルト: トリガー入力 + 構造変換 = 1 トランザクション
 * - Ctrl+Z 1 回で直前のオートフォーマットを取り消し可能
 */

// StarterKit + SafeInputRulesExtension で完結しているため、
// 追加の InputRule 定義は不要。
// カスタム InputRule を追加する場合はここに定義する。
export {};
