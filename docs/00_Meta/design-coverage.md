# 設計検討済み項目一覧

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.4
> 更新日: 2026-02-25

本ドキュメントは、プロジェクト全体の設計トピックを網羅した索引である。
各項目について「検討済み（設計ドキュメントあり）」「未検討」「部分的に言及あり」を示す。

> **設計ドキュメントの追加・変更ルールは [`design-index.md`](./design-index.md) を参照。**

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
| ラウンドトリップテスト戦略 | ✅ | [tiptap-roundtrip-test-strategy.md](../02_Core_Editor/tiptap-roundtrip-test-strategy.md) |
| HTML ↔ Markdown 変換（turndown） | 🔶 | [system-design.md](./system-design.md) §4、[markdown-tiptap-conversion.md](./markdown-tiptap-conversion.md) |

---

## 2. エディタ UX

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| Typora 式インラインレンダリング（フォーカス時ソース）| ✅ | [typora-analysis.md](./typora-analysis.md) §2、[system-design.md](./system-design.md) §5 |
| ソースモード切替（Ctrl+/） | ✅ | [keyboard-shortcuts.md](./keyboard-shortcuts.md)、[system-design.md](./system-design.md) |
| オートフォーマット（`# ` → 見出し等） | 🔶 | [system-design.md](./system-design.md)、[roadmap.md](./roadmap.md) Phase 1 |
| フォーカスモード・タイプライターモード | 🔶 | [typora-analysis.md](./typora-analysis.md) §2.3、[roadmap.md](./roadmap.md) Phase 7 |
| スマートペースト（HTML → MD 自動変換） | ✅ | [smart-paste-design.md](./smart-paste-design.md) |
| YAML Front Matter 編集 UI（専用パネル / インライン折りたたみ表示） | ✅ | [editor-ux-design.md](./editor-ux-design.md) §1 |
| フローティング数式プレビュー（`$` 入力後 Esc でレンダリングプレビュー表示） | ✅ | [editor-ux-design.md](./editor-ux-design.md) §2 |
| アウトラインパネル設計（見出しジャンプ・フィルタ・フローティング vs サイドバー） | ✅ | [editor-ux-design.md](./editor-ux-design.md) §3 |
| クイックオープン（Ctrl+P：ファジーファイル名検索）設計 | ✅ | [editor-ux-design.md](./editor-ux-design.md) §4 |
| コードブロック補助 UI（コピーボタン・行番号表示・言語セレクター） | ✅ | [editor-ux-design.md](./editor-ux-design.md) §5 |
| 画像のインラインリサイズ UI（ドラッグハンドル・属性指定） | ✅ | [editor-ux-design.md](./editor-ux-design.md) §6 |
| リンクのクリック動作設計（Ctrl+クリックで外部ブラウザ / 内部ファイル遷移） | ✅ | [editor-ux-design.md](./editor-ux-design.md) §7 |
| ファイルツリーからのドラッグ&ドロップによる Markdown リンク挿入 | ✅ | [editor-ux-design.md](./editor-ux-design.md) §8 |
| スプリットビューのスクロール同期アルゴリズム詳細 | ✅ | [editor-ux-design.md](./editor-ux-design.md) §9 |
| スマートクォーテーション・オートコレクト動作設計 | 🔶 | [user-settings-design.md](./user-settings-design.md) §2.2（設定項目のみ）。[cross-platform-design.md](./cross-platform-design.md) §2.4 に macOS WKWebView の自動変換抑制策あり。エディタ UX 詳細設計（Undo 対応・変換タイミング）は未作成 |
| 空ドキュメントのプレースホルダー表示 UX | ✅ | [editor-ux-design.md](./editor-ux-design.md) §10 |

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
| モード切替をまたいだ履歴管理 | ✅ | [performance-design.md](./performance-design.md) §9.3（「ソースモード中の変更を WYSIWYG の Undo で元に戻すことはできない」）|
| Undo 粒度設計 | ✅ | [undo-redo-design.md](./undo-redo-design.md) §2 |

---

## 5. キーボードショートカット

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| ショートカット全一覧（インライン・ブロック・テーブル・アプリ） | ✅ | [keyboard-shortcuts.md](./keyboard-shortcuts.md) §1 |
| OS 間競合の分析と対処 | ✅ | [keyboard-shortcuts.md](./keyboard-shortcuts.md) §2 |
| ショートカットのユーザーカスタマイズ | 🔶 | [keyboard-shortcuts.md](./keyboard-shortcuts.md) §4-3（将来対応と記載のみ）|
| ショートカットカスタマイズの詳細 UX・永続化設計 | ✅ | [keyboard-shortcuts.md](./keyboard-shortcuts.md) §6 |
| IME 変換中のショートカット制御方針（`isComposing` ガード） | ✅ | [keyboard-shortcuts.md](./keyboard-shortcuts.md) §2-4 |

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
| フォルダ/ワークスペース管理 | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §1〜§8 |
| 新規ファイル作成フロー（ダイアログ / インライン命名・デフォルト保存先） | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §9 |
| ファイルエンコーディング対応（UTF-8 / UTF-8 BOM / Shift-JIS 等の判定・変換） | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §10 |
| 改行コード対応（CRLF / LF 自動検出・設定・保存時の扱い） | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §11 |
| ファイル削除・ゴミ箱移動の UX（確認ダイアログ・操作取り消し手段） | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §12 |
| バックアップ設計（定期バックアップの仕組み・保存先・世代数） | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §13 |
| 印刷機能（ネイティブ印刷ダイアログ・印刷用 CSS 設計） | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §14 |
| ウィンドウへのドラッグ&ドロップによるファイルオープン | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §15 |
| セッション復元と LRU タブ上限の整合性（超過タブの扱い） | ✅ | [window-tab-session-design.md](./window-tab-session-design.md) §2.5 |
| 3MB 超ファイルのクラッシュリカバリ制約とユーザー警告 | ✅ | [window-tab-session-design.md](./window-tab-session-design.md) §10.7 |
| 外部ファイル変更時の競合解決 UX（マージ選択ダイアログ・カーソル復元） | ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) §4.2.1 |

---

## 7. 画像管理

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| 画像保存先モード（4種） | ✅ | [image-design.md](../05_Features/Image/image-design.md) §1 |
| ファイル命名戦略 | ✅ | [image-design.md](../05_Features/Image/image-design.md) §1.2 |
| ハッシュによる重複排除 | ✅ | [image-design.md](../05_Features/Image/image-design.md) §2 |
| 外部 URL 画像のキャッシュ | ✅ | [image-design.md](../05_Features/Image/image-design.md) §4 |
| モバイル（Android/iOS）対応 | ✅ | [image-design.md](../05_Features/Image/image-design.md) §5 |
| クリップボードからの画像貼り付けフロー詳細（スクリーンショット・data URI → ファイル保存） | ✅ | [image-design.md](../05_Features/Image/image-design.md) §6 |
| 画像の最適化・圧縮設定（リサイズ・品質調整・WebP 変換） | ✅ | [image-design.md](../05_Features/Image/image-design.md) §7 |
| alt テキスト（画像キャプション）の編集 UX | ✅ | [image-design.md](../05_Features/Image/image-design.md) §8 |

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
| iframe / 埋め込みコンテンツのサンドボックス設計 | ✅ | [security-design.md](./security-design.md) §1.2、[html-editing-design.md](../05_Features/HTML/html-editing-design.md) §11 |
| アップデートパッケージの整合性検証（署名確認フロー詳細） | ✅ | [security-design.md](./security-design.md) §4.7 |
| プラグインのコードレビュー・公開ポリシー | ✅ | [security-design.md](./security-design.md) §4.8 |

---

## 10. HTML 編集

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| HTML 編集の UX 分析（3モード：WYSIWYG/ソース/スプリット）| ✅ | [html-editing-design.md](../05_Features/HTML/html-editing-design.md) §3 |
| HTML 専用ツールバー | ✅ | [html-editing-design.md](../05_Features/HTML/html-editing-design.md) §7.3 |
| メタデータ編集パネル | ✅ | [html-editing-design.md](../05_Features/HTML/html-editing-design.md) §4.3 |
| `<style>` タグ内 CSS 編集の範囲設計（インライン編集 / 外部エディタへの委譲） | ✅ | [html-editing-design.md](../05_Features/HTML/html-editing-design.md) §8 |
| HTML 編集時の相対パス解決設計（img / CSS / JS の相対 URL 解決ルール） | ✅ | [html-editing-design.md](../05_Features/HTML/html-editing-design.md) §9 |
| HTML → MD 変換ロスの許容範囲定義（変換できない要素の扱いポリシー） | ✅ | [html-editing-design.md](../05_Features/HTML/html-editing-design.md) §10 |
| JavaScript / iframe 埋め込みコンテンツの WYSIWYG 表示設計 | ✅ | [html-editing-design.md](../05_Features/HTML/html-editing-design.md) §11 |

---

## 11. エクスポート

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| Markdown → HTML エクスポート（パイプライン）| ✅ | [export-interop-design.md](../06_Export_Interop/export-interop-design.md) §2 |
| HTML テーマ CSS | ✅ | [export-interop-design.md](../06_Export_Interop/export-interop-design.md) §5、[theme-design.md](./theme-design.md) |
| PDF エクスポート | ✅ | [export-interop-design.md](../06_Export_Interop/export-interop-design.md) §3 |
| エクスポートオプション UI（ダイアログ設計）| ✅ | [export-interop-design.md](../06_Export_Interop/export-interop-design.md) §4 |
| Word（.docx）エクスポート（Pandoc 連携） | ✅ | [export-interop-design.md](../06_Export_Interop/export-interop-design.md) §7 |
| LaTeX / epub エクスポート（Pandoc 連携） | ✅ | [export-interop-design.md](../06_Export_Interop/export-interop-design.md) §8 |
| 外部ツール連携設計（Pandoc パス設定・インストール確認 UX） | ✅ | [export-interop-design.md](../06_Export_Interop/export-interop-design.md) §9 |

---

## 12. AI 連携機能

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| AI コピーボタン（最適化パイプライン） | ✅ | [ai-design.md](../05_Features/AI/ai-design.md) §2.1、§3 |
| AI テンプレートシステム | ✅ | [ai-design.md](../05_Features/AI/ai-design.md) §2.2 |
| RTICCO 構造解析 | ✅ | [ai-design.md](../05_Features/AI/ai-design.md) §3.3 |
| AI コピーの言語推定精度向上設計（linguist-languages 連携・ヒューリスティック改善） | ✅ | [ai-design.md](../05_Features/AI/ai-design.md) §9 |
| カスタムテンプレートの永続化・管理 UI 設計（保存・編集・削除・インポート/エクスポート） | ✅ | [ai-design.md](../05_Features/AI/ai-design.md) §10 |

---

## 13a. テーマシステム

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| CSS Custom Properties 変数体系（全層共通） | ✅ | [theme-design.md](./theme-design.md) §2 |
| テーマの 3 層構造（UI / プレビュー / エクスポート）| ✅ | [theme-design.md](./theme-design.md) §3 |
| ライト/ダークモード・システムテーマ追従 | ✅ | [theme-design.md](./theme-design.md) §4 |
| ユーザー定義テーマ（JSON カスタムテーマ）| ✅ | [theme-design.md](./theme-design.md) §5 |
| コードハイライトテーマの自動切り替え | ✅ | [theme-design.md](./theme-design.md) §4.3 |
| プラットフォーム別フォントスタック（Windows / macOS / Linux / Android / iOS） | ✅ | [theme-design.md](./theme-design.md) §2.5 |

---

## 13. クロスプラットフォーム

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| Windows / macOS / Linux 対応方針 | ✅ | [cross-platform-design.md](./cross-platform-design.md) §1〜5 |
| Android / iOS 対応方針 | ✅ | [cross-platform-design.md](./cross-platform-design.md) §6〜7 |
| フォントフォールバック | ✅ | [cross-platform-design.md](./cross-platform-design.md) §3 |
| CI 設定（GitHub Actions） | ✅ | [cross-platform-design.md](./cross-platform-design.md) §8 |
| ソフトキーボード対応設計（ビューポート自動調整・ツールバー位置変更） | ✅ | [mobile-advanced-design.md](./mobile-advanced-design.md) §1 |
| Android SAF（ドキュメントプロバイダー）統合設計 | ✅ | [mobile-advanced-design.md](./mobile-advanced-design.md) §2 |
| iCloud Drive 連携設計（iOS ファイルアクセス） | ✅ | [mobile-advanced-design.md](./mobile-advanced-design.md) §3 |
| モバイル（Android SAF / iOS）でのエンコーディング検出制約と対応方針 | ✅ | [cross-platform-design.md](./cross-platform-design.md) §4.3.1 |

---

## 14. 検索・置換

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| 単一ファイル内検索・置換 UX（検索バー・ハイライト・置換）| ✅ | [search-design.md](./search-design.md) §2 |
| ワークスペース横断全文検索 UX（結果 UI・クリックジャンプ）| ✅ | [search-design.md](./search-design.md) §3 |
| 検索オプション（正規表現・大文字小文字・単語単位）| ✅ | [search-design.md](./search-design.md) §5 |
| 全文検索のパフォーマンス（Rust walkdir + regex、外部 ripgrep 不使用）| ✅ | [performance-design.md](./performance-design.md) §6.2、[search-design.md](./search-design.md) §3.2 |

---

## 15. プラグインシステム

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| プラグイン API 型定義（拡張ポイント・権限モデル）| ✅ | [plugin-api-design.md](./plugin-api-design.md) §2・§3 |
| サンドボックス設計（iframe + postMessage）| ✅ | [plugin-api-design.md](./plugin-api-design.md) §4 |
| ビルトインプラグイン（Mermaid・KaTeX・画像）| ✅ | [plugin-api-design.md](./plugin-api-design.md) §5 |
| プラグインライフサイクル・クリーンアップ | ✅ | [plugin-api-design.md](./plugin-api-design.md) §6 |
| プラグインの配布・インストール | ✅ | [plugin-api-design.md](./plugin-api-design.md) §7 |
| プラグイン更新フロー（バージョン比較・API 互換性チェック・ロールバック） | ✅ | [plugin-api-design.md](./plugin-api-design.md) §7.4 |

---

## 16. アクセシビリティ（a11y）

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| エディタ本体の ARIA ロール設計（toolbar / textbox 等）| ✅ | [accessibility-design.md](./accessibility-design.md) §2 |
| カスタム NodeView の ARIA（見出し・テーブル・数式・画像）| ✅ | [accessibility-design.md](./accessibility-design.md) §3 |
| キーボードのみの操作フロー・roving tabindex | ✅ | [accessibility-design.md](./accessibility-design.md) §4 |
| フォーカス管理（フォーカストラップ・スキップナビゲーション）| ✅ | [accessibility-design.md](./accessibility-design.md) §5 |
| ライブリージョン（状態変化のアナウンス）| ✅ | [accessibility-design.md](./accessibility-design.md) §6 |
| カラーコントラスト設計（WCAG 2.1 AA）| ✅ | [accessibility-design.md](./accessibility-design.md) §7 |
| a11y テスト戦略（axe-core・NVDA・VoiceOver）| ✅ | [accessibility-design.md](./accessibility-design.md) §8 |

---

## 17. 前セッションで新規作成した設計ドキュメント

以下は前セッションで新たに設計ドキュメントを作成した項目。

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| ユーザー設定/プリファレンス（設定 UI・スキーマ・マイグレーション） | ✅ | [user-settings-design.md](./user-settings-design.md) |
| スマートペースト（HTML → MD 自動変換） | ✅ | [smart-paste-design.md](./smart-paste-design.md) |
| 配布・自動アップデート（tauri-plugin-updater・コード署名）| ✅ | [distribution-design.md](./distribution-design.md) |
| フォルダ/ワークスペース管理（ファイルツリー・外部変更検知）| ✅ | [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) |
| エラーハンドリング・診断ログ（tauri-plugin-log・Error Boundary）| ✅ | [error-handling-design.md](./error-handling-design.md) |
| エクスポート（HTML/PDF パイプライン・オプション UI）| ✅ | [export-interop-design.md](../06_Export_Interop/export-interop-design.md) |
| テーマシステム（CSS変数体系・ライト/ダーク・カスタムテーマ）| ✅ | [theme-design.md](./theme-design.md) |
| 検索・置換 UX（ファイル内検索・ワークスペース横断）| ✅ | [search-design.md](./search-design.md) |
| プラグイン API（型定義・サンドボックス・ライフサイクル）| ✅ | [plugin-api-design.md](./plugin-api-design.md) |
| アクセシビリティ（ARIA・キーボード・コントラスト・テスト）| ✅ | [accessibility-design.md](./accessibility-design.md) |

---

## 18. Markdown 拡張記法サポート

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| 脚注（Footnotes）WYSIWYG 表示・編集 UX 設計（変換スキーマは対応済み） | ✅ | [markdown-extensions-design.md](./markdown-extensions-design.md) §1 |
| ハイライト（`==text==`）・上付き（`^sup^`）・下付き（`~sub~`）の WYSIWYG 設計 | ✅ | [markdown-extensions-design.md](./markdown-extensions-design.md) §2 |
| カスタムコンテナ / Callout ブロック対応方針（`:::warning` 記法等） | ✅ | [markdown-extensions-design.md](./markdown-extensions-design.md) §3 |
| 目次（TOC）のインライン自動生成（`[toc]` プレースホルダー等） | ✅ | [markdown-extensions-design.md](./markdown-extensions-design.md) §4 |
| PlantUML / js-sequence-diagrams 対応方針 | ✅ | [markdown-extensions-design.md](./markdown-extensions-design.md) §5 |
| 定義リスト（Definition Lists）対応方針 | ✅ | [markdown-extensions-design.md](./markdown-extensions-design.md) §6 |

---

## 19. アプリケーションシェル UI

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| ツールバー UI 設計（ボタン配置・ツールチップ・レスポンシブ・モード別変化） | ✅ | [app-shell-design.md](./app-shell-design.md) §1 |
| メニューバー設計（Tauri ネイティブメニュー全体構造・各 OS 差異） | ✅ | [app-shell-design.md](./app-shell-design.md) §2 |
| エディタ領域コンテキストメニュー設計（テキスト選択時・余白クリック時） | ✅ | [app-shell-design.md](./app-shell-design.md) §3 |
| ステータスバー設計（文字数・行列数・エンコーディング・エディタモード表示） | ✅ | [app-shell-design.md](./app-shell-design.md) §4 |
| コマンドパレット設計（Ctrl+Shift+P 風・コマンド検索・実行） | ✅ | [app-shell-design.md](./app-shell-design.md) §5 |
| フルスクリーンモード設計（F11・UI の折りたたみ・ツールバー自動隠し） | ✅ | [app-shell-design.md](./app-shell-design.md) §6 |
| サイドバーレイアウト・リサイズ・パネル切り替え設計 | ✅ | [app-shell-design.md](./app-shell-design.md) §7 |
| 初回起動・オンボーディング設計（ウェルカム画面・チュートリアル・サンプルファイル） | ✅ | [app-shell-design.md](./app-shell-design.md) §8 |

---

## 20. テキスト処理・文書統計

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| 文字数・単語数・行数カウント表示設計 | ✅ | [text-statistics-design.md](./text-statistics-design.md) §1 |
| 読了時間推定表示 | ✅ | [text-statistics-design.md](./text-statistics-design.md) §2 |
| スペルチェック統合設計（OS ネイティブ / hunspell・言語設定） | ✅ | [text-statistics-design.md](./text-statistics-design.md) §3 |
| IME・CJK 入力最適化設計（日本語・中国語・韓国語の変換確定挙動） | ✅ | [text-statistics-design.md](./text-statistics-design.md) §4 |

---

## 21. テスト戦略（詳細）

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| UI コンポーネントテスト設計（Testing Library・テスト対象・カバレッジ目標） | ✅ | [testing-strategy-design.md](./testing-strategy-design.md) §2 |
| E2E テストシナリオ設計（Playwright + tauri-driver・主要ユーザーフロー・CI 連携） | ✅ | [testing-strategy-design.md](./testing-strategy-design.md) §3 |
| パフォーマンス計測・リグレッションテスト計画（ベンチマーク基準・自動化） | ✅ | [testing-strategy-design.md](./testing-strategy-design.md) §4 |
| セキュリティテスト計画（XSS・CSP 検証・Tauri パーミッション監査） | ✅ | [testing-strategy-design.md](./testing-strategy-design.md) §5 |

---

## 22. 配布・コミュニティ

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| ライセンス方針（OSS vs 商用・EULA・サードパーティライセンス管理） | ✅ | [community-design.md](./community-design.md) §1 |
| プライバシー方針・テレメトリー設計（使用統計・オプトイン/アウト） | ✅ | [community-design.md](./community-design.md) §2 |
| クラッシュレポート・自動バグ報告設計（Sentry 等・プライバシー配慮） | ✅ | [community-design.md](./community-design.md) §3 |
| フィードバック機能・バグレポート UI（アプリ内フォーム・GitHub Issues 連携） | ✅ | [community-design.md](./community-design.md) §4 |

---

## 23. 今後さらに検討が必要な項目（長期・低優先度）

| 項目 | 優先度 | 備考 |
|------|--------|------|
| 国際化（i18n）設計 | 低 | UI テキストの多言語対応（Phase 5 以降） |
| RTL（右から左）言語対応（Arabic / Hebrew 等） | 低 | CSS `direction: rtl` + BiDi テキスト処理 |
| マルチウィンドウ独立動作設計（デスクトップ専用、Phase 7 以降） | 低 | タブ→ウィンドウ切り出し後の状態同期 |

---

---

## 25. 新規追加機能（2026-02-25）の設計ドキュメント

> PKM（パーソナルナレッジ管理）・執筆生産性の向上を目的として追加設計した機能群。

### 25.1 エディタ UX 強化

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| スラッシュコマンド（`/` による要素挿入ポップアップ）| ✅ | [slash-commands-design.md](./slash-commands-design.md) |
| 双方向リンク（Wikiリンク `[[...]]` 記法）| ✅ | [wikilinks-backlinks-design.md](./wikilinks-backlinks-design.md) §1〜§9 |
| バックリンクパネル（被リンク一覧・コンテキスト表示）| ✅ | [wikilinks-backlinks-design.md](./wikilinks-backlinks-design.md) §4 |
| Wikiリンクのオートコンプリート（`[[` 入力でファジー候補）| ✅ | [wikilinks-backlinks-design.md](./wikilinks-backlinks-design.md) §3 |
| Wikiリンクインデックス設計（Rust バックエンド差分更新）| ✅ | [wikilinks-backlinks-design.md](./wikilinks-backlinks-design.md) §5 |
| ファイルリネーム時の Wikiリンク自動更新 | ✅ | [wikilinks-backlinks-design.md](./wikilinks-backlinks-design.md) §7 |

### 25.2 ペイン分割エディタ

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| Split Editor（左右/上下ペイン分割）| ✅ | [split-editor-design.md](./split-editor-design.md) |
| ペイン間フォーカス移動・タブ操作 | ✅ | [split-editor-design.md](./split-editor-design.md) §4 |
| スプリッタのドラッグリサイズ | ✅ | [split-editor-design.md](./split-editor-design.md) §8 |
| 同一ファイル分割時のスクロール同期 | ✅ | [split-editor-design.md](./split-editor-design.md) §6 |
| ペイン状態のセッション保存・復元 | ✅ | [split-editor-design.md](./split-editor-design.md) §5.2 |

### 25.3 Git / バージョン管理統合

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| ファイルツリーの Git 状態バッジ（M/U/A/D/C）| ✅ | [git-integration-design.md](./git-integration-design.md) §3 |
| エディタガターの差分インジケーター（行追加/変更/削除）| ✅ | [git-integration-design.md](./git-integration-design.md) §5 |
| インライン Diff ポップアップ | ✅ | [git-integration-design.md](./git-integration-design.md) §5.2 |
| 簡易コミット UI（Git パネル・ステージング操作）| ✅ | [git-integration-design.md](./git-integration-design.md) §6 |
| コミット履歴表示 | ✅ | [git-integration-design.md](./git-integration-design.md) §7 |
| ステータスバーのブランチ名・変更件数表示 | ✅ | [git-integration-design.md](./git-integration-design.md) §4 |
| Rust `git2` クレートによるバックエンド実装 | ✅ | [git-integration-design.md](./git-integration-design.md) §8 |

### 25.4 画像アノテーション

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| 画像アノテーション機能（赤枠・矢印・モザイク等）| ✅ | [image-design.md](../05_Features/Image/image-design.md) §9 |
| アノテーションツール一覧（矩形・楕円・矢印・テキスト・ぼかし）| ✅ | [image-design.md](../05_Features/Image/image-design.md) §9 |
| Canvas API による描画実装方針 | ✅ | [image-design.md](../05_Features/Image/image-design.md) §9 |
| アノテーション後の画像保存（元画像バックアップ）| ✅ | [image-design.md](../05_Features/Image/image-design.md) §9 |

### 25.5 Zen モード（集中モード）強化

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| Zen モード（フルスクリーン + UI 完全非表示）| ✅ | [zen-mode-design.md](./zen-mode-design.md) |
| 環境音（アンビエントサウンド）再生機能 | ✅ | [zen-mode-design.md](./zen-mode-design.md) §4 |
| タイプライター打鍵音フィードバック | ✅ | [zen-mode-design.md](./zen-mode-design.md) §4.5 |
| タイプライターモード統合（カーソル行常時中央固定）| ✅ | [zen-mode-design.md](./zen-mode-design.md) §5 |
| フォーカスモード統合（現在段落強調）| ✅ | [zen-mode-design.md](./zen-mode-design.md) §2 |
| Zen モード用 CSS スタイリング（コンテンツ幅・行間設定）| ✅ | [zen-mode-design.md](./zen-mode-design.md) §3 |
| ホバーでツールバー一時表示 | ✅ | [zen-mode-design.md](./zen-mode-design.md) §3.4 |

---

## 24. 整合性分析（2026-02-24）で確認・対応済みの矛盾・課題

> 旧ドキュメント `document-consistency-analysis.md` の全項目を検討し、以下の対応を実施した。
> 対応完了後、分析ドキュメントは削除済み。

### 24.1 解消した矛盾（矛盾1〜9）

| # | 矛盾内容 | 対応内容 |
|---|---------|---------|
| 矛盾1 | フェーズ番号体系の二重定義（system-design: Phase 0-5 / roadmap: Phase 1-8） | `system-design.md §6` と `roadmap.md` 冒頭に対応関係の注記を追加。roadmap.md を SoT と明記 |
| 矛盾2 | Mermaid.js のレンダリング実装方式（直接 vs sandbox iframe） | `system-design.md §1.2` の技術スタック表に「sandbox iframe 経由」の注記を追加 |
| 矛盾3 | E2E テストフレームワーク不統一（Playwright vs WebdriverIO） | `testing-strategy-design.md §1.1` を Playwright + tauri-driver に統一。§3 のセットアップコードも Playwright API に更新 |
| 矛盾4 | macOS ハイライトショートカットの二重定義（Cmd+Shift+H が検索・置換と競合） | `keyboard-shortcuts.md §1-1` のハイライトを `Cmd+Option+H` に修正し注記を更新 |
| 矛盾5 | 取り消し線ショートカットのコードバグ（`ctrl: false` → `ctrl: true`） | `cross-platform-design.md §3.3` の PLATFORM_SHORTCUTS.STRIKETHROUGH を修正 |
| 矛盾6 | 自動保存デバウンス値の不整合（500ms vs 1000ms） | 両値は異なるファイルサイズレンジに対応する正しい仕様（SoT: `window-tab-session-design.md §9`）。`system-design.md §Phase 1` と `performance-design.md §5.2` に SoT への参照注記を追加 |
| 矛盾7 | プラグインフェーズとセキュリティ要件の矛盾（外部 vs ビルトイン） | `security-design.md §4.8` に「本セクションは外部プラグインのみ対象。ビルトインは Phase 3 から実装」という注記を追加 |
| 矛盾8 | AI モデル名の書式不統一（日付サフィックスあり / なし） | `security-design.md §4.6` の ALLOWED_MODELS にコメントで意図（最新エイリアス vs バージョン固定）を明示 |
| 矛盾9 | ドキュメント更新日の乖離（undo-redo / window-tab-session が 2026-02-23） | 両ドキュメントの更新日を 2026-02-24 に修正 |

### 24.2 対応済み課題（課題A〜L）

| # | 課題内容 | 対応内容 |
|---|---------|---------|
| 課題A | design-coverage.md §4 の参照先誤り | 本ドキュメント §4「モード切替をまたいだ履歴管理」の参照先を `performance-design.md §9.3` に修正 |
| 課題B | アクセシビリティ・国際化の実装フェーズ未定義 | `roadmap.md` 技術的負債欄に a11y 詳細設計ドキュメントへのリンクと i18n フェーズ目安（Phase 5 以降）を追記 |
| 課題C | Pandoc インストール確認・フェーズ未定義 | `roadmap.md Phase 7` に Pandoc 統合タスク（インストール確認 UX・Word/LaTeX/epub エクスポート）を追加 |
| 課題D | セッション復元と LRU タブ上限の整合性 | `window-tab-session-design.md §2.5` に LRU 超過時の復元フローと「任意復元リスト」提示の仕様を追加 |
| 課題E | 3MB 超ファイルのクラッシュリカバリ欠如 | `window-tab-session-design.md §10.7` に 3MB 超ファイルの警告表示方針と将来的な差分チェックポイント案を追記 |
| 課題F | 外部ファイル変更時の競合解決 UX 詳細不足 | `file-workspace-design.md §4.2.1` に競合解決ダイアログ（再読込 / 保持 / 差分表示）・カーソル復元・自動保存競合の設計を追加 |
| 課題G | モバイルプラットフォームでの Shift-JIS 対応 | `cross-platform-design.md §4.3.1` にモバイルでのエンコーディング検出制約と対応方針（ベストエフォート + 手動指定 UI）を追記 |
| 課題H | プラグイン更新メカニズムの未設計 | `plugin-api-design.md §7.4` にバージョン比較・API 互換性チェック・ロールバック・manifest フィールド拡張を追加 |
| 課題I | IME 入力中のキーボードショートカット干渉 | `keyboard-shortcuts.md §2-4` に `isComposing` ガードの実装方針と注意点を追記 |
| 課題J | プラットフォーム別フォント定義の欠如 | `theme-design.md §2.5` にプラットフォーム別フォントスタック（Windows / macOS / Linux / Android / iOS）と実装コードを追加 |
| 課題K | ワークスペース全文検索への ripgrep 依存の曖昧さ | `search-design.md §1`・`§3.2` と `performance-design.md §6.2` に「Rust 内製（walkdir + regex）、外部 ripgrep 不使用」の方針と理由を明記 |
| 課題L | スマートクォーテーション・オートコレクト設計の不足 | 本ドキュメント §2 の状態を 🔶 のまま維持し、macOS WKWebView 抑制策（cross-platform-design.md §2.4）への参照と「エディタ UX 詳細（Undo 対応）は未作成」の旨を明記 |
