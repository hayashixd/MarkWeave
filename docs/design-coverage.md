# 設計検討済み項目一覧

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.1
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
| スマートペースト（HTML → MD 自動変換） | ✅ | [smart-paste-design.md](./smart-paste-design.md) |
| YAML Front Matter 編集 UI（専用パネル / インライン折りたたみ表示） | ❌ | — |
| フローティング数式プレビュー（`$` 入力後 Esc でレンダリングプレビュー表示） | ❌ | — |
| アウトラインパネル設計（見出しジャンプ・フィルタ・フローティング vs サイドバー） | ❌ | — |
| クイックオープン（Ctrl+P：ファジーファイル名検索）設計 | ❌ | — |
| コードブロック補助 UI（コピーボタン・行番号表示・言語セレクター） | ❌ | — |
| 画像のインラインリサイズ UI（ドラッグハンドル・属性指定） | ❌ | — |
| リンクのクリック動作設計（Ctrl+クリックで外部ブラウザ / 内部ファイル遷移） | ❌ | — |
| ファイルツリーからのドラッグ&ドロップによる Markdown リンク挿入 | ❌ | — |
| スプリットビューのスクロール同期アルゴリズム詳細 | ❌ | — |
| スマートクォーテーション・オートコレクト動作設計 | 🔶 | [user-settings-design.md](./user-settings-design.md) §2.2（設定項目のみ） |
| 空ドキュメントのプレースホルダー表示 UX | ❌ | — |

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
| ショートカットカスタマイズの詳細 UX・永続化設計 | ❌ | — |

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
| フォルダ/ワークスペース管理 | ✅ | [workspace-design.md](./workspace-design.md) |
| 新規ファイル作成フロー（ダイアログ / インライン命名・デフォルト保存先） | ❌ | — |
| ファイルエンコーディング対応（UTF-8 / UTF-8 BOM / Shift-JIS 等の判定・変換） | ❌ | — |
| 改行コード対応（CRLF / LF 自動検出・設定・保存時の扱い） | ❌ | — |
| ファイル削除・ゴミ箱移動の UX（確認ダイアログ・操作取り消し手段） | ❌ | — |
| バックアップ設計（定期バックアップの仕組み・保存先・世代数） | 🔶 | [user-settings-design.md](./user-settings-design.md) §2.4（`createBackup` 設定項目のみ） |
| 印刷機能（ネイティブ印刷ダイアログ・印刷用 CSS 設計） | ❌ | — |
| ウィンドウへのドラッグ&ドロップによるファイルオープン | ❌ | — |

---

## 7. 画像管理

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| 画像保存先モード（4種） | ✅ | [image-storage-design.md](./image-storage-design.md) §1 |
| ファイル命名戦略 | ✅ | [image-storage-design.md](./image-storage-design.md) §1.2 |
| ハッシュによる重複排除 | ✅ | [image-storage-design.md](./image-storage-design.md) §2 |
| 外部 URL 画像のキャッシュ | ✅ | [image-storage-design.md](./image-storage-design.md) §4 |
| モバイル（Android/iOS）対応 | ✅ | [image-storage-design.md](./image-storage-design.md) §5 |
| クリップボードからの画像貼り付けフロー詳細（スクリーンショット・data URI → ファイル保存） | ❌ | — |
| 画像の最適化・圧縮設定（リサイズ・品質調整・WebP 変換） | ❌ | — |
| alt テキスト（画像キャプション）の編集 UX | ❌ | — |

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
| iframe / 埋め込みコンテンツのサンドボックス設計 | ❌ | — |
| アップデートパッケージの整合性検証（署名確認フロー詳細） | ❌ | — |
| プラグインのコードレビュー・公開ポリシー | ❌ | — |

---

## 10. HTML 編集

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| HTML 編集の UX 分析（3モード：WYSIWYG/ソース/スプリット）| ✅ | [html-editor-analysis.md](./html-editor-analysis.md) |
| HTML 専用ツールバー | ✅ | [html-editor-analysis.md](./html-editor-analysis.md) §3 |
| メタデータ編集パネル | ✅ | [html-editor-analysis.md](./html-editor-analysis.md) §4 |
| `<style>` タグ内 CSS 編集の範囲設計（インライン編集 / 外部エディタへの委譲） | ❌ | — |
| HTML 編集時の相対パス解決設計（img / CSS / JS の相対 URL 解決ルール） | ❌ | — |
| HTML → MD 変換ロスの許容範囲定義（変換できない要素の扱いポリシー） | ❌ | — |
| JavaScript / iframe 埋め込みコンテンツの WYSIWYG 表示設計 | ❌ | — |

---

## 11. エクスポート

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| Markdown → HTML エクスポート（パイプライン）| ✅ | [export-design.md](./export-design.md) §2 |
| HTML テーマ CSS | ✅ | [export-design.md](./export-design.md) §5、[theme-design.md](./theme-design.md) |
| PDF エクスポート | ✅ | [export-design.md](./export-design.md) §3 |
| エクスポートオプション UI（ダイアログ設計）| ✅ | [export-design.md](./export-design.md) §4 |
| Word（.docx）エクスポート（Pandoc 連携） | ❌ | — |
| LaTeX / epub エクスポート（Pandoc 連携） | ❌ | — |
| 外部ツール連携設計（Pandoc パス設定・インストール確認 UX） | ❌ | — |

---

## 12. AI 連携機能

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| AI コピーボタン（最適化パイプライン） | ✅ | [ai-features.md](./ai-features.md) §2.1、§3 |
| AI テンプレートシステム | ✅ | [ai-features.md](./ai-features.md) §2.2 |
| RTICCO 構造解析 | ✅ | [ai-features.md](./ai-features.md) §3.3 |
| AI プロバイダ直接連携（OpenAI / Anthropic API）| 🔶 | [roadmap.md](./roadmap.md) 技術的負債欄（「将来機能」と記載のみ）|
| AI コピーの言語推定精度向上設計（linguist-languages 連携・ヒューリスティック改善） | ❌ | — |
| カスタムテンプレートの永続化・管理 UI 設計（保存・編集・削除・インポート/エクスポート） | ❌ | — |

---

## 13a. テーマシステム

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| CSS Custom Properties 変数体系（全層共通） | ✅ | [theme-design.md](./theme-design.md) §2 |
| テーマの 3 層構造（UI / プレビュー / エクスポート）| ✅ | [theme-design.md](./theme-design.md) §3 |
| ライト/ダークモード・システムテーマ追従 | ✅ | [theme-design.md](./theme-design.md) §4 |
| ユーザー定義テーマ（JSON カスタムテーマ）| ✅ | [theme-design.md](./theme-design.md) §5 |
| コードハイライトテーマの自動切り替え | ✅ | [theme-design.md](./theme-design.md) §4.3 |

---

## 13. クロスプラットフォーム

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| Windows / macOS / Linux 対応方針 | ✅ | [cross-platform-design.md](./cross-platform-design.md) §1〜5 |
| Android / iOS 対応方針 | ✅ | [cross-platform-design.md](./cross-platform-design.md) §6〜7 |
| フォントフォールバック | ✅ | [cross-platform-design.md](./cross-platform-design.md) §3 |
| CI 設定（GitHub Actions） | ✅ | [cross-platform-design.md](./cross-platform-design.md) §8 |
| ソフトキーボード対応設計（ビューポート自動調整・ツールバー位置変更） | ❌ | — |
| Android SAF（ドキュメントプロバイダー）統合設計 | ❌ | — |
| iCloud Drive 連携設計（iOS ファイルアクセス） | ❌ | — |

---

## 14. 検索・置換

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| 単一ファイル内検索・置換 UX（検索バー・ハイライト・置換）| ✅ | [search-design.md](./search-design.md) §2 |
| ワークスペース横断全文検索 UX（結果 UI・クリックジャンプ）| ✅ | [search-design.md](./search-design.md) §3 |
| 検索オプション（正規表現・大文字小文字・単語単位）| ✅ | [search-design.md](./search-design.md) §5 |
| 全文検索のパフォーマンス（ripgrep バックエンド）| ✅ | [performance-design.md](./performance-design.md) §6 |

---

## 15. プラグインシステム

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| プラグイン API 型定義（拡張ポイント・権限モデル）| ✅ | [plugin-api-design.md](./plugin-api-design.md) §2・§3 |
| サンドボックス設計（iframe + postMessage）| ✅ | [plugin-api-design.md](./plugin-api-design.md) §4 |
| ビルトインプラグイン（Mermaid・KaTeX・画像）| ✅ | [plugin-api-design.md](./plugin-api-design.md) §5 |
| プラグインライフサイクル・クリーンアップ | ✅ | [plugin-api-design.md](./plugin-api-design.md) §6 |
| プラグインの配布・インストール | ✅ | [plugin-api-design.md](./plugin-api-design.md) §7 |

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
| フォルダ/ワークスペース管理（ファイルツリー・外部変更検知）| ✅ | [workspace-design.md](./workspace-design.md) |
| エラーハンドリング・診断ログ（tauri-plugin-log・Error Boundary）| ✅ | [error-handling-design.md](./error-handling-design.md) |
| エクスポート（HTML/PDF パイプライン・オプション UI）| ✅ | [export-design.md](./export-design.md) |
| テーマシステム（CSS変数体系・ライト/ダーク・カスタムテーマ）| ✅ | [theme-design.md](./theme-design.md) |
| 検索・置換 UX（ファイル内検索・ワークスペース横断）| ✅ | [search-design.md](./search-design.md) |
| プラグイン API（型定義・サンドボックス・ライフサイクル）| ✅ | [plugin-api-design.md](./plugin-api-design.md) |
| アクセシビリティ（ARIA・キーボード・コントラスト・テスト）| ✅ | [accessibility-design.md](./accessibility-design.md) |

---

## 18. Markdown 拡張記法サポート

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| 脚注（Footnotes）WYSIWYG 表示・編集 UX 設計（変換スキーマは対応済み） | ❌ | — |
| ハイライト（`==text==`）・上付き（`^sup^`）・下付き（`~sub~`）の WYSIWYG 設計 | ❌ | — |
| カスタムコンテナ / Callout ブロック対応方針（`:::warning` 記法等） | ❌ | — |
| 目次（TOC）のインライン自動生成（`[toc]` プレースホルダー等） | ❌ | — |
| PlantUML / js-sequence-diagrams 対応方針 | ❌ | — |
| 定義リスト（Definition Lists）対応方針 | ❌ | — |

---

## 19. アプリケーションシェル UI

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| ツールバー UI 設計（ボタン配置・ツールチップ・レスポンシブ・モード別変化） | ❌ | — |
| メニューバー設計（Tauri ネイティブメニュー全体構造・各 OS 差異） | ❌ | — |
| エディタ領域コンテキストメニュー設計（テキスト選択時・余白クリック時） | ❌ | — |
| ステータスバー設計（文字数・行列数・エンコーディング・エディタモード表示） | ❌ | — |
| コマンドパレット設計（Ctrl+Shift+P 風・コマンド検索・実行） | ❌ | — |
| フルスクリーンモード設計（F11・UI の折りたたみ・ツールバー自動隠し） | ❌ | — |
| サイドバーレイアウト・リサイズ・パネル切り替え設計 | ❌ | — |
| 初回起動・オンボーディング設計（ウェルカム画面・チュートリアル・サンプルファイル） | ❌ | — |

---

## 20. テキスト処理・文書統計

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| 文字数・単語数・行数カウント表示設計 | ❌ | — |
| 読了時間推定表示 | ❌ | — |
| スペルチェック統合設計（OS ネイティブ / hunspell・言語設定） | ❌ | — |
| IME・CJK 入力最適化設計（日本語・中国語・韓国語の変換確定挙動） | ❌ | — |

---

## 21. テスト戦略（詳細）

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| UI コンポーネントテスト設計（Testing Library・テスト対象・カバレッジ目標） | ❌ | — |
| E2E テストシナリオ設計（Playwright・主要ユーザーフロー・CI 連携） | ❌ | — |
| パフォーマンス計測・リグレッションテスト計画（ベンチマーク基準・自動化） | ❌ | — |
| セキュリティテスト計画（XSS・CSP 検証・Tauri パーミッション監査） | ❌ | — |

---

## 22. 配布・コミュニティ

| 項目 | 状態 | 参照ドキュメント |
|------|------|----------------|
| ライセンス方針（OSS vs 商用・EULA・サードパーティライセンス管理） | ❌ | — |
| プライバシー方針・テレメトリー設計（使用統計・オプトイン/アウト） | ❌ | — |
| クラッシュレポート・自動バグ報告設計（Sentry 等・プライバシー配慮） | ❌ | — |
| フィードバック機能・バグレポート UI（アプリ内フォーム・GitHub Issues 連携） | ❌ | — |

---

## 23. 今後さらに検討が必要な項目（長期・低優先度）

| 項目 | 優先度 | 備考 |
|------|--------|------|
| 国際化（i18n）設計 | 低 | UI テキストの多言語対応 |
| RTL（右から左）言語対応（Arabic / Hebrew 等） | 低 | CSS `direction: rtl` + BiDi テキスト処理 |
| Git 統合 | 低 | Typora 分析で差別化候補として言及 |
| AI プロバイダ直接連携の詳細設計 | 低 | OpenAI / Anthropic API を直接呼び出す UX・API キー管理 |
| コラボレーション（リアルタイム共同編集）| 低 | 個人開発フェーズでは対象外 |
| クラウドストレージ統合（Dropbox / OneDrive / Google Drive / iCloud） | 低 | ファイルの同期・競合解決が複雑 |
| ウェブクリッパー連携（ブラウザ拡張からの Markdown 保存） | 低 | ブラウザ拡張の別途開発が必要 |
| マルチウィンドウ独立動作設計（デスクトップ専用、Phase 7 以降） | 低 | タブ→ウィンドウ切り出し後の状態同期 |
