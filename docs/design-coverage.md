# 設計検討済み項目一覧

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

本ドキュメントは、プロジェクト全体の設計トピックを網羅した索引である。
各項目について「検討済み（設計ドキュメントあり）」「未検討」「部分的に言及あり」を示す。

---

## 凡例

| 記号 | 意味 |
|------|------|
| ✅ | 専用設計ドキュメントあり・詳細設計済み |
| 🔶 | 別ドキュメントに一部記述あり（専用文書なし） |
| ❌ | 未検討（専用設計ドキュメントなし） |

---

## 1. アーキテクチャ・コア設計

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| 全体アーキテクチャ（ContentEditable + AST） | ✅ | [system-design.md](./system-design.md) §1 |
| ファイルサイズ閾値・モード自動切替 | ✅ | [system-design.md](./system-design.md) §2.2、[performance-design.md](./performance-design.md) §2 |
| Typora式カーソル位置計算 | ✅ | [system-design.md](./system-design.md) §3 |
| Markdown ↔ TipTap JSON 変換設計 | ✅ | [markdown-tiptap-conversion.md](./markdown-tiptap-conversion.md) |
| サポートする Markdown 要素マトリクス | ✅ | [markdown-tiptap-conversion.md](./markdown-tiptap-conversion.md) §2 |
| ラウンドトリップテスト戦略 | ✅ | [tiptap-roundtrip-test-strategy.md](./tiptap-roundtrip-test-strategy.md) |
| HTML ↔ Markdown 変換（turndown） | 🔶 | [system-design.md](./system-design.md) §4、[markdown-tiptap-conversion.md](./markdown-tiptap-conversion.md) |

---

## 2. エディタ UX

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| Typora 式インラインレンダリング（フォーカス時ソース）| ✅ | [typora-analysis.md](./typora-analysis.md) §2、[system-design.md](./system-design.md) §5 |
| ソースモード切替（Ctrl+/） | ✅ | [keyboard-shortcuts.md](./keyboard-shortcuts.md)、[system-design.md](./system-design.md) |
| オートフォーマット（`# ` → 見出し等） | 🔶 | [system-design.md](./system-design.md)、[roadmap.md](./roadmap.md) Phase 1 |
| フォーカスモード・タイプライターモード | 🔶 | [typora-analysis.md](./typora-analysis.md) §2.3、[roadmap.md](./roadmap.md) Phase 7 |
| スマートペースト（HTML → MD 自動変換） | ✅ | [smart-paste-design.md](./smart-paste-design.md) ← **新規** |

---

## 3. テーブル編集

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| テーブル WYSIWYG 操作（Tab 移動・行/列 CRUD） | ✅ | [system-design.md](./system-design.md) §6、[typora-analysis.md](./typora-analysis.md) §4 |
| テーブルの制限事項（セル結合不可等） | ✅ | [typora-analysis.md](./typora-analysis.md) §4.4 |

---

## 4. Undo / Redo

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| TipTap 履歴プラグイン設計 | ✅ | [undo-redo-design.md](./undo-redo-design.md) |
| モード切替をまたいだ履歴管理 | ✅ | [undo-redo-design.md](./undo-redo-design.md) §3 |
| Undo 粒度設計 | ✅ | [undo-redo-design.md](./undo-redo-design.md) §2 |

---

## 5. キーボードショートカット

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| ショートカット全一覧（インライン・ブロック・テーブル・アプリ） | ✅ | [keyboard-shortcuts.md](./keyboard-shortcuts.md) §1 |
| OS 間競合の分析と対処 | ✅ | [keyboard-shortcuts.md](./keyboard-shortcuts.md) §2 |
| ショートカットのユーザーカスタマイズ | 🔶 | [keyboard-shortcuts.md](./keyboard-shortcuts.md) §4-3（将来対応と記載のみ）|

---

## 6. ファイル I/O・タブ・セッション管理

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| タブ vs 複数ウィンドウ設計 | ✅ | [window-tab-session-design.md](./window-tab-session-design.md) §1 |
| セッション保存・復元 | ✅ | [window-tab-session-design.md](./window-tab-session-design.md) §2 |
| 未保存変更の管理 | ✅ | [window-tab-session-design.md](./window-tab-session-design.md) §3 |
| 最近使ったファイル履歴 | ✅ | [window-tab-session-design.md](./window-tab-session-design.md) §4 |
| ファイル関連付け・シングルインスタンス制御 | ✅ | [window-tab-session-design.md](./window-tab-session-design.md) §5 |
| クラッシュリカバリ | ✅ | [window-tab-session-design.md](./window-tab-session-design.md) §10 |
| 自動保存（Debounce 設計） | ✅ | [window-tab-session-design.md](./window-tab-session-design.md) §9、[performance-design.md](./performance-design.md) §5 |
| フォルダ/ワークスペース管理 | ✅ | [workspace-design.md](./workspace-design.md) ← **新規** |

---

## 7. 画像管理

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| 画像保存先モード（4種） | ✅ | [image-storage-design.md](./image-storage-design.md) §1 |
| ファイル命名戦略 | ✅ | [image-storage-design.md](./image-storage-design.md) §1.2 |
| ハッシュによる重複排除 | ✅ | [image-storage-design.md](./image-storage-design.md) §2 |
| 外部 URL 画像のキャッシュ | ✅ | [image-storage-design.md](./image-storage-design.md) §4 |
| モバイル（Android/iOS）対応 | ✅ | [image-storage-design.md](./image-storage-design.md) §5 |

---

## 8. パフォーマンス

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| パフォーマンスバジェット・計測指標 | ✅ | [performance-design.md](./performance-design.md) §1 |
| 仮想スクロール設計 | ✅ | [performance-design.md](./performance-design.md) §3 |
| インクリメンタルパース設計 | ✅ | [performance-design.md](./performance-design.md) §4 |
| バックグラウンド保存・非同期 I/O | ✅ | [performance-design.md](./performance-design.md) §5 |
| フォルダ内全文検索のパフォーマンス | ✅ | [performance-design.md](./performance-design.md) §6 |
| メモリ管理設計 | ✅ | [performance-design.md](./performance-design.md) §7 |

---

## 9. セキュリティ

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| XSS 対策（DOMPurify 統合） | ✅ | [security-design.md](./security-design.md) §2 |
| Tauri CSP 設定 | ✅ | [security-design.md](./security-design.md) §3 |
| `plugin-fs` スコープ制限 | ✅ | [security-design.md](./security-design.md) §4 |
| スクリプトタグ分離 | ✅ | [security-design.md](./security-design.md) §5 |

---

## 10. HTML 編集

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| HTML 編集の UX 分析（3モード：WYSIWYG/ソース/スプリット）| ✅ | [html-editor-analysis.md](./html-editor-analysis.md) |
| HTML 専用ツールバー | ✅ | [html-editor-analysis.md](./html-editor-analysis.md) §3 |
| メタデータ編集パネル | ✅ | [html-editor-analysis.md](./html-editor-analysis.md) §4 |

---

## 11. エクスポート

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| Markdown → HTML エクスポート（パイプライン）| 🔶 | [system-design.md](./system-design.md) §4、[roadmap.md](./roadmap.md) Phase 4 |
| HTML テーマ CSS | 🔶 | [roadmap.md](./roadmap.md) Phase 4 |
| PDF エクスポート | 🔶 | [roadmap.md](./roadmap.md) Phase 7（一行のみ）|

---

## 12. AI 連携機能

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| AI コピーボタン（最適化パイプライン） | ✅ | [ai-features.md](./ai-features.md) §2.1、§3 |
| AI テンプレートシステム | ✅ | [ai-features.md](./ai-features.md) §2.2 |
| RTICCO 構造解析 | ✅ | [ai-features.md](./ai-features.md) §3.3 |
| AI プロバイダ直接連携（OpenAI / Anthropic API）| 🔶 | [roadmap.md](./roadmap.md) 技術的負債欄（「将来機能」と記載のみ）|

---

## 13. クロスプラットフォーム

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| Windows / macOS / Linux 対応方針 | ✅ | [cross-platform-design.md](./cross-platform-design.md) §1〜5 |
| Android / iOS 対応方針 | ✅ | [cross-platform-design.md](./cross-platform-design.md) §6〜7 |
| フォントフォールバック | ✅ | [cross-platform-design.md](./cross-platform-design.md) §3 |
| CI 設定（GitHub Actions） | ✅ | [cross-platform-design.md](./cross-platform-design.md) §8 |

---

## 14. 未検討項目（新規設計ドキュメント対象）

以下は本セッションで新たに設計ドキュメントを作成した項目。

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| ユーザー設定/プリファレンス（設定 UI・スキーマ・マイグレーション） | ✅ | [user-settings-design.md](./user-settings-design.md) ← **新規** |
| スマートペースト（HTML → MD 自動変換） | ✅ | [smart-paste-design.md](./smart-paste-design.md) ← **新規** |
| 配布・自動アップデート（tauri-plugin-updater・コード署名）| ✅ | [distribution-design.md](./distribution-design.md) ← **新規** |
| フォルダ/ワークスペース管理（ファイルツリー・外部変更検知）| ✅ | [workspace-design.md](./workspace-design.md) ← **新規** |
| エラーハンドリング・診断ログ（tauri-plugin-log・Error Boundary）| ✅ | [error-handling-design.md](./error-handling-design.md) ← **新規** |

---

## 15. 今後さらに検討が必要な項目（設計文書なし）

| 項目 | 優先度 | 備考 |
|------|--------|------|
| アクセシビリティ（a11y）設計 | 中 | ProseMirror の ARIA 属性、スクリーンリーダー対応 |
| 国際化（i18n）設計 | 低 | UI テキストの多言語対応 |
| プラグイン API 詳細設計 | 低 | 型定義は src/plugins/ にあり |
| PDF エクスポートの詳細設計 | 低 | Phase 7 |
| Git 統合 | 低 | Typora 分析で差別化候補として言及 |
| コラボレーション（リアルタイム共同編集）| 低 | 個人開発フェーズでは対象外 |
