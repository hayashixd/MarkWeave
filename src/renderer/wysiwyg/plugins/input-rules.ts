/**
 * Input Rules - 入力ルール（オートフォーマット）
 *
 * 特定のテキスト入力をトリガーに、マークダウン要素を自動変換する。
 * 例: "# " → Heading 1, "- " → Bullet List
 *
 * TODO: Phase 1 で実装
 */

/**
 * 入力ルール定義
 *
 * トリガー文字 → 変換先ノードタイプ の対応:
 *
 * "# "      → Heading 1
 * "## "     → Heading 2
 * "### "    → Heading 3
 * "#### "   → Heading 4
 * "##### "  → Heading 5
 * "###### " → Heading 6
 * "- "      → Bullet List
 * "* "      → Bullet List
 * "+ "      → Bullet List
 * "1. "     → Ordered List
 * "> "      → Blockquote
 * "```"     → Code Block (言語名入力待ち)
 * "---"     → Thematic Break
 * "$$"      → Math Block
 * "- [ ] "  → Task List Item（チェックなし）
 * "- [x] "  → Task List Item（チェック済み）
 */
export const INPUT_RULES = [] as const;

// TODO: ProseMirrorのinputRulesプラグインを使って実装
