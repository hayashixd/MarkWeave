# Typora-Inspired WYSIWYG Markdown Editor 開発ルール

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

## マニュアル生成ルール
- UIの操作手順を変更したら該当するシナリオファイルを更新する
- `npm run manual:capture` で撮影し直す
- 撮影後に generate_manual ツールでHTML/Markdownを再生成する

---

## マニュアル自動更新ルール

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