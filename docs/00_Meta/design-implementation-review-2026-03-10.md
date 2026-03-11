# 設計書準拠レビュー統合版（2026-03-10）

> 目的: 既存の4バージョンのレビュー結果（観点別）を1本に統合し、
> 「何が未整合か」「どこまでロードマップ管理済みか」「次に何を直すか」を単一ドキュメントで判断できる状態にする。

---

## 1. 統合方針

### 1.1 4バージョンの扱い

本ドキュメントでは、レビュー結果を以下の4観点として統合した。

1. **V1: 機能実装整合レビュー**（設計機能の実装有無）
2. **V2: 仕様厳密性レビュー**（設計の必須条件と実装挙動の一致）
3. **V3: 品質/運用レビュー**（テスト・CI・配布導線・保守性）
4. **V4: 制約遵守レビュー**（IME最重要制約、安全性、運用ルール）

### 1.2 対象

- 設計ドキュメント: `docs/` 配下（43ファイル）
- 実装コード: `src/` + `src-tauri/` 配下（267ファイル）

### 1.3 実施コマンド

```bash
find docs -type f | sort
find src src-tauri -type f | wc -l
rg -n "❌" docs/00_Meta/feature-list.md
rg -n "i18next|react-i18next" src src-tauri
rg -n "[ぁ-んァ-ン一-龯]" src/components src/app.tsx
find .github -maxdepth 3 -type f
find scripts -maxdepth 2 -type f
rg -n "isComposing" src
rg -n "performance\.now|virtual|throttle|debounce|forceSimulation|restart_app|set_title" src src-tauri docs
```

### 1.4 判定ラベル

- **準拠**: 設計の必須要件を実装で確認できる
- **不一致**: 設計必須要件が未実装、または実装方針と矛盾
- **保留（管理済み）**: 未実装だが `feature-list.md` に ❌/🔶 として明示管理されている

---

## 2. 4バージョン統合サマリー

| 項目 | V1 | V2 | V3 | V4 | 統合判定 | 優先度 |
|---|---|---|---|---|---|---|
| i18n基盤（i18next, 辞書, 初期化） | ✅是正済 | 部分整合 | 影響中 | ハードコード残存あり | **部分準拠→P2継続管理**（基盤導入済、全コンポーネント t() 化は未完） | P2 |
| 配布/自動更新導線（updater, release.yml） | ✅是正済 | 部分整合 | 影響中 | - | **部分準拠→P2継続管理**（設定枠・CI・スクリプト導入済、署名鍵・フロントUI未実装） | P2 |
| IME Enterガードの一貫適用 | ✅是正済 | ✅是正済 | - | ✅是正済 | **✅ 是正完了（2026-03-11）** | ~~P0~~ |
| `performance-design.md` 準拠 | ✅是正済 | 部分整合 | 影響中 | - | **部分準拠→P2継続管理**（ノード数閾値・fire-and-forget・デバウンス可変化は実装済、D3 Worker未実装） | P2 |
| IPC SoTドリフト（tauri-ipc-interface） | ✅是正済 | ✅是正済 | - | - | **✅ 是正完了（2026-03-11）** | ~~P0~~ |
| メタデータクエリ BETWEEN 文法堅牢化 | 部分整合 | リスクあり | 影響中 | - | **P2継続管理** | P2 |
| 将来フェーズ機能（git, metadata query, mobile等） | 未実装 | - | - | - | **保留（管理済み）** | P2 |

---

## 3. 主要不一致（統合後の確定事項）

### 3.1 i18n設計と実装の不一致（P0）

#### 設計要件（要約）

- `i18next` + `react-i18next` による基盤導入
- `src/i18n.ts` 初期化
- `src/locales/*` 名前空間辞書
- UIハードコード禁止（翻訳キー経由）

#### 実装確認（2026-03-11 是正後）

- ✅ `package.json` に `i18next` (^25.8.17) / `react-i18next` (^16.5.6) 依存が追加済み
- ✅ `src/i18n.ts` で i18next 初期化（デフォルト: ja、名前空間: common, settings, editor, menu, errors）
- ✅ `src/locales/ja/` および `src/locales/en/` に翻訳辞書を配置（common, editor, settings, menu, errors）
- ✅ `AppShell.tsx` で `useTranslation()` を使用
- ⚠️ `src/app.tsx` 他、多くのコンポーネントにハードコード文字列が残存（全コンポーネント t() 化は未完）

#### 統合判定

**部分準拠（基盤は整備済み。全UIの t() 移行は P2 として継続管理）**

---

### 3.2 配布・自動更新設計と実装の不一致（P0）

#### 設計要件（要約）

- `src-tauri/tauri.conf.json` に `plugins.updater.pubkey/endpoints`
- `.github/workflows/release.yml` によるタグリリース
- 署名鍵運用を含む更新導線

#### 実装確認（2026-03-11 是正後）

- ✅ `src-tauri/tauri.conf.json` に `plugins.updater` セクション追加済み（endpoints 設定済み）
- ✅ `.github/workflows/release.yml` 追加済み（マルチプラットフォームビルド）
- ✅ `scripts/bump-version.mjs` 追加済み（セマンティックバージョニング同期）
- ✅ `src-tauri/Cargo.toml` に `tauri-plugin-updater` 依存追加済み
- ✅ `src-tauri/src/lib.rs` で updater プラグイン初期化済み
- ⚠️ `pubkey` が空（署名鍵の生成・設定は運用タスクとして残存）
- ⚠️ フロントエンド側の更新確認UI・通知トースト未実装

#### 統合判定

**部分準拠（インフラ整備済み。署名鍵設定・フロントエンドUIは P2 として継続管理）**

---

### 3.3 IME最重要制約の未統一適用（P0）

#### 設計要件（要約）

- Enterを扱う入力系ハンドラでは `isComposing === true` 時に誤発火させない

#### 実装確認

- `SmartPasteBar` の `window` keydown ハンドラに `isComposing` ガードなし
- `MetadataPanel` の Enter処理（CSS/JS追加）に `isComposing` ガードなし
- `GoToLineDialog` など一部にはガードあり

#### 統合判定

**不一致（中〜高）**

---

### 3.4 `performance-design.md` 準拠レビュー（追補）

#### 準拠している点

- 起動時間計測（`performance.now()`）の仕組みは実装済み
- 仮想スクロール拡張の基盤（ビューポート外デコレーション、100msスロットル、スクロール停止後の再計測）あり
- ノード高さキャッシュ（type:offset ベース）の方向性を実装済み
- Rust 側書き込みは `tokio::fs::write` による非同期 I/O
- パーサ性能ベンチ雛形（Vitest bench）が存在

#### 不一致・不足（是正後の残存課題）

- ✅ 大規模ファイル判定にノード数閾値（3000）を追加済み（`TipTapEditor.tsx`）
- ✅ 自動保存を fire-and-forget パターンに修正済み（`useAutoSave.ts` で `.then()/.catch()` チェーン）
- ✅ 自動保存デバウンスをファイルサイズ連動可変（500〜2000ms）に修正済み（`useAutoSave.ts`）
- ✅ 性能計測ログは開発ビルド専用として `console.log` 使用を明文化（`perf.ts`）
- ⚠️ D3 グラフ計算が Web Worker オフロード未導入（200ノード超は事前計算で緩和しているが、メインスレッド実行）

#### 統合判定

**部分準拠（概ね85〜90%。D3 Worker オフロードは P2 として継続管理）**

---

### 3.5 追加の主要指摘（高優先）

1. ~~**Tauri IPC SoT ドリフト**~~ → **✅ 是正完了**（2026-03-11）
   - ~~`tauri-ipc-interface.md` の定義（例: `set_title_bar_dirty`）と実装コマンド名（例: `set_title_dirty`）に差分~~
   - 設計書を実装名 `set_title_dirty` に統一。`emit_to_window` の型定義も追記済み。

2. ~~**`restart_app` 呼び出しと実装不整合**~~ → **✅ 是正完了**（2026-03-11）
   - バックエンド実装・登録済み（`window_commands.rs`）。
   - 設計書のシグネチャを実装（引数なし、`AppHandle` のみ）に合わせて修正済み。
   - セーフモード制御は `set_safe_mode` コマンドで事前に切り替える設計に統一。

3. **メタデータクエリ `BETWEEN ... AND ...` 文法の解釈リスク**
   - 設計は正式サポートだが、実装パーサの `AND` 分割順序次第で誤分解する可能性

4. **`feature-list.md` のステータス整合性ずれ**
   - 章ごとの ✅ 表記と、設計書↔実装対応表の ❌ 表記が同居する箇所があり、運用上の誤解を招く

---

## 4. 保留（ロードマップ管理済み）

以下は現時点で未実装だが、`feature-list.md` で ❌/🔶 が明示されており、
レビュー上は「未実装管理ができている」と判定する。

- `markdown-extensions-design.md`（❌）
- `accessibility-design.md`（❌）
- `git-integration-design.md`（❌）
- `metadata-query-design.md`（❌）
- `mobile-advanced-design.md`（❌）
- `distribution-design.md`（❌）
- `community-design.md`（❌）
- `i18n-design.md`（🔶）
- `testing-strategy-design.md`（🔶）
- `system-design.md` / `tauri-ipc-interface.md` / `security-design.md` / `performance-design.md` / `window-tab-session-design.md` / `cross-platform-design.md`（🔶）

> 注: ここでの「整合」は「未実装が明示管理されている」意味であり、
> 機能要件を満たしていることを意味しない。

---

## 5. 是正アクション（統合版）

### ~~P0（直近で着手）~~ → 是正完了 or P1/P2 に再分類

1. ~~**i18n最小実装の導入**~~ → **P1 に再分類**（§6.3 参照）

2. ~~**IMEガードの横断適用**~~ → **✅ 是正完了**（2026-03-11、§6.1 参照）

3. ~~**IPC SoT 整合化**~~ → **✅ 是正完了**（2026-03-11、§6.2 参照）

4. ~~**性能設計の必須差分解消（第一段）**~~ → **P1 に再分類**（§6.3 参照）

### ~~P1（継続管理）~~ → 是正完了 or P2 に再分類

5. ~~**i18n 基盤導入**~~ → **✅ 是正完了**（2026-03-11）
   - ✅ `i18next` / `react-i18next` を導入済み
   - ✅ `src/i18n.ts` と `src/locales/{ja,en}/{common,editor,settings,menu,errors}.json` を追加済み
   - ✅ 主要UI（AppShell）を `t()` 化済み
   - ⚠️ 全コンポーネントの `t()` 移行は P2 として継続管理

6. ~~**配布導線の最小接続**~~ → **✅ 是正完了**（2026-03-11）
   - ✅ `tauri.conf.json` に updater 設定枠を追加済み
   - ✅ `.github/workflows/release.yml` の最小ワークフローを追加済み
   - ✅ `Cargo.toml` に `tauri-plugin-updater` 依存を追加済み
   - ✅ `lib.rs` で updater プラグイン初期化済み
   - ✅ `capabilities/default.json` に `updater:default` パーミッション追加済み
   - ⚠️ 署名鍵の生成・設定、フロントエンド更新UIは P2 として継続管理

7. ~~**性能設計の差分解消**~~ → **✅ 主要項目は是正完了**（2026-03-11）
   - ✅ 大規模ファイル判定にノード数閾値（3000）を追加済み
   - ✅ 自動保存の実行モデルを設計方針（fire-and-forget）に修正済み
   - ✅ 自動保存デバウンスの可変化（500〜2000ms）を実装済み
   - ⚠️ D3 グラフ計算の Worker オフロードは P2 として継続管理

8. ~~**運用スクリプト整備**~~ → **✅ 是正完了**（2026-03-11）
   - ✅ `scripts/bump-version.mjs` の追加済み

### P2（将来フェーズ / 継続管理）

9. **メタデータクエリ文法の堅牢化**
   - `BETWEEN ... AND ...` を壊さないトークナイズ/構文解析へ修正

10. **Phase 7.5 / 将来フェーズ項目の順次実装**
   - `feature-list.md` の優先順位に従って実装・チェックオフ

11. **`feature-list.md` ステータス正規化**
   - 章内機能表と設計書↔実装対応表の整合ルールを定義

12. **i18n 全コンポーネント t() 移行**
   - `src/app.tsx` 他、ハードコード文字列が残るコンポーネントを `t()` に移行

13. **配布導線の完成**
   - 署名鍵の生成・`pubkey` 設定
   - フロントエンド側の更新確認UI・通知トースト実装

14. **D3 グラフ計算の Web Worker オフロード**
   - 現在は200ノード超で事前計算により緩和しているが、メインスレッド実行のまま

---

## 6. 是正実施ログ

### 2026-03-11: P0 是正（第一弾）

#### 6.1 IME ガード横断適用（§3.3 対応）

以下のコンポーネント/拡張の Enter キーハンドラに `isComposing` ガードを追加:

| ファイル | 修正箇所 |
|---------|---------|
| `src/components/SmartPaste/SmartPasteBar.tsx` | `window` keydown ハンドラに `isComposing \|\| keyCode === 229` ガード追加 |
| `src/components/HtmlMeta/MetadataPanel.tsx` | `handleCssKeyDown` / `handleJsKeyDown` に `nativeEvent.isComposing` ガード追加 |
| `src/components/sidebar/FileTreePanel.tsx` | リネーム入力・新規ファイル入力の Enter に `nativeEvent.isComposing` ガード追加 |
| `src/components/editor/FrontMatterPanel.tsx` | 削除ボタンの `onKeyDown` Enter に `nativeEvent.isComposing` ガード追加 |
| `src/extensions/SlashCommandsExtension.ts` | `handleKeyDown` 先頭に `isComposing \|\| keyCode === 229` ガード追加 |
| `src/extensions/WordCompleteExtension.tsx` | 既にガード済み（修正不要） |

#### 6.2 IPC SoT 整合化（§3.5 対応）

| 不一致項目 | 是正内容 |
|-----------|---------|
| `restart_app` 未実装 | `src-tauri/src/commands/window_commands.rs` に実装を追加、`lib.rs` に登録 |
| `emit_to_window` 未実装 | `src-tauri/src/commands/window_sync.rs` に実装を追加、`lib.rs` に登録 |
| `set_title_bar_dirty` 命名ドリフト | `tauri-ipc-interface.md` §9 を実装名 `set_title_dirty` に合わせて修正 |
| `emit_to_window` 設計書不在 | `tauri-ipc-interface.md` §9 に型定義を追記 |

#### 6.3 残存課題（P2 として継続管理）

以下は P2 として `feature-list.md` で継続管理する。
P1 の主要項目（i18n基盤・配布導線・性能設計差分）は 2026-03-11 に是正完了。

##### ~~P1（次期改善対象）~~ → 是正完了

| 課題 | 概要 | ステータス |
|------|------|--------|
| ~~i18n 基盤導入~~ | `i18next` / `react-i18next` 導入、AppShell `t()` 化、全名前空間辞書（ja/en）追加 | ✅ 是正完了 |
| ~~配布・自動更新導線~~ | `tauri.conf.json` updater 設定、`release.yml`、`tauri-plugin-updater` 依存・初期化、capabilities | ✅ 是正完了 |
| ~~性能設計差分解消~~ | ノード数閾値判定、自動保存 fire-and-forget 化、デバウンス可変化 | ✅ 主要項目是正完了 |

##### P2（将来フェーズ / 継続管理）

| 課題 | 概要 | 管理先 |
|------|------|--------|
| メタデータクエリ堅牢化 | `BETWEEN ... AND ...` 文法のトークナイズ/構文解析改善 | feature-list.md Phase 7.5 §メタデータクエリ |
| `feature-list.md` ステータス正規化 | 章内機能表と設計書↔実装対応表の整合ルール定義 | 本ドキュメント §3.5.4 |
| i18n 全コンポーネント t() 移行 | `src/app.tsx` 他のハードコード文字列を翻訳キーに移行 | feature-list.md 技術的負債 §i18n |
| 配布導線完成 | 署名鍵生成・pubkey設定、フロントエンド更新確認UI | feature-list.md 配布・アップデート章 |
| D3 Worker オフロード | グラフ計算をメインスレッドから Web Worker に移行 | feature-list.md 技術的負債 §performance |
| `restart_app` シグネチャ修正 | 設計書を実装（引数なし）に合わせて是正済み | tauri-ipc-interface.md §8 |

---

## 7. 変更履歴

- 2026-03-10: 初版レビューを4観点で再編し、統合版として再構成。
- 2026-03-10: `performance-design.md` 観点（準拠点/不一致点）と追加主要指摘（IPC SoT, restart_app, BETWEEN, ステータス整合）を追補。
- 2026-03-11: P0 是正第一弾を実施。IME ガード横断適用（6箇所）、IPC SoT 整合化（restart_app / emit_to_window 実装、set_title_dirty 命名修正）。
- 2026-03-11: P0 是正完了を確認。残存課題（i18n・配布導線・性能設計差分・メタデータクエリ堅牢化）を P1/P2 として再分類。§2 統合サマリー・§5 是正アクション・§6.3 残存課題を更新。
- 2026-03-11: P1 是正を実施。i18n 基盤導入（i18next + react-i18next、AppShell t()化）、配布導線（updater設定枠・release.yml）、性能設計差分解消（ノード数閾値・fire-and-forget・デバウンス可変化・D3大規模グラフ最適化）、運用スクリプト（bump-version.mjs）。
- 2026-03-11: 設計準拠レビュー再検証を実施。以下の是正を実施:
  - i18n: 英語翻訳辞書（en/{common,editor,settings,menu,errors}.json）を追加。日本語辞書（ja/{settings,menu,errors}.json）を追加。
  - 配布導線: `tauri-plugin-updater` を `Cargo.toml` に追加、`lib.rs` で初期化、`capabilities/default.json` に `updater:default` パーミッション追加。
  - IPC SoT: `restart_app` のシグネチャ不一致を是正（`tauri-ipc-interface.md` を実装に合わせて修正）。
  - §2 統合サマリー・§3 実装確認・§5 是正アクション・§6.3 残存課題を実態に合わせて更新。旧 P1 項目を是正完了、残存課題を P2 に再分類。
