# Typora-Inspired WYSIWYG Markdown Editor — Codex 開発ルール

---

## 🚀 タスク開始プロトコル（毎回必ず実行）

### ステップ1: 現在地の確認

`docs/00_Meta/feature-list.md` を読み込む。
最も番号の小さい Phase で、未完了（❌）の項目を探す。
その項目が「今回実装するタスク」。

### ステップ2: 設計書の確認

feature-list.md のタスクに紐づく設計ドキュメントを読む。
（例: テーブル機能なら対応する design.md を参照）
設計書の仕様通りに実装する。設計書にない仕様は勝手に追加しない。
設計書の探し方は末尾の「[📐 設計書の読み方](#設計書の読み方)」を参照。

### ステップ3: 実装

タスクを実装する。
**1タスク = 1コミット** を原則とする。
コミットメッセージ形式: `<type>(phase-N): <タスク名>`

| type | 使いどころ |
|------|-----------|
| `feat` | 新機能の追加 |
| `fix` | バグ修正 |
| `refactor` | 機能変更を伴わないコード整理（明示的に指示された場合のみ）|
| `docs` | ドキュメント・設計書の更新 |
| `test` | テストの追加・修正 |

### ステップ4: テストを必ず実行する（コミット前の必須チェック）

```bash
npm run lint          # ESLint エラーがないこと
npm run format:check  # Prettier フォーマットが通ること
npm run test          # Vitest 単体テストが全て PASS すること
npm run build         # TypeScript コンパイルエラーがないこと
```

Rust コードを変更した場合は追加で:

```bash
cd src-tauri && cargo fmt --check   # フォーマット確認
cd src-tauri && cargo clippy        # lint（warning も修正する）
cd src-tauri && cargo test          # Rust 単体テスト
```

**エラーが出たら必ず修正してから次のステップに進む。エラーを無視してコミットしない。**

テストの書き方・配置ルールは「[🧪 テスト方針](#テスト方針)」セクションを参照。

### ステップ5: チェックオフ

実装完了後、`docs/00_Meta/feature-list.md` の該当行を更新する。
実装列を ❌ → ✅ に変更する。
その変更を同じコミットに含める。

### ステップ6: 次タスクへ

次タスクの設計書を読み、実装開始から完了まで十分に対応できると判断できる場合は次の `- [ ]` タスクに進む。
判断が難しい場合は「次回: <次のタスク名>」と出力してセッションを終了する。

---

## 🔍 設計書実装整合レビュープロトコル

> **トリガー**: 「次のレビューを実施して」「レビューして」など、設計書と実装の整合レビューを依頼されたとき。
> 実装タスクの依頼とは明確に区別し、このプロトコルはレビュー（調査・報告）専用とする。
> **修正作業は行わない。修正方法も記載しない。**

### ステップ R1: 次のレビュー対象を決定する

```
docs/00_Meta/design-review-queue.md を読む
→ ステータスが pending の最も番号の小さいエントリーを対象とする
→ そのエントリーのステータスを in_progress に更新してコミットする
```

### ステップ R2: 設計書を精読する

```
対象の設計書ファイルを全文読む。
各セクションについて、以下を把握する:
- 何を「実装すべき必須要件」として定義しているか
- どのファイル・モジュールに対応する実装が存在するはずか（パス・型名・コマンド名など）
- 将来フェーズ扱い（❌ 保留）と明記されているか否か
```

### ステップ R3: 実装を検索・確認する

設計書のセクションごとに、以下の手順で対応する実装の存在と内容を確認する。

**検索の基本戦略**

```
1. 設計書で言及されているファイル名・関数名・型名・コマンド名・定数名を
   grep / find で検索し、実装ファイルの存在を確認する。

2. 実装ファイルが存在する場合は、設計書の要件と照合する:
   - 設計書が定義するシグネチャ・型・引数と実装が一致するか
   - 設計書が定義する処理フロー・条件分岐が実装されているか
   - 設計書が「必須」と明示した挙動（エラーハンドリング・ログ・ガード処理等）が漏れていないか

3. 実装ファイルが見つからない場合は、類似のファイル・代替実装がないか
   ディレクトリ全体を確認する。それでもない場合は「未実装」と記録する。
```

**検索の優先パス**

| 設計書カテゴリ | 主な対象パス |
|---|---|
| `01_Architecture/` | `src/`, `src-tauri/src/`, `src-tauri/tauri.conf.json` |
| `02_Core_Editor/` | `src/extensions/`, `src/core/`, `src/lib/` |
| `03_UI_UX/` | `src/components/`, `src/styles.css`, `src-tauri/src/menu/` |
| `04_File_Workspace/` | `src/file/`, `src/store/`, `src-tauri/src/fs/`, `src-tauri/src/commands/` |
| `05_Features/` | `src/features/`, `src/components/`, `src-tauri/src/` |
| `06_Export_Interop/` | `src/components/`, `src-tauri/src/commands/` |
| `07_Platform_Settings/` | `src/settings/`, `src/i18n/`, `src-tauri/tauri.conf.json`, `.github/` |
| `08_Testing_Quality/` | `src/**/*.test.ts`, `e2e/`, `src/utils/logger.ts` |

### ステップ R4: レビューレポートを作成する

以下のフォーマットで `docs/00_Meta/design-review-<YYYY-MM-DD>-<設計書名キーワード>.md` を作成する。

**出力フォーマット**

```markdown
# レビュー: <設計書ファイルパス>（<YYYY-MM-DD>）

## 概要

- 設計書セクション数: N
- 確認済み実装: N 項目
- 未実装（要注意）: N 項目
- 保留（feature-list.md 管理済み）: N 項目

---

## セクション別レビュー結果

### §N <セクション名>

#### 設計要件（抜粋）
> 設計書から直接引用または要約した必須要件を箇条書きで列挙

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| <要件の短縮説明> | ✅ 準拠 / ⚠️ 部分準拠 / ❌ 未実装 / 🔶 保留（管理済み） | `src/foo/bar.ts:42` など |

#### 未実装・不一致の詳細
（判定が ⚠️ または ❌ のものについてのみ、具体的に何が足りないかを記述する）
- **<要件名>**: 設計書では〇〇を要求しているが、実装では△△になっている（または存在しない）

---

## 総合サマリー

| 判定 | 件数 |
|---|---|
| ✅ 準拠 | N |
| ⚠️ 部分準拠 | N |
| ❌ 未実装 | N |
| 🔶 保留（管理済み） | N |

### 主要な未実装・不一致（❌ / ⚠️ のみ列挙）

1. **<項目名>** — <1行説明>
2. ...
```

**判定基準**

| 判定 | 基準 |
|---|---|
| ✅ 準拠 | 設計書の必須要件を実装で確認できる |
| ⚠️ 部分準拠 | 主要な枠組みは存在するが、設計書の一部要件（サブ仕様・エラー処理・ガード等）が未実装 |
| ❌ 未実装 | 設計書が必須と定義しているが、対応する実装コードが存在しない |
| 🔶 保留（管理済み） | `feature-list.md` に ❌ または 🔶 として明示管理されており、意図的な未実装 |

> **注意**: 判定は「設計書の記述」と「実装コードの事実」の照合のみで行う。
> 「望ましい実装方法」「修正すべき箇所」などの提案は一切記載しない。

### ステップ R5: キューを更新してコミットする

```
1. docs/00_Meta/design-review-queue.md の対象エントリーを更新する:
   - ステータス: in_progress → done
   - レビュー日: YYYY-MM-DD
   - レビューファイル: 作成したファイルのパス

2. 変更をコミットする:
   コミットメッセージ: docs(review): <設計書名> レビュー完了
   対象ファイル:
   - docs/00_Meta/design-review-queue.md
   - docs/00_Meta/design-review-<date>-<keyword>.md

3. 次の pending エントリーを出力して終了する:
   「次回レビュー対象: #N <設計書ファイルパス>」
```

### ⚠️ レビュープロトコルの禁止事項

- **修正コードを書かない・提案しない**（修正方法・改善案も不要）
- **feature-list.md の ❌ 管理済み項目を「未実装」と誤判定しない**（必ず `feature-list.md` を確認して保留扱いにする）
- **実装ファイルが見つからないまま ✅ にしない**（「確認できなかった」は ❌ または ⚠️ として記録する）
- **設計書を読まずに過去レビュー結果だけで判定しない**（毎回必ず設計書を精読する）

---

## 🔍 回答・コード品質プロトコル（実装コードの生成・修正時に必ず実行）

コードを書いたら、**コミットする前に**以下のサイクルを必ず実行する。
「書いた」で終わりにせず、「直した上で出す」を習慣にすること。
質問への回答や設計の提案のみの場合はこのプロトコルは省略してよい。

### フェーズ A: 批判的レビュー（意図的に粗探しをする）

コードを一度脇に置き、**疑いの目で**以下を確認する。
問題が見つかれば即修正してから次へ進む。

**バグ・不具合の探索**

- 競合状態（race condition）や非同期処理の await 漏れ・エラー握り潰しはないか
- `null` / `undefined` アクセス、配列の境界外参照が起きうる箇所はないか
- IME 入力中（`isComposing === true`）の考慮漏れはないか（本プロジェクト最重要制約）
- エッジケースを考慮しているか（空文字・空配列・0バイトファイル・改行コード差異・Unicode）
- Rust: `unwrap()` / `expect()` の残存、エラーが `log::error!` なしで返されていないか

**設計・効率性の検討**

- 同じロジックが重複していないか（DRY）
- 不要な再レンダリングや再計算を引き起こしていないか（`useMemo` / `useCallback` の過不足）
- 設計書（`docs/`）の仕様と矛盾する実装になっていないか
- もっとシンプルに書ける方法がないか（抽象化が過剰 or 不足していないか）

**セキュリティ**

- ユーザー入力を直接 innerHTML に渡していないか（XSS）
- Rust 側でパス操作にディレクトリトラバーサルの余地がないか

### フェーズ B: 3回推敲

批判的レビューで問題がなくなった後、さらに以下を 3 ラウンド実施する。
各ラウンドで問題が見つかれば修正してから次のラウンドへ。

```
1回目: 「このコードは実際に動くか？」— 実行パスを頭の中でトレースし、想定外の分岐がないか確認する
2回目: 「もっとシンプルに書けないか？」— 不要な複雑さを削る
3回目: 「将来の読み手が迷わず読めるか？」— 変数名・関数名・コメントの明確さを確認する
```

### フェーズ C: 自己採点と改善

以下の基準で **1〜10 点** を自己採点する。

| 採点基準 | 満点 |
|---------|------|
| 要件・設計書の仕様を完全に満たしている | 3点 |
| バグ・エッジケースへの対処が十分 | 3点 |
| シンプルさ・可読性（規約準拠含む） | 2点 |
| テスト・lint が通る状態になっている | 2点 |

**採点が 8点未満の場合は出力しない。** 減点箇所を特定して修正し、再採点してから出力する。
採点が 8点未満だった場合は、減点理由と修正内容を一言添えてから出力する。

---

## ⚠️ 禁止事項（ガードレール）

### タスクスコープ
- ロードマップにない機能を勝手に実装しない
- 1セッションで複数フェーズをまたがない（前の Phase が完了するまで次に進まない）
- 設計書（`docs/`）の内容と矛盾する実装をしない

### リファクタリング
- **タスクに含まれていないファイルを勝手に書き換えない**
- 「ついでにリファクタ」「命名を統一」「型を改善」などの理由で関係ないコードに触れない
- 大規模なディレクトリ構成変更・ファイル移動は禁止（明示的に指示された場合を除く）
- 既存のインターフェース（Zustand ストア API、Tauri コマンド名）を無断で変更しない

### 追加・削除
- 未使用コードの削除は、今回のタスクで自分が追加したものに限る
- 依存パッケージの追加は、設計書に明記されている技術に限る
- 設計書にないライブラリを新たに `npm install` / `cargo add` しない

---

## 基本アーキテクチャ

- **フロントエンド:** React 19, Vite 6, TypeScript 5.7, TipTap v3, Tailwind CSS 4
- **バックエンド:** Tauri 2.0, Rust (edition 2021)
- **状態管理:** Zustand 5（クライアント）, SQLite / rusqlite（メタデータ）
- ローカルファイルシステムが Single Source of Truth

---

## ⚠️ 実装時の制約

1. **IME対応（最重要）:** 日本語IME入力中（`isComposing === true`）は Enter キーで処理を誤爆させない。TipTap の InputRule・スラッシュコマンド・キーハンドラ全てで判定を入れる。
2. **ファイル競合:** 未保存（isDirty）のファイルが外部変更された場合、自動リロードせずユーザーに選択させる。
3. **パフォーマンス:** 入力レイテンシ < 16ms。ファイル保存（Tauri API）は必ずデバウンス処理し、UIスレッドをブロックしない。
4. **エクスポート:** スタンドアロンHTML出力時、ローカル画像は Rust 側で Base64 (Data URI) にエンコードして埋め込む。
5. **Undo/Redo:** YAML Front Matter（CodeMirror）と本文（TipTap）の履歴は独立して扱う。統合しない。

---

## 📦 使ってよいライブラリ / 禁止ライブラリ

### フロントエンド（許可済み）

| ライブラリ | 用途 |
|-----------|------|
| `@tiptap/*` | WYSIWYG エディタ本体・拡張 |
| `zustand` | クライアント状態管理 |
| `remark`, `remark-gfm`, `remark-stringify`, `unified` | Markdown パース・シリアライズ |
| `turndown`, `turndown-plugin-gfm` | HTML → Markdown 変換 |
| `dompurify` | HTML サニタイズ |
| `lowlight`, `highlight.js` | コードブロック シンタックスハイライト |
| `@tauri-apps/api`, `@tauri-apps/plugin-*` | Tauri IPC・OS 機能 |
| `tailwindcss`, `@tailwindcss/typography` | スタイリング |

### Rust（許可済み）

| クレート | 用途 |
|---------|------|
| `serde`, `serde_json` | シリアライズ |
| `tauri`, `tauri-plugin-*` | Tauri フレームワーク |
| `rusqlite` (bundled) | SQLite |
| `notify` | ファイル監視 |
| `thiserror` | エラー型定義 |
| `tokio` (fs, time) | 非同期処理 |
| `log` | ロギング |

### 禁止（追加インストール不可）

- **MomentJS** → 日時処理が必要なら `Intl` API か `Date` を使う
- **Lodash** → ユーティリティは自前実装か TypeScript 標準機能を使う
- **Axios** → HTTP 通信は Tauri IPC 経由で行い、直接 fetch する場合は fetch API を使う
- **jQuery, Bootstrap, Material UI** → スタイルは Tailwind CSS で統一
- **React Router** → シングルウィンドウ SPA のため不要

### 要相談（追加前にユーザーの承認が必要）

上記以外の新規ライブラリを追加する必要が生じた場合は、**実装前にユーザーに理由を説明して承認を得る**。
無断で `npm install` / `cargo add` しない。

---

## 🏎️ パフォーマンス設計原則（大規模ファイル対応）

本プロジェクトは 200KB 以上の Markdown ファイルを日常的に扱うユーザーを想定している。
以下の原則を**すべての修正・機能追加**で遵守すること。

### 原則 1: Zustand セレクターは必ず細粒度にする

`useTabStore()` のようにセレクター無しで呼び出すと、ストア内の**あらゆる値の変更**（content の 1 文字変更を含む）でコンポーネントが再レンダリングされる。

```typescript
// ❌ 禁止: ストア全体を購読（content 変更のたびに再レンダリング）
const { tabs, activeTabId, addTab } = useTabStore();

// ✅ 必須: 必要なフィールド・アクションのみを個別に購読
const activeTabId = useTabStore((s) => s.activeTabId);
const addTab = useTabStore((s) => s.addTab);

// ✅ content を含む配列を購読する場合は shallow 等価関数で content 変更を除外
const allTabs = useTabStore((s) => s.tabs, tabsShallowEqual);
```

**特に注意すべきパターン:**
- `tab.content`（数百 KB になりうる文字列）を React の props として渡すと、内容が変わるたびにコンポーネントツリー全体が再レンダリングされる。`key={tab.id}` で一度だけマウントされるコンポーネントには、マウント時に `useTabStore.getState()` で直接読むことを検討する。
- `useTitleBar` や `StatusBar` のようなグローバル UI は、必要な値（`fileName`, `isDirty` 等）のみを購読する。

### 原則 2: ProseMirror プラグインの `view()` は DOM 未接続を前提にする

TipTap の `useEditor()` は React の DOM マウント前に EditorView を作成する場合がある。プラグインの `view()` コールバックで DOM 要素（スクロールコンテナ等）を検出する場合は、**遅延検出（リトライ付き）** を実装すること。

```typescript
// ❌ 禁止: view() 内で1回だけ検出し、見つからなければ諦める
view(editorView) {
  const container = editorView.dom.closest('.editor-scroll-container');
  // container が null の場合、スクロールイベントが永久に捕捉されない
}

// ✅ 必須: editorView.dom.isConnected を確認し、未接続なら定期リトライ
view(editorView) {
  let container = null;
  const tryDetect = () => {
    if (!editorView.dom.isConnected) return false;
    container = findScrollContainer(editorView);
    return !!container;
  };
  if (!tryDetect()) {
    const timer = setInterval(() => { if (tryDetect()) clearInterval(timer); }, 50);
  }
}
```

### 原則 3: 大規模コンテンツの同期処理を避ける

200KB の Markdown パース（`markdownToTipTap`）や `editor.commands.setContent()` はメインスレッドを数百 ms ブロックする可能性がある。

- **50KB 超のコンテンツ**: `requestAnimationFrame` で UI ペイント後に遅延実行する
- **3MB 超のコンテンツ**: ソースモードに自動切替し、WYSIWYG パースを回避する
- **3000 ノード超のドキュメント**: パース後にノード数チェックしソースモードへフォールバック

### 原則 4: VirtualScrollExtension の不変条件

仮想スクロールが正しく動作するための条件:
1. スクロールコンテナが検出されていること（`findScrollContainer` が非 null を返す）
2. `docChanged` 後に必ずビューポート再計算がスケジュールされること
3. 高さキャッシュが `docChanged` 時にクリアされ、スクロール停止時に実測値で更新されること

新しい TipTap 拡張やエディタ周りの変更を加える際は、これらの不変条件を壊していないか確認すること。

### 原則 5: `lastEmittedContentRef` パターン

TipTapEditor の `initialContent` → エディタ → `onContentChange` → ストア → `initialContent` の循環を防ぐために `lastEmittedContentRef` を使用している。

- `lastEmittedContentRef` は `null`（sentinel）で初期化する。`initialContent` で初期化すると初回ロードがスキップされる。
- `emitMarkdown()` で設定し、`useEffect` で比較する。同一参照なら再注入をスキップする。

---

## 📐 コーディング規約

### TypeScript / React

**命名規則**

| 対象 | 規則 | 例 |
|------|------|-----|
| コンポーネント | PascalCase | `TabBar`, `EditorPane` |
| hooks | `use` + PascalCase | `useFileDialogs`, `useTabStore` |
| 型・インターフェース | PascalCase | `TabState`, `AppSettings` |
| 関数・変数 | camelCase | `addTab`, `isDirty` |
| 定数（モジュールスコープ） | UPPER_SNAKE_CASE | `DEFAULT_SETTINGS` |
| ファイル名（コンポーネント） | PascalCase `.tsx` | `TabBar.tsx` |
| ファイル名（ユーティリティ・lib） | kebab-case `.ts` | `tiptap-to-markdown.ts` |
| ファイル名（ストア） | camelCase `Store.ts` | `tabStore.ts` |

**Prettier 設定（`.prettierrc`準拠、変更禁止）**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "endOfLine": "lf"
}
```

**型安全**

- `any` は原則禁止。どうしても必要な場合は `// eslint-disable-next-line @typescript-eslint/no-explicit-any` と理由コメントを併記
- `as` キャストは型ガードで代替できないか必ず検討する
- `!` 非 null アサーションは使用禁止。optional chaining（`?.`）や早期 return を使う

**エラーハンドリング（フロントエンド）**

- Tauri コマンド呼び出しは必ず `try/catch` する
- catch したエラーは `logger.error()` でログを残してから `toastStore` でユーザーに通知する
- エラーを握り潰す（catch して何もしない）ことは禁止
- React コンポーネントのエラーは `AppErrorBoundary` / `EditorErrorBoundary` に任せる

```typescript
// 良い例
try {
  await invoke('write_file', { path, content });
} catch (err) {
  logger.error('ファイル保存失敗', err);
  toastStore.getState().addToast({ type: 'error', message: '保存に失敗しました' });
}
```

**ログ（フロントエンド）**

- `console.log` は使用禁止。必ず `src/utils/logger.ts` の `logger` を使う
- ログレベル: `logger.debug` (開発用詳細) / `logger.info` (正常フロー) / `logger.warn` (非致命的異常) / `logger.error` (エラー)

**インポート順**

1. Node 標準モジュール
2. 外部ライブラリ（react, zustand, @tiptap/... 等）
3. 内部モジュール（`@/` エイリアス使用）
4. 型インポート（`import type { ... }`）

---

### Rust

**命名規則**

- 関数・変数・モジュール: `snake_case`
- 型・トレイト・列挙型: `PascalCase`
- 定数: `UPPER_SNAKE_CASE`
- Tauri コマンド名: `snake_case`（フロントエンドの `invoke('command_name')` と一致させる）

**エラーハンドリング（Rust）**

- Tauri コマンドの境界では `Result<T, String>` を返す（Tauri の制約）
- 内部ロジックでは `AppError`（`src-tauri/src/models/error.rs`）を使い `thiserror` で定義する
- `unwrap()` / `expect()` は禁止。`?` 演算子か明示的なエラー処理を使う
- エラーは `log::error!()` で記録してから返す

```rust
// 良い例
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    let content = tokio::fs::read_to_string(&path).await.map_err(|e| {
        log::error!("read_file failed: {e}");
        AppError::from_io(e, &path).to_string()
    })?;
    Ok(content)
}
```

**ログ（Rust）**

- `println!` は使用禁止。`log::info!()` / `log::error!()` / `log::warn!()` / `log::debug!()` を使う
- 新規 Tauri コマンドの先頭では必ず `log::info!("command_name: ...")` を入れる

**新規 Tauri コマンド追加時の手順**

1. `docs/01_Architecture/tauri-ipc-interface.md` に先に型定義を記入する（設計書が SoT）
2. `src-tauri/src/commands/` に実装する
3. `src-tauri/src/lib.rs` の `.invoke_handler()` に登録する
4. フロントエンドの `src/lib/tauri-commands.ts` にラッパー関数を追加する

---

## 🧪 テスト方針

テストの**実行コマンド**はステップ4を参照。このセクションでは「何をどこに書くか」を定める。

### 単体テスト（Vitest）

- テストファイルは実装ファイルと同じディレクトリに置く: `foo.ts` → `foo.test.ts`
- `@testing-library/react` でコンポーネントをテストする
- 純粋な変換ロジック（`markdown-to-tiptap.ts` 等）は必ずテストを書く
- Tauri API を使う関数は `vi.mock('@tauri-apps/api/core')` でモックする

### E2Eテスト（Playwright）

- `e2e/` ディレクトリに `*.spec.ts` として追加する
- 新機能を実装した場合、対応する E2E テストも書く（義務ではないが強く推奨）

### テスト優先度

1. **必須:** lint + format:check + test + build が全て PASS すること
2. **推奨:** 実装した関数・コンポーネントに単体テストを追加する
3. **任意:** E2E テストの追加

---

## 🔀 PR の書き方

### タイトル

```
<type>(phase-N): <実装したタスク名>
```

`type` はコミットメッセージと同じ規則（`feat` / `fix` / `docs` / `refactor` / `test`）を使う。
例: `feat(phase-2): テーブルのレンダリング` / `fix(phase-1): IME入力中のEnter誤爆を修正`

### 本文テンプレート

```markdown
## 概要

<!-- feature-list.md の何番タスクを実装したか -->
Phase N の「タスク名」を実装しました。

## 変更内容

- `src/...` : 〇〇を追加
- `src-tauri/src/...` : 〇〇を追加

## 設計書との対応

- 設計書: `docs/.../xxx-design.md §N`
- 設計書の仕様に準拠して実装しています

## チェックリスト

- [ ] `npm run lint` が PASS している
- [ ] `npm run format:check` が PASS している
- [ ] `npm run test` が全て PASS している
- [ ] `npm run build` が成功している
- [ ] Rust を変更した場合: `cargo clippy` / `cargo test` が PASS している
- [ ] `docs/00_Meta/feature-list.md` の該当タスクの実装列を ✅ にした
- [ ] 設計書にない機能を追加していない
- [ ] タスクと無関係なファイルを変更していない
```

---

## 📐 設計書の読み方

| ファイル | 役割 |
|---------|------|
| `docs/00_Meta/feature-list.md` | **総合機能一覧・ロードマップ・設計網羅度・実装ログ（SoT）** |
| `docs/00_Meta/design-index.md` | 設計ドキュメント索引 |
| `docs/01_Architecture/tauri-ipc-interface.md` | Tauri コマンド型定義（新規追加前に先に記入）|

設計書が存在する機能は必ず設計書を読んでから実装する。
