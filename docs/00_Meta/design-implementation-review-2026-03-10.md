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
| i18n基盤（i18next, 辞書, 初期化） | 未整合 | 未整合 | 影響大 | ルール違反あり（ハードコード） | **不一致** | P0 |
| 配布/自動更新導線（updater, release.yml） | 未整合 | 未整合 | 運用不可 | - | **不一致** | P0 |
| IME Enterガードの一貫適用 | 部分整合 | 未整合 | 影響中 | 最重要制約に抵触 | **不一致** | P0 |
| `performance-design.md` 準拠 | 部分整合 | 未整合あり | 影響大 | - | **部分準拠（要改善）** | P0〜P1 |
| IPC SoTドリフト（tauri-ipc-interface） | 未整合 | 未整合 | 影響大 | - | **不一致** | P0 |
| 将来フェーズ機能（git, metadata query, mobile等） | 未実装 | - | - | - | **保留（管理済み）** | P2 |

---

## 3. 主要不一致（統合後の確定事項）

### 3.1 i18n設計と実装の不一致（P0）

#### 設計要件（要約）

- `i18next` + `react-i18next` による基盤導入
- `src/i18n.ts` 初期化
- `src/locales/*` 名前空間辞書
- UIハードコード禁止（翻訳キー経由）

#### 実装確認

- `package.json` に `i18next` / `react-i18next` 依存が存在しない
- `src/app.tsx` などにハードコード文字列が残る
- `src/i18n/` は自然言語検出用途で、UI翻訳基盤ではない

#### 統合判定

**不一致（高）**

---

### 3.2 配布・自動更新設計と実装の不一致（P0）

#### 設計要件（要約）

- `src-tauri/tauri.conf.json` に `plugins.updater.pubkey/endpoints`
- `.github/workflows/release.yml` によるタグリリース
- 署名鍵運用を含む更新導線

#### 実装確認

- `src-tauri/tauri.conf.json` に `plugins.updater` セクションなし
- `.github/workflows/release.yml` 不在
- `scripts/bump-version.mjs` 相当の運用スクリプト不在

#### 統合判定

**不一致（高）**

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

#### 不一致・不足（重要）

- 大規模ファイル判定が「サイズのみ」で、設計のノード数判定（3000）を未実装
- 閾値チェックタイミングが設計例（openDocument事前判定）と異なり、エディタ側 `useEffect` 切替中心
- 自動保存が fire-and-forget ではなく `await` 前提の箇所があり、設計方針と不一致
- 自動保存デバウンスがファイルサイズ連動可変（500〜2000ms）ではなく、設定値固定参照
- D3 グラフ計算が Web Worker オフロード未導入（メインスレッドで `forceSimulation`）
- 性能計測ログの一部に `console.log` ベース運用が残存

#### 統合判定

**部分準拠（概ね60〜70%、P0〜P1で改善が必要）**

---

### 3.5 追加の主要指摘（高優先）

1. **Tauri IPC SoT ドリフト**
   - `tauri-ipc-interface.md` の定義（例: `set_title_bar_dirty`）と実装コマンド名（例: `set_title_dirty`）に差分
   - `git_*` 系や `get_app_version` など、設計定義と `invoke_handler` 実装整合の再点検が必要

2. **`restart_app` 呼び出しと実装不整合**
   - フロントエンド側 `invoke('restart_app')` 呼び出しがある一方、バックエンド実装/登録の不足が疑われる
   - 実行時フォールバックに依存した挙動は設計準拠・保守性の観点で不利

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

### P0（直近で着手）

1. **i18n最小実装の導入**
   - `i18next` / `react-i18next` を導入
   - `src/i18n.ts` と `src/locales/ja/common.json` など最小辞書を追加
   - 主要UI（AppShell周辺）を `t()` 化

2. **IMEガードの横断適用**
   - Enter処理を持つ箇所を棚卸しし、`isComposing` 判定を統一
   - `window` リスナ使用コンポーネントを優先修正

3. **IPC SoT 整合化**
   - `tauri-ipc-interface.md` と `src-tauri/src/lib.rs` の `invoke_handler` を突合
   - コマンド名ドリフト（例: `set_title_bar_dirty` 系）を是正
   - `restart_app` の実装/登録有無を確定し、契約を一本化

4. **性能設計の必須差分解消（第一段）**
   - 大規模ファイル判定にノード数閾値を追加
   - 自動保存の実行モデルを設計方針（fire-and-forget）に揃える

### P1（P0完了後）

5. **配布導線の最小接続**
   - `tauri.conf.json` に updater 設定枠を追加
   - `.github/workflows/release.yml` の最小ワークフローを追加

6. **性能設計の差分解消（第二段）**
   - 自動保存デバウンスの可変化（500〜2000ms）
   - D3 グラフ計算の Worker オフロード検討・導入

7. **運用スクリプト整備**
   - `scripts/bump-version.mjs` の追加
   - バージョン運用手順を `docs/` に明文化

8. **メタデータクエリ文法の堅牢化**
   - `BETWEEN ... AND ...` を壊さないトークナイズ/構文解析へ修正

### P2（将来フェーズ）

9. **Phase 7.5 / 将来フェーズ項目の順次実装**
   - `feature-list.md` の優先順位に従って実装・チェックオフ

10. **`feature-list.md` ステータス正規化**
   - 章内機能表と設計書↔実装対応表の整合ルールを定義

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

#### 6.3 残存課題（次回以降）

以下は本セッションでは未着手。P1/P2 として継続管理:

- i18n 基盤導入（P0 だが大規模タスク、feature-list.md で管理済み）
- 配布・自動更新導線の最小接続（P1）
- 性能設計の差分解消（ノード数閾値、自動保存 fire-and-forget 化）（P0〜P1）
- メタデータクエリ `BETWEEN ... AND ...` 文法堅牢化（P1）
- `feature-list.md` ステータス正規化（P2）

---

## 7. 変更履歴

- 2026-03-10: 初版レビューを4観点で再編し、統合版として再構成。
- 2026-03-10: `performance-design.md` 観点（準拠点/不一致点）と追加主要指摘（IPC SoT, restart_app, BETWEEN, ステータス整合）を追補。
- 2026-03-11: P0 是正第一弾を実施。IME ガード横断適用（6箇所）、IPC SoT 整合化（restart_app / emit_to_window 実装、set_title_dirty 命名修正）。
