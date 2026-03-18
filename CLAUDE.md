# MarkWeave 開発ルール

---

## 🎯 プロダクト戦略（実装判断の前に必ず確認）

### ポジショニング

> **"Write. Polish. Publish. — Webで文章を書いて公開する人のための、ローカルファーストWYSIWYGエディタ"**

Typora のような書き心地 × プラットフォーム向け公開ワークフロー × ローカルファースト。
この3点が MarkWeave の軸。これ以外の機能追加は原則しない。

### ターゲットユーザー

**v1（現在の開発対象）:**
Markdownで技術記事・ブログ記事を書いて、Zenn / Qiita / dev.to / Hashnode に公開するエンジニア・テクニカルライター。

- Markdown を知っている（教育コスト不要）
- WYSIWYG で書きたい
- コードブロック・図表・数式を扱う
- ローカルにファイルを持ちたい
- ツールに $20〜$30 を払える

**v1.5 以降（Ghost API 連携が整ったあと）:**
Ghost / Substack / note.mu で発信する人（HTML公開ワークフローが必要な層）。

### ビジネスモデル

- **個人趣味開発。運用コストゼロが必須条件。**
- 買い切り $24.99（予定）、3デバイスまで。サブスクなし。
- クラウド同期なし（iCloud / Dropbox / OneDrive に委ねる）。
- AI機能は BYOK（ユーザーが自分の Claude API キーを設定して使う）。

### 対応プラットフォーム

| OS | v1 | 理由 |
|----|-----|------|
| Windows | ✅ | 開発・動作確認可能 |
| Linux | ✅ | 開発・動作確認可能 |
| macOS | ❌（後回し） | **開発者がMacを所持していないため動作確認不可** |

macOS 向けのコードを書くことは禁止しないが、動作確認ができない実装を進めないこと。

---

## 🚫 やらないこと（Won't do）

以下の機能は明確に対象外。依頼されても実装しない。

| 機能 | 理由 |
|------|------|
| クラウド同期 | 運用コスト発生。OS ファイル同期で代替可能 |
| リアルタイム共同編集 | サーバーインフラが必要 |
| 画像アノテーション機能の拡充 | 独立ツール級の実装量。本筋と無関係 |
| PKM グラフビューの改善 | コンテンツ公開ワークフローと無関係 |
| Git パネルの改善 | v1 ターゲットユーザーには不要 |
| AI サービスの自前提供 | API コストが発生。BYOK で提供 |
| macOS 専用機能の実装 | 動作確認不可 |

---

## 🗂️ 機能の UI 配置方針

### デフォルト UI に表示する（初見ユーザーが3秒で意味を理解できるもの）

- WYSIWYG エディタ本体
- アウトラインパネル（サイドバー唯一のデフォルト表示タブ）
- エクスポート（HTML / PDF / Word / EPUB / Markdown）
- 検索・置換
- ファイルツリー（ワークスペース使用時）
- Zen モード / フォーカスモード / タイプライターモード
- ポモドーロ / ワードスプリント
- 文書統計（文字数・読了時間・可読性スコア）
- テーマ切り替え

### 設定から有効化する形に移動（デフォルト非表示）

- Git パネル・ガター差分インジケーター
- Wikiリンク・バックリンクパネル
- グラフビュー
- SQLite メタデータクエリブロック
- Markdown Lint パネル
- RTICCO 構造診断（AI パネル）
- HTML メタデータ編集パネル（JS / CSS リンク管理）
- AI アシスト（BYOK 設定完了後のみ有効）

### 長期的に削除を検討（保守コスト > 価値）

- 画像アノテーション（`ImageAnnotation/` コンポーネント）
- D3.js グラフビュー

---

## 🛣️ 実行ロードマップ

機能追加より先に以下の順序で進める。

```
Week 1-2: デフォルト UI 整理
  - サイドバーをアウトラインのみのデフォルト表示に変更
  - Git / PKM / SQLite タブをデフォルト非表示に変更
  - 初回起動体験の確認（空白エディタ → 書く → 書き出す）

Week 3: 訴求の言語化
  - README / LP 文言を確定（更新済み）
  - Zenn 記事の下書き（"個人でMarkdownエディタを作った話"）

Week 4: Windows + Linux の beta 配布
  - GitHub Actions で .msi / .AppImage 自動ビルド
  - GitHub Releases に公開（署名なしで可。SmartScreen 警告は許容）

Month 2: 反応を見て判断
  - Zenn 記事投稿 → フィードバック収集
  - 刺さった → 署名整備、自動リリース整備
  - 刺さらなかった → 訴求か機能どちらがズレているか分析

Month 2-3: 差別化機能を積む（刺さった場合）
  - Zenn / Qiita 向け Markdown エクスポート最適化
  - note.mu / Ghost 向け HTML テンプレート整備
  - Ghost Admin API 連携（v1.5 への布石）

後回し:
  - macOS 対応（Mac 入手後）
  - Windows Authenticode 署名（正式販売時）
```

---



## 基本アーキテクチャ

- **フロントエンド:** React, Vite, TypeScript, TipTap, Tailwind CSS
- **バックエンド:** Tauri 2.0, Rust
- **データ管理:** Zustand (クライアント状態), SQLite (メタデータ), ローカルファイルシステムが Single Source of Truth

---

## ⚠️ 実装時の厳格な制約（エッジケース対策）



1. **IME対応（最重要）:**

   - 日本語入力（IME）を前提としています。

   - `onKeyDown` や TipTap のトランザクション処理、特に「スラッシュコマンド」や「Markdown自動変換（InputRules）」において、**必ず `isComposing` (IME入力中) を判定**し、変換中のEnterキーで誤爆しないようにガードを入れてください。



2. **ファイル競合と状態管理:**

   - 「未保存（Dirty）のファイル」が外部プロセス（GitやDropbox等）で変更された場合、**絶対に自動でリロードして上書き破棄しない**こと。必ずユーザーに「エディタの内容を保持するか、ディスクから再読み込みするか」の選択肢を提示する設計にしてください。



3. **巨大ファイルとパフォーマンス:**

   - パフォーマンスバジェット（入力レイテンシ < 16ms）を厳守してください。

   - ファイル保存（Tauri API呼び出し）は必ずデバウンス処理し、UIスレッドをブロックしないこと。



4. **エクスポート機能:**

   - 「スタンドアロンHTML出力」を実装する際、ローカルの画像ファイルはリンク切れを防ぐため、Rust側で読み込んで Base64 (Data URI) にエンコードして `<img>` タグに埋め込んでください。



5. **履歴管理 (Undo/Redo):**
   - YAML Front Matter (CodeMirror) と本文 (TipTap) の Undo/Redo 履歴は「独立しているもの」として扱い、無理に統合しようとしないでください。



---



## 🏎️ パフォーマンス設計原則（大規模ファイル対応）



200KB 以上の Markdown ファイルを日常的に扱うユーザーを想定している。
以下の原則を**すべての修正・機能追加**で遵守すること。



### 原則 1: Zustand セレクターは必ず細粒度にする



`useTabStore()` のようにセレクター無しで呼び出すと、ストア内の**あらゆる値の変更**でコンポーネントが再レンダリングされる。

```typescript
// ❌ 禁止: ストア全体を購読
const { tabs, activeTabId, addTab } = useTabStore();



// ✅ 必須: 必要なフィールド・アクションのみを個別に購読

const activeTabId = useTabStore((s) => s.activeTabId);

const addTab = useTabStore((s) => s.addTab);



// ✅ content を含む配列は shallow 等価関数で content 変更を除外
const allTabs = useTabStore((s) => s.tabs, tabsShallowEqual);

```



- `tab.content`（数百 KB になりうる文字列）を props として渡さない。マウント時に `useTabStore.getState()` で直接読む。
- `StatusBar` 等のグローバル UI は `fileName`, `isDirty` 等の必要な値のみ購読する。

### 原則 2: ProseMirror プラグインの `view()` は DOM 未接続を前提にする



TipTap の `useEditor()` は React の DOM マウント前に EditorView を作成する場合がある。DOM 要素を検出する場合は**遅延検出（リトライ付き）**を実装すること。

```typescript
// ❌ 禁止: 1回だけ検出して諦める
view(editorView) {

  const container = editorView.dom.closest('.editor-scroll-container');
}



// ✅ 必須: isConnected を確認し、未接続なら定期リトライ
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



- **50KB 超**: `requestAnimationFrame` で UI ペイント後に遅延実行する
- **3MB 超**: ソースモードに自動切替し、WYSIWYG パースを回避する
- **3000 ノード超**: パース後にノード数チェックしソースモードへフォールバック

### 原則 4: VirtualScrollExtension の不変条件



1. スクロールコンテナが検出されていること（`findScrollContainer` が非 null を返す）

2. `docChanged` 後に必ずビューポート再計算がスケジュールされること

3. 高さキャッシュが `docChanged` 時にクリアされ、スクロール停止時に実測値で更新されること

### 原則 5: `lastEmittedContentRef` パターン



`initialContent` → エディタ → `onContentChange` → ストア → `initialContent` の循環防止。

- `null`（sentinel）で初期化する。`initialContent` で初期化すると初回ロードがスキップされる。
- `emitMarkdown()` で設定し、`useEffect` で比較。同一参照なら再注入をスキップする。

---



## 📐 設計書の参照先

実装前に関連する設計書を必ず読むこと。設計書にない仕様は勝手に追加しない。

| ファイル | 役割 |

|---------|------|
| `docs/00_Meta/design-index.md` | 設計ドキュメント索引（どのファイルに何が書いてあるか） |
| `docs/01_Architecture/tauri-ipc-interface.md` | Tauri コマンド型定義の SoT。新規コマンド追加前に先に記入 |



---



## 🍔 メニューバー実装ルール

新しい機能を実装する際は、必ずメニューバーへの追加を検討すること。

### メニュー追加フロー

```

1. docs/03_UI_UX/menu-inventory.md を更新
   → 該当メニューカテゴリに行を追加



2. Rust 側: src-tauri/src/menu/native_menu.rs

   → mod ids に ID 定数を追加

   → build_menu() にメニューアイテムを追加



3. フロントエンド側:

   → src/hooks/useMenuListener.ts の MenuActions に型を追加

   → src/components/layout/AppShell.tsx のハンドラを追加

   → エディタ内機能の場合は TipTapEditor.tsx にカスタムイベントリスナーを追加
```

- ショートカットキーのみで操作可能な機能を作らない（必ずメニューからもアクセス可能にする）

- `menu-inventory.md` を更新せずにメニュー項目を追加しない



---



## テスト自動化ルール



| 変更箇所 | 実行するコマンド |
|---------|----------------|
| `markdown-to-tiptap.ts` / `tiptap-to-markdown.ts` | `npm run test:roundtrip` |
| `src-tauri/` 以下 | `cd src-tauri && cargo test` |
| UI コンポーネント | `npm run test` |

- 新しい Markdown 記法を追加したら roundtrip テストケースを追加する
- Rust コマンドを追加したら対応するユニットテストを書く

---

## マニュアル更新ルール

UI に影響する変更をした場合は `docs/manual/manual-authoring-rules.md` を参照して対応すること。

---

## 🚀 リリース前チェックリスト（必須）

**タグをプッシュする前に、ローカルで以下をすべて通過させること。**
GitHub Actions でのビルド失敗はリリースを止めるため、事前確認を徹底する。

### 1. TypeScript 型チェック
```bash
pnpm build
```
- `tsc -b` と `vite build` が両方エラーなしで完了すること
- テストファイルが型エラーを起こしていないことも確認される

### 2. フロントエンドテスト + カバレッジ閾値確認
```bash
pnpm test:coverage
```
- すべてのテストが PASS すること
- カバレッジ閾値（branches 78% / statements 50% 等）を下回らないこと
- 性能テスト（`large-file-threshold`, `virtual-scroll-perf`）はカバレッジ計測の影響を受けるため除外される。性能のみ確認したい場合は別途 `pnpm test:perf` を実行すること

### 3. 依存パッケージのセキュリティ確認
```bash
pnpm audit
```
- 既知の脆弱性がないこと（`No known vulnerabilities found`）

### 4. Rust ビルド・テスト
```bash
cd src-tauri && cargo build && cargo test
```
- コンパイルエラーがないこと
- ユニットテストがすべて通ること

### 5. バージョン番号の一致確認
以下の3ファイルのバージョンが一致していること：

| ファイル | 確認箇所 |
|---------|---------|
| `package.json` | `"version"` |
| `src-tauri/Cargo.toml` | `version =` |
| `src-tauri/tauri.conf.json` | `"version"` |

### 6. タグ・プッシュ

**Claude Code にリリースを依頼する場合（推奨）:**

「vX.Y.Z をリリースして」と依頼すると、Claude Code が以下を自動で実行する：

1. `git log <前タグ>..HEAD` から変更点を収集・整形してユーザーに提示
2. 確認後、バージョンファイル3点を更新してコミット
3. アノテーション付きタグに変更点を埋め込んで作成
4. `git push origin main && git push origin vX.Y.Z` を実行
5. GitHub Actions がビルド→リリース作成（タグ本文がリリースノートになる）→SHA256チェックサム追記

**手動で行う場合:**
```bash
# バージョンコミット
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: bump version to vX.Y.Z"

# アノテーション付きタグで変更点を埋め込む（-m に変更点を記述）
git tag -a vX.Y.Z -m "## 変更点

- feat: ...
- fix: ..."

git push origin main
git push origin vX.Y.Z
```

---

## 🤖 エージェント活用方針

`~/.claude/agents/` に専門エージェントが配置されている（agency-agents より導入済み）。

- ユーザーが明示しなくても、タスクの内容に応じて最適なエージェントを自動選択すること
- 単純なファイル編集・検索は直接処理する（エージェント委譲は不要）
- 複雑・多ステップ・専門ドメインのタスクには積極的に専門エージェントを活用する

| タスク例 | 使用エージェント |
|---------|----------------|
| コードレビュー | `Code Reviewer` |
| セキュリティ調査 | `Security Engineer` |
| テスト作成・分析 | `API Tester` / `Test Results Analyzer` |
| システム設計 | `Software Architect` / `Backend Architect` |
| ドキュメント作成 | `Technical Writer` |
| パフォーマンス改善 | `Performance Benchmarker` |
