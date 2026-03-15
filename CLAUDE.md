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

以下の機能は明確に対象外。タスクで依頼されても実装しない。

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
  - 刺さった → 署名・Notarization 整備、自動リリース整備
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

## 🚀 セッション開始プロトコル（毎回必ず実行）

Claude Code はセッション開始時に以下を**必ず**実行してください。

### ステップ1: 現在地の確認
```
docs/00_Meta/feature-list.md を読み込む
→ 最も番号の小さい Phase で、未完了（❌）の項目を探す
→ その項目が「今セッションで実装するタスク」
```

### ステップ2: 設計書の確認
```
feature-list.md のタスクに紐づく設計ドキュメントを読む
（例: タブ機能なら window-tab-session-design.md を参照）
設計書の仕様通りに実装する。設計書にない仕様は勝手に追加しない。
```

### ステップ3: 実装
```
タスクを実装する。
1タスク = 1コミット を原則とする。
コミットメッセージ形式: feat(phase-N): <タスク名>
例: feat(phase-1): タブバーUI（開く・閉じる・切り替え）
```

### ステップ4: チェックオフ
```
実装完了後、docs/00_Meta/feature-list.md の該当行を更新する。
実装列を ❌ → ✅ に変更する。
その後コミットに含める。
```

### ステップ5: 次タスクへ
```
コンテキスト残量が十分なら次の ❌ タスクに進む。
不十分なら「次回: <次のタスク名>」とユーザーに伝えてセッションを終了する。
```

### ⚠️ プロトコル上の禁止事項
- ロードマップにない機能を勝手に実装しない
- 1セッションで複数フェーズをまたがない（Phase 1 が完了するまで Phase 2 に進まない）
- 設計書（docs/）の内容と矛盾する実装をしない
- Won't do リストの機能を実装しない

---

## 基本アーキテクチャ
- **フロントエンド:** React, Vite, TypeScript, TipTap, Tailwind CSS (または任意のCSS設計)
- **バックエンド:** Tauri 2.0, Rust
- **データ管理:** Zustand (クライアント状態), SQLite (メタデータ), ローカルファイルシステムがSingle Source of Truth

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
   - YAML Front Matter (CodeMirror) と本文 (TipTap) の Undo/Redo 履歴は、Phase 1では「独立しているもの」として扱い、無理に統合しようとしないでください。

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

## 📐 設計書・ロードマップの読み方

| ファイル | 役割 |
|---------|------|
| `docs/00_Meta/feature-list.md` | **総合機能一覧・ロードマップ・設計網羅度・実装ログ（SoT）**。✅ = 実装済み、❌ = 未実装 |
| `docs/00_Meta/design-index.md` | 設計ドキュメント索引。どのファイルに何が書いてあるか |
| `docs/01_Architecture/tauri-ipc-interface.md` | Tauri コマンド型定義の SoT。新規コマンド追加前に先に記入 |

**設計書が存在する機能は必ず設計書を読んでから実装する。**
設計書の参照先は `feature-list.md` の各セクション内に記載されている。

---

## 🍔 メニューバー実装ルール（機能追加時の必須フロー）

ユーザーがメニューから操作できない機能は、発見性が低く直感的でない。
**新しい機能を実装する際は、必ずメニューバーへの追加を検討すること。**

### メニュー追加が必要なケース
- ダイアログやパネルを開く機能（エクスポート、設定、検索など）
- モードの切り替え（エディタモード、フォーカスモード、Zen モードなど）
- ファイル操作（新規、開く、保存、変換など）
- 表示の切り替え（サイドバー、パネル、ズームなど）

### メニュー追加フロー（4 ステップ）

```
1. docs/03_UI_UX/menu-inventory.md を更新
   → 該当メニューカテゴリに行を追加（ID・ショートカット・feature-list対応を記入）

2. Rust 側: src-tauri/src/menu/native_menu.rs
   → mod ids に ID 定数を追加
   → build_menu() にメニューアイテムを追加

3. フロントエンド側:
   → src/hooks/useMenuListener.ts の MenuActions に型を追加
   → src/components/layout/AppShell.tsx のハンドラを追加
   → エディタ内機能の場合は TipTapEditor.tsx にカスタムイベントリスナーを追加

4. docs/00_Meta/feature-list.md の「使い方」列に「メニュー → ...」パスを記載
```

### SoT（Single Source of Truth）
| ドキュメント | 役割 |
|---|---|
| `docs/03_UI_UX/menu-inventory.md` | **メニュー項目の一覧と実装状況（SoT）** |
| `src-tauri/src/menu/native_menu.rs` | Rust 側のメニュー定義 |
| `src/hooks/useMenuListener.ts` | フロントエンド側のメニューイベントハンドラ型定義 |

### ⚠️ 禁止事項
- ショートカットキーのみで操作可能な機能を作らない（必ずメニューからもアクセス可能にする）
- `menu-inventory.md` を更新せずにメニュー項目を追加しない

---

## テスト自動化ルール

### コード変更後の必須手順
- markdown-to-tiptap.ts または tiptap-to-markdown.ts を変更した場合:
  `npm run test:roundtrip` を実行し、全テストが通ることを確認する
- src-tauri/ 以下を変更した場合:
  `cd src-tauri && cargo test` を実行する
- コンポーネント変更でUIに影響する場合:
  `npm run test` を実行する

### テスト追加基準
- 新しいMarkdown記法のサポートを追加したら roundtrip テストケースを追加する
- Rust コマンドを追加したら対応するユニットテストを src-tauri/src/ 内に書く

### MCPツールの使い方（Claude Code用）
- テスト実行: run_tests ツールを使う
- 変換品質確認: roundtrip_check ツールに Markdown 文字列を渡す
- 回帰確認: run_roundtrip_regression ツールを使う

---

## マニュアル参照ポリシー
- マニュアル関連作業では、必ず `docs/manual/manual-authoring-rules.md` を参照する
- 詳細手順の追記・更新は `docs/manual/manual-authoring-rules.md` をSoTとして行い、このファイルには重複記載しない

---

## マニュアル生成ルール
- ルール本体は `docs/manual/manual-authoring-rules.md` を参照する
- UIの操作手順を変更したら該当するシナリオファイルを更新する
- `npm run manual:capture` で撮影し直す
- 撮影後に generate_manual ツールでHTML/Markdownを再生成する

---

## マニュアル自動更新ルール

詳細ルール: `docs/manual/manual-authoring-rules.md`

### 機能追加・変更時の必須手順
UIに影響する変更をした場合、コード修正と同じセッションで以下を実施すること：
1. 該当するシナリオYAMLが存在するか確認する
   （存在しない場合は新規作成する）
2. selectorが現在のDOMと一致しているか確認する
3. npm run manual:capture で再撮影する
4. HTML版を再生成する

### シナリオYAMLが存在しない場合の作成手順
1. feature-list.md で該当機能の概要を確認する
2. 実際にPlaywrightで要素のselectorを確認する
3. docs/manual-scenarios/{機能名}.yaml を生成する
4. 撮影・HTML生成まで完了させる

### 対象外（マニュアル更新不要）
- Rust内部ロジックのみの変更
- テストコードの変更
- スタイル（CSS）の微調整
