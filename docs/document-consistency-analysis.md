# ドキュメント整合性分析レポート

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> 分析日: 2026-02-24
> 対象ドキュメント数: 37 件

---

## 目次

1. [矛盾・不整合の一覧](#1-矛盾不整合の一覧)
2. [検討不足・未解決課題の一覧](#2-検討不足未解決課題の一覧)
3. [重要度別サマリー](#3-重要度別サマリー)

---

## 1. 矛盾・不整合の一覧

### 矛盾1: フェーズ番号体系の二重定義【重要度: 高】

**関連ドキュメント**: `system-design.md §6`、`roadmap.md`

`system-design.md` と `roadmap.md` でフェーズ定義が異なる体系を使っており、同じ機能が別のフェーズ番号で呼ばれている。

| 機能 | `system-design.md` | `roadmap.md` |
|------|-------------------|-------------|
| テーマシステム（ライト/ダーク） | Phase 3 | Phase 3（一致）|
| ファイルツリー（フォルダを開く） | **Phase 4** | **Phase 3** |
| MD → HTML エクスポート | Phase 3 | Phase 4 |
| HTML WYSIWYG 編集 | Phase 4 | Phase 5 |
| プラグインシステム | **Phase 4** | **Phase 7** |
| AI コピーボタン統合 | **Phase 4** | **Phase 8** |
| マルチプラットフォーム展開 | Phase 5 | （フェーズなし） |

`system-design.md` は Phase 0〜5（計6フェーズ）の体系であり、`roadmap.md` は Phase 1〜8（計8フェーズ）の体系である。この差異を明示するドキュメントが存在しないため、両者を参照した際に混乱が生じる。

**推奨対応**: どちらかを正式なフェーズ体系として定め、他方に「このドキュメントの Phase N は roadmap.md の Phase M に相当する」という注記を追加する。

---

### 矛盾2: Mermaid のレンダリング実装方式の不整合【重要度: 高】

**関連ドキュメント**: `system-design.md §1.2`、`security-design.md §4.1.2`

`system-design.md` §1.2 の技術スタック表には Mermaid.js がフロントエンド直接利用として列挙されているが、`security-design.md` §4.1.2 では以下のように**明示的に主 WebView での直接実行を禁止**している。

> **主 WebView での直接実行は行わない**。代わりに**サンドボックス iframe 内で実行**する。

これにより、`system-design.md` を読んだ実装者が Mermaid をメインスレッドで直接インポートし、CSP 違反を引き起こすリスクがある。

**推奨対応**: `system-design.md` の技術スタック表に「Mermaid.js は sandbox iframe 経由で使用（security-design.md §4.1.2 参照）」という注記を追加する。

---

### 矛盾3: E2E テストフレームワークの不統一【重要度: 高】

**関連ドキュメント**: `system-design.md §7`、`testing-strategy-design.md §1.1`、`cross-platform-design.md §8.1`、`roadmap.md Phase 1`

各ドキュメントで E2E テストフレームワークの記述が異なる。

| ドキュメント | 記述内容 |
|------------|---------|
| `system-design.md §7` | **Playwright** |
| `roadmap.md Phase 1` | **Playwright** E2Eテスト環境 |
| `cross-platform-design.md §8.1` | **Playwright + Tauri Driver** |
| `testing-strategy-design.md §1.1` | **WebdriverIO + tauri-driver** |

Playwright と WebdriverIO は同時に採用できないわけではないが、`testing-strategy-design.md` では主要フレームワークとして WebdriverIO を明記している一方、他の3ドキュメントは Playwright を前提としている。

**推奨対応**: `testing-strategy-design.md` を正とし、他ドキュメントも Playwright に統一する（または WebdriverIO への変更理由を明示する）。

---

### 矛盾4: macOS ハイライトショートカットの二重定義【重要度: 高】

**関連ドキュメント**: `keyboard-shortcuts.md §1-1`、`keyboard-shortcuts.md §1-6`、`cross-platform-design.md §3.2`

`keyboard-shortcuts.md` において `Cmd+Shift+H` が **ハイライト** と **検索・置換** の両方に割り当てられている。

| 操作 | `keyboard-shortcuts.md` macOS |
|------|-------------------------------|
| ハイライト | `Cmd+Shift+H` ← §1-1 |
| 検索・置換 | `Cmd+Shift+H` ← §1-6 |

`cross-platform-design.md §3.2` では、この競合を認識してハイライトを `Cmd+Option+H` に変更しているが、`keyboard-shortcuts.md` 本体が更新されていない。

さらに `keyboard-shortcuts.md §1-1` の注記「macOS で `Cmd+H`（隠す）と競合」は不正確であり、実際に問題となるのは `Cmd+H` との競合ではなく `Cmd+Shift+H` が検索・置換と同一であることである。

**推奨対応**:
- `keyboard-shortcuts.md §1-1` のハイライトを `Cmd+Option+H` に修正
- §1-1 の注記を「`Cmd+Shift+H` は検索・置換と競合するため `Cmd+Option+H` を使用」に修正

---

### 矛盾5: 取り消し線ショートカットのコード上のバグ【重要度: 中】

**関連ドキュメント**: `cross-platform-design.md §3.3`、`keyboard-shortcuts.md §1-1`

`cross-platform-design.md §3.3` の `PLATFORM_SHORTCUTS` 定義において、macOS の取り消し線ショートカットのオブジェクトに不備がある。

```typescript
// cross-platform-design.md §3.3（現状）
STRIKETHROUGH: navigator.platform.toLowerCase().includes('mac')
  ? { ctrl: false, alt: false, shift: true, key: '5' }  // ← ctrl: false のまま
  : { ctrl: false, alt: true,  shift: true, key: '5' },
```

`{ ctrl: false, alt: false, shift: true, key: '5' }` は `Shift+5`（`%` キー）を意味し、意図する `Ctrl+Shift+5` とは異なる。`keyboard-shortcuts.md §1-1` では macOS の取り消し線を `Ctrl+Shift+5` としており、コードの実装意図と一致しない。

**推奨対応**: コードサンプルを `{ ctrl: true, alt: false, shift: true, key: '5' }` に修正する。

---

### 矛盾6: 自動保存デバウンス値の不整合【重要度: 中】

**関連ドキュメント**: `system-design.md §Phase 1`、`performance-design.md §10`

| ドキュメント | Phase 1 自動保存デバウンス値 |
|------------|---------------------------|
| `system-design.md §Phase 1` | **500ms** |
| `performance-design.md §10 (Phase 1a)` | **1000ms** |

どちらが正式な仕様か不明確。`performance-design.md §5.2` の優先度表では「500ms〜2000ms」の範囲と記載しており、さらに曖昧さを増している。

**推奨対応**: 正式な初期値を1か所（`window-tab-session-design.md §9` を SoT とすることが `performance-design.md §5.1` の注記にあるため、そこ）で定め、他は参照のみとする。

---

### 矛盾7: プラグインシステムのフェーズとセキュリティ要件の矛盾【重要度: 中】

**関連ドキュメント**: `security-design.md §4.8`、`plugin-api-design.md §8`

`security-design.md §4.8` は以下のように記述している。

> **Phase 1-6 では外部プラグインシステムは実装しない**。Phase 7 以降でコミュニティプラグインを検討する場合のポリシー草案。

一方、`plugin-api-design.md §8` では Phase 3 からビルトインプラグイン基盤を実装するとしている。「外部プラグイン」（サードパーティ）と「ビルトインプラグイン」の区別が `security-design.md` には明示されておらず、「Phase 3 でプラグイン基盤を構築すること」が `security-design.md` の方針に反するように読める。

**推奨対応**: `security-design.md §4.8` に「ビルトインプラグイン（Phase 3〜）と外部プラグイン（Phase 7〜）を区別する。本セクションは外部プラグインのみを対象とする。」という注記を追加する。

---

### 矛盾8: AI 機能に使用するモデル名の書式不統一【重要度: 低】

**関連ドキュメント**: `security-design.md §4.6`

`security-design.md §4.6` の `ALLOWED_MODELS` ホワイトリストにおいて、モデル名の書式が統一されていない。

```rust
const ALLOWED_MODELS: &[(&str, &str)] = &[
    ("anthropic", "claude-sonnet-4-5"),           // ← 日付なし
    ("anthropic", "claude-haiku-4-5-20251001"),   // ← 日付あり
    ("openai",    "gpt-4o"),
    ("openai",    "gpt-4o-mini"),
];
```

`claude-sonnet-4-5` には日付サフィックスがなく、`claude-haiku-4-5-20251001` には付いている。これが意図的な差異（最新版を指す vs 固定版を指す）か誤記かが不明確。

**推奨対応**: コメントで意図を明示するか、書式を統一する。

---

### 矛盾9: ドキュメント更新日の乖離【重要度: 低】

**関連ドキュメント**: `undo-redo-design.md`、`window-tab-session-design.md`

- `undo-redo-design.md` の更新日: **2026-02-23**
- `window-tab-session-design.md` の更新日: **2026-02-23**
- その他ほぼ全ドキュメント: 2026-02-24

これらのドキュメントは1日古く、2026-02-24 の改訂内容が反映されていない可能性がある。

---

## 2. 検討不足・未解決課題の一覧

### 課題A: design-coverage.md §4 の参照先誤り【重要度: 高】

**関連ドキュメント**: `design-coverage.md §4`、`undo-redo-design.md §3`

`design-coverage.md §4` では「モード切替をまたいだ履歴管理」の参照先として「`undo-redo-design.md §3`」を指定している。

しかし、`undo-redo-design.md §3` の実際の内容は「**ケース3: ブロックタイプ変更（Input Rule）**」であり、モード切り替えをまたいだ履歴管理とは別のトピックを扱っている。

モード切り替え時の Undo 仕様（「ソースモード中の変更を WYSIWYG の Undo で元に戻すことはできない」）は `performance-design.md §9.3` に記述されているが、`undo-redo-design.md` には独立したセクションとして設けられていない。

**推奨対応**:
- `undo-redo-design.md` にモード切り替えをまたいだ Undo 設計の専用セクションを追加する
- または `design-coverage.md §4` の参照先を `performance-design.md §9.3` に修正する

---

### 課題B: アクセシビリティ・国際化の実装フェーズ未定義【重要度: 高】

**関連ドキュメント**: `roadmap.md`、`accessibility-design.md`

`accessibility-design.md` は WCAG 2.1 AA 準拠の詳細設計書として完成しているが、`roadmap.md` では「技術的負債・改善」セクションに「アクセシビリティ（a11y）対応」と記載されているのみで、具体的な実装フェーズが割り当てられていない。

同様に「国際化（i18n）」もフェーズ未割り当てのまま技術的負債に列挙されており、実装計画が不明確である。

アクセシビリティ対応はアーキテクチャレベルで考慮が必要な事項であり、後から追加するコストが高くなりやすい。

**推奨対応**: 各フェーズのチェックリストに a11y 要件を組み込む（例: Phase 3 完了条件として「コンポーネントテストに ARIA ロール検証を含める」など）。

---

### 課題C: Pandoc のインストール確認とエラーハンドリング【重要度: 高】

**関連ドキュメント**: `pandoc-integration-design.md`、`roadmap.md`

`pandoc-integration-design.md` では Word・LaTeX・epub エクスポートに Pandoc が必要とされているが：

1. Pandoc のインストール有無を確認するタイミングが未定義
2. Pandoc 未インストール時のユーザー向けエラー UX が未設計
3. `roadmap.md` に Pandoc 統合の実装フェーズが明示されていない

**推奨対応**: `roadmap.md` に「Pandoc 統合（pandoc-integration-design.md 参照）」をフェーズ割り当てし、`error-handling-design.md` に Pandoc 未検出時の処理を追記する。

---

### 課題D: セッション復元とタブ LRU の整合性【重要度: 中】

**関連ドキュメント**: `performance-design.md §7.2`、`window-tab-session-design.md §2`

`performance-design.md §7.2` では「Phase 4 以降に LRU で最大5タブを保持」する方式を検討しているが、`window-tab-session-design.md §2` のセッション復元はすべての開いていたタブを復元することを前提としている。

セッション復元時に保存されているタブ数が LRU 上限（5タブ）を超えていた場合の挙動（超過分を復元しない・警告を出す等）が設計されていない。

**推奨対応**: `window-tab-session-design.md §2` に「LRU 上限を超えるタブがある場合は優先度順（最終アクセス日時が新しい順）で復元し、超過分はリスト表示する」などの仕様を追加する。

---

### 課題E: 3MB 超ファイルのクラッシュリカバリ欠如【重要度: 中】

**関連ドキュメント**: `performance-design.md §5.2`、`window-tab-session-design.md §10`

`performance-design.md §5.2` では「3MB 超のファイルは自動保存を行わない（手動保存のみ）」としているが、この仕様とクラッシュリカバリ設計との整合性が取れていない。

3MB 超のファイルをソースモードで編集中にクラッシュした場合、チェックポイントが存在しないためすべての変更が失われる。

**推奨対応**: 「3MB 超でも最低限のチェックポイント保存（差分のみ）を行う」か、またはユーザーへの明示的な警告（「このファイルは大きいためクラッシュ時に変更が失われる可能性があります」）を実装する。

---

### 課題F: 外部ファイル変更時の競合解決 UX の詳細不足【重要度: 中】

**関連ドキュメント**: `workspace-design.md`

ファイルウォッチャーによる外部変更検知の UX として「ダイアログで再読込を促す」と記述されているが、以下が未設計：

- エディタに未保存の変更がある場合のマージ UI（「ローカル変更を保持」「ファイルから再読込」「差分を表示」等）
- 競合解決後のカーソル位置・スクロール位置の扱い
- 自動保存中にファイルが外部から変更された場合の書き込み競合

**推奨対応**: `workspace-design.md` にファイル競合解決フロー図を追加する。

---

### 課題G: モバイルプラットフォームでのShift-JIS対応【重要度: 中】

**関連ドキュメント**: `file-operations-design.md`、`cross-platform-design.md`

`file-operations-design.md` では UTF-8/Shift-JIS エンコーディングのサポートが記述されているが、`cross-platform-design.md` ではモバイルプラットフォーム（Android/iOS）でのエンコーディング対応について言及がない。

Android の SAF（Storage Access Framework）経由で取得したファイルの文字コード自動判定が機能するかどうかが未検証・未設計。

**推奨対応**: `cross-platform-design.md §4.3` に「モバイルでのエンコーディング検出の制約と対応策」を追記する。

---

### 課題H: プラグイン更新メカニズムの未設計【重要度: 中】

**関連ドキュメント**: `plugin-api-design.md §7`

`plugin-api-design.md §7` ではインストール・アンインストール方法は記述されているが、インストール済みプラグインの**アップデート UX** が未設計。

- プラグインの新バージョン通知
- バージョン互換性チェック（API 非互換時の扱い）
- ロールバック方法

**推奨対応**: `plugin-api-design.md §7` にプラグイン更新フローを追加する。

---

### 課題I: IME 入力中のキーボードショートカット干渉の対策不足【重要度: 中】

**関連ドキュメント**: `keyboard-shortcuts.md`、`text-statistics-design.md §4`

`text-statistics-design.md §4` では IME 変換中の自動保存スキップ（`isComposing` チェック）が記述されているが、`keyboard-shortcuts.md` ではIME 変換中にショートカット（例: `Ctrl+B`）が意図せず発火してしまう問題への対策が記述されていない。

特に日本語 IME では`Backspace`・`Enter`・スペースキーが変換操作に使われるため、エディタショートカットとの衝突が発生しやすい。

**推奨対応**: `keyboard-shortcuts.md` セクション2 に「IME 変換中のショートカット制御方針（`isComposing` でのガード）」を追記する。

---

### 課題J: フォント定義の欠如【重要度: 低】

**関連ドキュメント**: `theme-design.md`、`cross-platform-design.md`

`theme-design.md` では CSS カスタムプロパティによるテーマシステムが定義されているが、プラットフォームごとのフォントフォールバック定義（例: Windows は `Meiryo`、macOS は `Hiragino Sans`、Linux は `Noto Sans CJK JP`）が明示されていない。

`cross-platform-design.md` でもフォント差異については触れていない。

**推奨対応**: `theme-design.md` に「プラットフォーム別フォントスタック」セクションを追加する。

---

### 課題K: ワークスペース全文検索への ripgrep 依存の扱い【重要度: 低】

**関連ドキュメント**: `search-design.md`、`performance-design.md §6.2`

`search-design.md` では ripgrep を使ったワークスペース全文検索を記述しているが、`performance-design.md §6.2` では同様の機能を Rust の `walkdir` + `regex` クレートで実装する設計になっている。

どちらが採用方針か、あるいは ripgrep が利用可能な場合は優先するなどの判断基準が不明確。

**推奨対応**: `search-design.md` または `performance-design.md §6.2` に「外部 ripgrep バイナリを同梱するか、Rust の regex クレートで内製するか」の判断とその理由を記述する。

---

### 課題L: スマートクォーテーション・オートコレクトの設計不足【重要度: 低】

**関連ドキュメント**: `design-coverage.md §2`、`user-settings-design.md`

`design-coverage.md §2` では「スマートクォーテーション・オートコレクト動作設計」が `user-settings-design.md §2.2`（設定項目のみ）として **🔶 部分的** と評価されており、専用設計が存在しない。

macOS WKWebView の自動スマートクォート変換と TipTap の Input Rule の干渉については `cross-platform-design.md §2.4` に「CSS `text-transform: none` + `autocorrect="off"` 属性」での対処が記述されているが、エディタ UX 設計としての詳細（例: Typora と同様の「→ に変換するが Undo できる」動作）が未設計。

---

## 3. 重要度別サマリー

### 高優先度（即時対応推奨）

| # | 種別 | 内容 | 影響 |
|---|------|------|------|
| 矛盾1 | 矛盾 | フェーズ番号体系の二重定義 | 実装者の混乱、誤ったスコープで実装 |
| 矛盾2 | 矛盾 | Mermaid のレンダリング実装方式 | CSP 違反・セキュリティリスク |
| 矛盾3 | 矛盾 | E2E テストフレームワーク不統一 | テスト環境の不一致・CI 設定ミス |
| 矛盾4 | 矛盾 | macOS ハイライトショートカットの二重定義 | 実装時のショートカット競合 |
| 課題A | 不足 | design-coverage.md §4 の参照先誤り | 設計漏れを見落とすリスク |
| 課題B | 不足 | アクセシビリティ実装フェーズ未定義 | 後から対応が困難になる |
| 課題C | 不足 | Pandoc インストール確認・フェーズ未定義 | ユーザー向けエラーハンドリング欠如 |

### 中優先度（フェーズ開始前に対応）

| # | 種別 | 内容 |
|---|------|------|
| 矛盾5 | 矛盾 | 取り消し線ショートカットのコードバグ（ctrl: false） |
| 矛盾6 | 矛盾 | 自動保存デバウンス値（500ms vs 1000ms） |
| 矛盾7 | 矛盾 | プラグインフェーズとセキュリティ要件の定義不一致 |
| 課題D | 不足 | セッション復元と LRU 上限の整合性 |
| 課題E | 不足 | 3MB 超ファイルのクラッシュリカバリ欠如 |
| 課題F | 不足 | 外部ファイル変更時の競合解決 UX |
| 課題G | 不足 | モバイルでの Shift-JIS 対応 |
| 課題H | 不足 | プラグイン更新メカニズム未設計 |
| 課題I | 不足 | IME 入力中のショートカット干渉対策 |

### 低優先度（技術的負債として管理）

| # | 種別 | 内容 |
|---|------|------|
| 矛盾8 | 矛盾 | AI モデル名の書式不統一 |
| 矛盾9 | 矛盾 | undo-redo-design.md 等の更新日の乖離 |
| 課題J | 不足 | フォント定義の欠如 |
| 課題K | 不足 | ワークスペース全文検索への外部依存の曖昧さ |
| 課題L | 不足 | スマートクォーテーション設計の不足 |

---

*本分析は 2026-02-24 時点のドキュメント群を対象とした。新規ドキュメントの追加や既存ドキュメントの更新時は本レポートを改訂すること。*
