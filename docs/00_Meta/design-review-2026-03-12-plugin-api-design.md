# レビュー: docs/01_Architecture/plugin-api-design.md（2026-03-12）

## 概要

- 設計書セクション数: 10
- 確認済み実装: 12 項目
- 未実装（要注意）: 3 項目
- 保留（feature-list.md 管理済み）: 1 項目

---

## セクション別レビュー結果

### §1 設計方針

#### 設計要件（抜粋）
- ビルトイン/サードパーティを同じ API 契約で扱うこと。
- サードパーティは iframe sandbox 隔離、ビルトインはメインスレッド実行とすること。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| プラグイン共通 API 契約（`PluginManifest`/`EditorPluginAPI`/`EditorPlugin`） | ✅ 準拠 | `src/plugins/plugin-api.ts:64-232` |
| サードパーティの iframe sandbox 実行基盤 | ✅ 準拠 | `src/plugins/plugin-bridge.ts:86-103`; `public/plugin-runtime.html:2-10` |
| ビルトインプラグインを同 API に移行（Mermaid/Math/Image） | ❌ 未実装 | `rg --files src/plugins | rg 'builtin|mermaid|math|image'` で該当未検出 |

#### 未実装・不一致の詳細
- **ビルトイン移行**: 設計書 §5 の `builtin.*` プラグイン実体（`mermaid-plugin`/`math-plugin`/`image-plugin`）は確認できない。

---

### §2 プラグインの拡張ポイント

#### 設計要件（抜粋）
- `registerNodeType` / `registerNodeView` / `registerCommand` / `registerInputRule` / `registerToolbarItem` / `registerMenuitem` / `registerSidebarPanel` / `registerMarkdownProcessor` / `registerExportPlugin` を拡張ポイントとして提供すること。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| NodeView/Toolbar/Sidebar/InputRule/MarkdownProcessor 拡張 API | ✅ 準拠 | `src/plugins/plugin-api.ts:167-193`; `src/plugins/plugin-manager.ts:171-210` |
| `registerCommand` / `registerMenuitem` / `registerExportPlugin` の API 露出 | ⚠️ 部分準拠 | `src/plugins/plugin-api.ts:157-207`（該当メソッド定義なし） |

#### 未実装・不一致の詳細
- **拡張ポイント不足**: 設計書に列挙された拡張ポイントの一部が API 型として公開されていない。

---

### §3 プラグイン API 型定義

#### 設計要件（抜粋）
- 権限モデルを含む `PluginManifest` と `EditorPluginAPI` を型で固定すること。
- `ToolbarItem` / `SidebarPanel` など UI 型を提供すること。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `PluginPermission` / `PluginManifest` / 設定宣言スキーマ | ✅ 準拠 | `src/plugins/plugin-api.ts:22-89` |
| `ToolbarItem` / `SidebarPanel` 型 | ✅ 準拠 | `src/plugins/plugin-api.ts:95-110` |
| postMessage 用 `PluginRequest` / `PluginResponse` | ✅ 準拠 | `src/plugins/plugin-api.ts:265-281` |

#### 未実装・不一致の詳細
- なし。

---

### §4 サンドボックス設計

#### 設計要件（抜粋）
- `iframe sandbox="allow-scripts"` を利用し、postMessage 経由でのみ通信すること。
- API 実行前に権限チェックすること。
- fs API はワークスペース外アクセスを Rust 側で拒否すること。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `sandbox="allow-scripts"` iframe と runtime 分離 | ✅ 準拠 | `src/plugins/plugin-bridge.ts:88-95`; `public/plugin-runtime.html:2-10,91-123` |
| PluginBridge での API メソッド別権限チェック | ✅ 準拠 | `src/plugins/plugin-bridge.ts:158-166`; `src/plugins/plugin-api.ts:288-301` |
| Rust 側パス正規化 + ワークスペース逸脱拒否 + `.md-editor` 拒否 | ✅ 準拠 | `src-tauri/src/commands/plugin_commands.rs:54-91` |
| Rust コマンド境界での plugin 権限再検証（`registry.has_permission` 相当） | ⚠️ 部分準拠 | `src-tauri/src/commands/plugin_commands.rs:123-196`（`plugin_id` を受けるが権限照合処理なし） |

#### 未実装・不一致の詳細
- **境界防御の不足**: 設計書例では Rust 側でも `fs:read`/`fs:write` 権限確認を要求しているが、現状は Bridge 側チェックに依存している。

---

### §5 ビルトインプラグイン

#### 設計要件（抜粋）
- Mermaid/KaTeX/画像をビルトインプラグインとして実装し、`registerExtension` で登録すること。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `registerExtension` をビルトイン専用 API として提供 | ✅ 準拠 | `src/plugins/plugin-manager.ts:154-170` |
| `builtin.mermaid` / `builtin.math` / `builtin.image` 実装 | ❌ 未実装 | `rg --files src/plugins | rg 'builtin|mermaid|math|image'` で該当未検出 |

#### 未実装・不一致の詳細
- **ビルトイン一覧の実体不足**: 設計書 §5.2 のビルトインプラグイン群はコード上で確認できない。

---

### §6 プラグインのライフサイクル

#### 設計要件（抜粋）
- `activate` / `deactivate` とクリーンアップ（disposable）を管理すること。
- クラッシュ時に自動無効化すること。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| activate/deactivate と disposable クリーンアップ | ✅ 準拠 | `src/plugins/plugin-manager.ts:73-127` |
| activate 失敗時ロールバック（登録解除・状態更新） | ✅ 準拠 | `src/plugins/plugin-manager.ts:88-112` |
| iframe 実行エラー（`plugin_error`）の検知経路 | ⚠️ 部分準拠 | `public/plugin-runtime.html:141-148`; `src/plugins/plugin-bridge.ts:132-174`（`plugin_error` 分岐なし） |

#### 未実装・不一致の詳細
- **クラッシュ検知経路の不足**: runtime は `plugin_error` を送信するが、Bridge 側で受信処理を確認できない。

---

### §7 プラグイン配布とインストール

#### 設計要件（抜粋）
- ローカルフォルダインストール（manifest 検証→権限確認→コピー）を提供すること。
- インストール済み状態を永続化すること。
- 更新フロー（バージョン比較・互換性確認・ロールバック）を提供すること。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| ローカルフォルダ選択 + manifest 読み込み + install/uninstall | ✅ 準拠 | `src/components/plugins/PluginManagerPanel.tsx:55-89,118-126`; `src-tauri/src/commands/plugin_commands.rs:203-270` |
| 権限確認ダイアログ表示 | ✅ 準拠 | `src/components/plugins/PluginManagerPanel.tsx:150-155`; `src/components/plugins/PermissionDialog.tsx:14-121` |
| 更新フロー（version/minApiVersion 比較・ロールバック） | ⚠️ 部分準拠 | `src/components/plugins/PluginManagerPanel.tsx:94-113`（有効/無効のみ、更新 UI なし） |

#### 未実装・不一致の詳細
- **更新機能不足**: 設計書 §7.4 の更新・ロールバック手順を実装で確認できない。

---

### §8 実装フェーズ

#### 設計要件（抜粋）
- Phase 3/7 の実装項目を段階的に実現すること。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| Phase 7 の進捗を管理台帳で運用 | 🔶 保留（管理済み） | `docs/00_Meta/feature-list.md:332-345,766-778` |

#### 未実装・不一致の詳細
- なし（本セクションは実装境界の運用方針。feature-list で管理されている）。

---

### §9 プラグイン設定 GUI とストア UX

#### 設計要件（抜粋）
- `manifest.settings` から動的フォームを生成すること。
- 設定を `plugin-store`（settings.json）へ永続化すること。
- 設定ダイアログ内にプラグイン管理 UI を統合すること。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| 動的フォーム（`string/number/boolean/color/select/textarea`） | ✅ 準拠 | `src/components/plugins/PluginSettingsForm.tsx:57-155` |
| 設定の永続化（`plugins.settings`） | ✅ 準拠 | `src/plugins/plugin-settings-store.ts:31-57` |
| 設定ダイアログへのプラグインタブ統合 | ✅ 準拠 | `src/components/preferences/tabs/PluginsTab.tsx:8-14` |
| `file` フィールド型の描画 | ⚠️ 部分準拠 | `src/plugins/plugin-api.ts:46-58`; `src/components/plugins/PluginSettingsForm.tsx:57-158`（`case 'file'` なし） |

#### 未実装・不一致の詳細
- **フィールド型不足**: 設計書の `file` 型入力は UI 実装で確認できない。

---

### §10 プラグインパフォーマンス監視と通信オーバーヘッド対策

#### 設計要件（抜粋）
- `editor:onChange` を 100ms デバウンス通知すること。
- RTT 計測・遅延検知・タイムアウト時自動無効化を行うこと。
- パフォーマンス統計を設定 UI に表示すること。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| 100ms デバウンス通知 + selection fire-and-forget | ✅ 準拠 | `src/plugins/plugin-bridge.ts:27,332-362` |
| RTT 計測・slow/timeout カウント・無効化コールバック | ✅ 準拠 | `src/plugins/plugin-bridge.ts:210-312` |
| 設定画面でのパフォーマンス統計表示（平均 RTT/タイムアウト回数等） | ❌ 未実装 | `src/components/plugins/PluginManagerPanel.tsx:1-339`（統計表示セクションなし） |

#### 未実装・不一致の詳細
- **統計 UI 欠如**: 設計書 §10.7 のパフォーマンス統計パネルは確認できない。

---

## 総合サマリー

| 判定 | 件数 |
|---|---|
| ✅ 準拠 | 12 |
| ⚠️ 部分準拠 | 6 |
| ❌ 未実装 | 3 |
| 🔶 保留（管理済み） | 1 |

### 主要な未実装・不一致（❌ / ⚠️ のみ列挙）

1. **ビルトインプラグイン移行** — `builtin.mermaid`/`builtin.math`/`builtin.image` の実体を確認できない。
2. **Rust 側権限再検証** — fs 系コマンドで `plugin_id` に紐づく権限照合処理が確認できない。
3. **クラッシュ通知経路** — runtime の `plugin_error` を Bridge が処理していない。
4. **更新フロー不足** — バージョン比較/互換性確認/ロールバック UI・処理が未確認。
5. **設定 `file` 型不足** — 動的フォームで `type: file` の描画分岐がない。
6. **パフォーマンス統計 UI 欠如** — 設計書 §10.7 の統計表示が未実装。
