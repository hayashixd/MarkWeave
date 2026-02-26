# Undo/Redo 粒度設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> 対象: TipTap (ProseMirror ラッパー) を使った Undo/Redo 設計
> 更新日: 2026-02-24

---

## 0. ProseMirror 履歴プラグインの仕組み（前提知識）

### 0.1 履歴イベント（History Event）

`prosemirror-history` プラグインは、トランザクションを**履歴イベント**単位でグループ化する。
Ctrl+Z 1回 = 履歴イベント1個 を取り消す。

```
[イベントA: "Hel" 入力] → [イベントB: "lo" 入力] → [イベントC: 行追加]
                                                               ↑ 現在
Ctrl+Z → イベントC取り消し
Ctrl+Z → イベントB取り消し
```

### 0.2 グループ化ルール（デフォルト動作）

| 条件 | 動作 |
|------|------|
| 連続した文字入力（間隔 < 500ms） | 同じイベントにまとめられる |
| 間隔が 500ms を超えた入力 | 新しいイベントとして分割 |
| `closeHistory(tr)` 呼び出し | 現在のイベントを強制的に閉じ、次は新イベント |
| `addToHistory: false` メタデータ | そのトランザクションを履歴に記録しない |

### 0.3 主要 API

```typescript
// ProseMirror 低レベル
import { closeHistory } from 'prosemirror-history'

// 現在のヒストリーグループを閉じる（次の操作は必ず別グループになる）
const tr = view.state.tr
closeHistory(tr)
view.dispatch(tr)

// このトランザクションを履歴から除外する
const tr = view.state.tr.setMeta('addToHistory', false)
view.dispatch(tr)

// TipTap からアクセスする場合
editor.commands.command(({ tr }) => {
  closeHistory(tr)
  return true
})
```

### 0.4 `closeHistory` vs `addToHistory: false` の使い分け

| API | 用途 |
|-----|------|
| `closeHistory(tr)` | 操作はUndoable、だが次の操作と**別グループ**にしたい |
| `addToHistory: false` | この操作自体をUndo履歴に**一切記録しない** |

---

## 1. ケース1: ブロック内テキスト編集

### シナリオ

```
「# Hello World」ブロックをクリック（フォーカス）
→ 「World」を「Earth」に変更
→ 別の場所をクリック（デフォーカス）
→ Ctrl+Z
```

### 推奨動作: 「Earth」→「World」に戻る（字句レベルのUndo）

「Hello World」全体が消えるのはユーザーの意図に反する。
ブロック全体ではなく、**そのセッション内の編集内容だけ**を取り消すべき。

#### なぜ全消えしてはいけないか

- Typora のUXコンセプト：フォーカス≠コミット。編集内容の取り消し単位は文字・単語レベル
- 「クリックしてフォーカスした」という行為自体は Undo すべきではない

### UX 詳細

| 操作 | Ctrl+Z の結果 |
|------|-------------|
| 「Earth」と入力した直後 | 「Earth」→「World」（文字単位または単語単位）|
| 「Earth」入力→別の場所クリック→Ctrl+Z | 同上（デフォーカスはUndo境界になる） |
| さらに Ctrl+Z | 「World」が消える（その前の編集へ）|

### ProseMirror での実装方針

```
フォーカス時:
  → React state（またはデコレーション）を更新 ← ProseMirror 履歴に影響しない
  → もしドキュメント変更を伴う場合は addToHistory: false で記録しない

テキスト入力:
  → ProseMirror が通常のトランザクションとして記録（デフォルト動作）
  → 500ms 以内の入力は自動的に同グループになる

デフォーカス時:
  → closeHistory(tr) を呼んでヒストリーグループを明示的に閉じる
  → レンダリングへの切り替え（デコレーション更新）は addToHistory: false
```

### TipTap 実装例

```typescript
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { closeHistory } from 'prosemirror-history'

/**
 * Typora フォーカスモデル用プラグイン
 * ブロック編集の開始・終了時に適切な履歴境界を設ける
 */
const TyporaFocusPlugin = Extension.create({
  name: 'typoraFocus',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('typoraFocus'),
        props: {
          handleDOMEvents: {
            // デフォーカス時: 現在の編集セッションをヒストリーグループとして確定
            blur: (view) => {
              const { tr } = view.state
              closeHistory(tr)
              // レンダリングモードへの切替（デコレーション等）を伴う場合
              tr.setMeta('addToHistory', false)
              view.dispatch(tr)
              return false // イベントを横取りしない
            },

            // フォーカス時: 前の操作と今回の編集を分離
            focus: (view) => {
              const { tr } = view.state
              // フォーカス時の状態変更（デコレーション更新等）を履歴から除外
              tr.setMeta('addToHistory', false)
              view.dispatch(tr)
              return false
            },
          },
        },
      }),
    ]
  },
})
```

#### 「どのブロックがフォーカスされているか」の管理

```typescript
// ブロックのフォーカス状態はデコレーションで管理する（ドキュメント変更なし）
import { Decoration, DecorationSet } from 'prosemirror-view'

const focusDecoration = Decoration.node(pos, pos + node.nodeSize, {
  class: 'is-editing', // このクラスでソース表示に切り替え
})
// → DecorationSet を更新するトランザクションに addToHistory: false を設定
```

---

## 2. ケース2: テーブル操作

### シナリオ

```
テーブルに行を 3 回追加 → Ctrl+Z
```

### 推奨動作: 1 行ずつ取り消す（1 Ctrl+Z = 1 行削除）

構造的操作（行の追加・削除・移動）は1操作＝1Undoステップが自然。
ユーザーは「さっき追加した行だけ消したい」という意図を持ちやすい。

#### まとめて取り消すべきケース

「3行を一括追加」するダイアログ・コマンドが存在する場合のみ、3行を1ステップにする。
ボタンを3回クリックした場合は必ず別ステップにする。

### UX 詳細

| 操作方法 | Undo 動作 |
|---------|----------|
| 「行を追加」ボタンを3回クリック | 1回ずつ Ctrl+Z で 1行ずつ削除 |
| 「3行追加」の一括コマンド | Ctrl+Z 1回で 3行まとめて削除 |
| Tab キーで末尾行から新行追加（3回） | 1行ずつ |

### ProseMirror での実装方針

```
各「行追加」ボタンクリック:
  → 個別のトランザクション（dispatch）として実行
  → 自動的に別履歴イベントになる（closeHistory 不要）

一括追加コマンド:
  → editor.chain().addRowAfter().addRowAfter().addRowAfter().run()
  → chain() はすべてのコマンドを1トランザクションにまとめる
  → Ctrl+Z 1回で 3行まとめて取り消し
```

### TipTap 実装例

```typescript
// ケース A: 個別追加（1クリック = 1 Undo ステップ）
// ボタンのクリックハンドラ
function handleAddRow() {
  editor.commands.addRowAfter()
  // addRowAfter() は内部で個別のトランザクションを dispatch する
  // → 自動的に別履歴イベントになる
}

// ケース B: 一括追加（N行まとめて = 1 Undo ステップ）
function handleAddMultipleRows(count: number) {
  const chain = editor.chain()
  for (let i = 0; i < count; i++) {
    chain.addRowAfter()
  }
  chain.run()
  // chain.run() は全コマンドを1トランザクションにまとめる
}

// ケース C: ドラッグ&ドロップによる行移動も1ステップにする
function handleRowDrop(fromIndex: number, toIndex: number) {
  editor.commands.command(({ tr, state }) => {
    // 移動元の行削除と移動先への挿入を同一トランザクションで実行
    const tableNode = findTable(state)
    moveRow(tr, tableNode, fromIndex, toIndex)
    return true
  })
}
```

### 注意: Table の Undo と ProseMirror スキーマ

ProseMirror のテーブル操作（`prosemirror-tables`）はデフォルトで各コマンドが
独立したトランザクションなので、明示的な制御なしに1操作=1Undoステップになる。

```typescript
// @tiptap/extension-table の内部（参考）
addCommands() {
  return {
    addRowAfter: () => ({ state, dispatch }) => {
      if (!isInTable(state)) return false
      if (dispatch) {
        // dispatch() を1回呼ぶ = 1トランザクション = 1 Undo ステップ
        dispatch(addRow(state.tr, { after: true }))
      }
      return true
    },
  }
}
```

---

## 3. ケース3: ブロックタイプ変更（Input Rule）

### シナリオ

```
入力ルールで「## 」を入力して H2 に変換 → Ctrl+Z
```

### 推奨動作: H2 → 段落（p）に戻り「## 」テキストが復元される

ユーザーが入力した「## 」は消えたのではなく変換されただけなので、
Undo で変換前の状態（「## 」テキストが段落内にある状態）に戻るのが自然。

これは VS Code、Notion、Obsidian など主要エディタと同じ動作。

#### さらに Ctrl+Z を押した場合

```
「## 」テキスト復元
→ Ctrl+Z → 「#」「#」「 」と1文字ずつ消える（または一括消える）
→ Ctrl+Z → 空の段落に戻る
```

### ProseMirror での仕組み

ProseMirror の InputRule は内部で `closeHistory` を使って適切に境界を設けている:

```
ユーザーが "#", "#", " " と入力:
  [ヒストリーイベント A: "##" の文字入力]

" " 入力で Input Rule が発火:
  [ヒストリーイベント B: 変換トランザクション]
    - "## " テキストを削除
    - ブロックタイプを Heading2 に変換
    ← この TR に closeHistory が設定済み

Ctrl+Z → イベント B を取り消し → "## " テキストが段落として復元
Ctrl+Z → イベント A を取り消し → 文字が消える
```

### TipTap 実装例

```typescript
import { textblockTypeInputRule } from '@tiptap/core'

// TipTap の Heading extension（標準実装）
const Heading = Node.create({
  name: 'heading',

  addInputRules() {
    return this.options.levels.map(level =>
      // textblockTypeInputRule は ProseMirror の InputRule をラップ
      // closeHistory の処理は内部で自動的に行われる
      textblockTypeInputRule({
        find: new RegExp(`^(#{1,${level}})\\s$`),
        type: this.type,
        getAttributes: match => ({ level: match[1].length }),
      })
    )
  },
})
```

### カスタム Input Rule で closeHistory を使う場合

```typescript
import { InputRule } from '@tiptap/core'
import { closeHistory } from 'prosemirror-history'

// 独自ルール: 「> 」でブロック引用に変換
const blockquoteInputRule = new InputRule({
  find: /^>\s$/,
  handler({ state, range, tr }) {
    const { $from } = state.selection

    // 1. マッチしたテキスト（"> "）を削除
    tr.delete(range.from, range.to)

    // 2. ブロックタイプを変換
    tr.setBlockType($from.before(), $from.after(), state.schema.nodes.blockquote)

    // 3. 現在のヒストリーグループを閉じる（標準 Input Rule の動作に準拠）
    closeHistory(tr)
  },
})
```

---

---

## 3.5 ケース4: 複数段落選択削除時の Undo 粒度

### シナリオ

```
段落A・段落B・段落C の3段落をまとめて選択 → Delete キー → Ctrl+Z
```

### 推奨動作: 1回の Ctrl+Z でA・B・C が全て復元される

複数段落を「1操作」として削除したのだから、Undo も1ステップで全復元すべき。
「3回 Ctrl+Z で1段落ずつ」は Undo の操作コストが不当に高い。

### ProseMirror の動作（デフォルト）

ProseMirror は **Delete/Backspace キーを1回押す = 1トランザクション** として記録する。
選択範囲に複数ノードが含まれていても、削除は1トランザクションになる。

```
[A][B][C] → 全選択 → Delete
  → ProseMirror: replaceSelection('') を1トランザクションで実行
  → 1つの Undo エントリとして記録
  → Ctrl+Z で [A][B][C] が同時に復元 ✅
```

**カスタム実装は不要**。ProseMirror のデフォルト動作が正しく機能する。

### 注意: ドラッグ＆ドロップは別トランザクション

複数段落をドラッグして移動する場合:
- **削除**（元位置）と**挿入**（新位置）が別トランザクションになることがある
- この場合、Ctrl+Z を1回押すと「挿入が消える」→ 2回押すと「削除が復元される」
- Typora も同様の動作のため、許容範囲内とする

---

## 3.6 ケース5: テキスト入力の Undo 粒度（newGroupDelay と単語境界）

### 「1文字 vs 1単語」の実際の動作

ProseMirror の履歴グループ化は **時間ベース**であり、単語境界ベースではない。

```
newGroupDelay = 500ms （推奨設定）の場合:

「Hello」を 400ms 以内に素早くタイプ
  → 5文字が1グループ → Ctrl+Z で「Hello」全体が一度に消える

「Hello」の後で 600ms 待ってから「World」をタイプ
  → 「Hello」と「World」が別グループ → Ctrl+Z を2回必要

Ctrl+Backspace（単語削除）
  → 1キー操作 = 1トランザクション = 1 Undo ステップ
  → 「World」全体が1回の Ctrl+Z で復元される
```

### Typora との比較

Typora（Electron + CodeMirror 5）は **Undo スタックを独自管理**しており、
「スペース・句読点でグループを区切る」単語ベースの Undo を実装している。
ProseMirror のタイムベース方式は Typora と異なるが、VS Code 等と同じ動作であるため、
**ProseMirror のデフォルトを採用し、Typora との完全一致は求めない**。

```typescript
// 推奨設定（undo-redo-design.md 5.1 参照）
history: {
  depth: 100,
  newGroupDelay: 500, // 500ms 以内の連続入力は1グループ
}

// より Typora に近づけたい場合の代替設定（要テスト）
history: {
  depth: 200,
  newGroupDelay: 300, // 短くすると「細かい Undo」になる
}
```

### 実測値に基づく推奨

| newGroupDelay | ユーザー体験 | 適用ケース |
|---|---|---|
| 200ms | とても細かい（1〜2文字単位） | コード編集向け |
| 500ms ← **採用** | 標準（1〜3単語程度） | 文章執筆向け |
| 750ms | おおまか（1文〜） | 長文入力向け |

---

## 3.7 ケース6: 自動保存デバウンスと closeHistory のタイミング

### 問題

自動保存デバウンス（500ms〜1000ms）と `closeHistory` の呼び出しタイミングが競合すると、
意図しない Undo グループ境界が発生する可能性がある。

```
タイムライン例（問題ケース）:
  t=0    : ユーザーが "Hello" とタイプ → トランザクション1
  t=450  : 自動保存デバウンスが closeHistory を呼ぶ（← 問題）
  t=500  : ユーザーが " World" をタイプ → トランザクション2
  t=800  : ユーザーが blur → TyporaFocusPlugin が closeHistory を呼ぶ

  Ctrl+Z を押すと:
    → "World" が消える（ここまでは正しい）
    → 再度 Ctrl+Z で "Hello" が消える（正しい）
    ※ 自動保存による closeHistory が余分な境界を作っていた場合、
      " World" と "Hello" が分割されるが、これは許容範囲内とする
```

### 設計方針: 自動保存では closeHistory を呼ばない

```typescript
// src/file/auto-save.ts

/**
 * 自動保存はドキュメントの「シリアライズとファイル書き込み」のみ行う。
 * closeHistory は呼ばない（Undo 粒度に影響させない）。
 * closeHistory は blur イベント（TyporaFocusPlugin）に委任する。
 */
export function scheduleSave(
  editor: Editor,
  filePath: string,
  debouncedSave: (md: string) => void,
): void {
  // IME composition 中はスキップ（markdown-tiptap-conversion.md §9 参照）
  if (isComposing) return;

  const md = tiptapToMarkdown(editor.getJSON());
  debouncedSave(md); // 500ms〜1000ms のデバウンス（ファイル書き込みのみ）

  // ❌ 以下はやってはいけない:
  // const { tr } = editor.state;
  // closeHistory(tr);
  // editor.view.dispatch(tr);
}
```

### エッジケース: アプリ強制終了前の保存

アプリ終了前の「即時保存」でも `closeHistory` は呼ばない。
終了後は履歴は消えるため、境界設定は意味がない。

```typescript
// src-tauri/src/main.rs のウィンドウクローズハンドラから呼ばれる
// → フロントエンドで tiptapToMarkdown() → ファイル書き込みのみ実行
```

---

## 3.8 ケース7: スプリットエディタ（同一ファイル分割）の Undo クロスペイン問題

### 問題

`split-editor-design.md §10` の設計では、同一ファイルを2ペインで開く場合に
**単一の EditorState を共有する**（active/mirror パターン）。
この設計では、ペインBで行った編集に対してペインAで Ctrl+Z を押すと、
**画面外（ペインB）の変更が取り消される**。

```
[ペインA] Hello World|               [ペインB] Hello World
                                              ↓ "World" → "Earth" に編集
[ペインA] (画面は変わらない)         [ペインB] Hello Earth

ペインAで Ctrl+Z:
  → EditorState がロールバック
  → ペインAのビューポート内では何も変わらないように見えるが...
  → ペインBの "Earth" が "World" に戻る（ユーザーには見えない）
```

### 設計決定: クロスペイン Undo はスペックとして受け入れる

単一 EditorState 共有は、同期ずれ・競合回避のための意図的な設計選択であり、
2つの独立した履歴スタックに分割することはしない。

**理由:**
- 独立スタックにすると「どちらの履歴でどの変更を取り消すか」の判断が複雑になる
- 同一ファイルである以上、文書の一貫性は1つの EditorState が保証する

### UX 緩和策: Undo 後の自動スクロール

Ctrl+Z 実行後、変更が発生した位置へ自動スクロールすることで
「どこが変わったか」をユーザーに見せる。

```typescript
// src/core/undo-with-scroll.ts

import { undo } from 'prosemirror-history'
import { EditorView } from 'prosemirror-view'

/**
 * Undo を実行し、変更が発生した最初の位置へスクロールする。
 * スプリットエディタでのクロスペイン Undo の UX 緩和策。
 */
export function undoWithScroll(view: EditorView): boolean {
  const stateBefore = view.state

  // 標準の Undo を実行
  const result = undo(view.state, view.dispatch)
  if (!result) return false

  // Undo 前後のドキュメントを比較して最初の変更位置を探す
  const changedPos = findFirstChangedPosition(
    stateBefore.doc,
    view.state.doc,
  )

  if (changedPos !== null) {
    // DOM ノードへスクロール
    const domNode = view.nodeDOM(changedPos)
    domNode?.scrollIntoView({ behavior: 'smooth', block: 'center' })

    // 変更位置にカーソルを移動（オプション）
    const tr = view.state.tr.setSelection(
      view.state.selection.constructor.near(view.state.doc.resolve(changedPos))
    )
    view.dispatch(tr.setMeta('addToHistory', false))
  }

  return true
}

/**
 * 2つのドキュメントを比較し、最初に差異が生じた位置を返す。
 */
function findFirstChangedPosition(
  docA: ProseMirror.Node,
  docB: ProseMirror.Node,
): number | null {
  const minSize = Math.min(docA.content.size, docB.content.size)
  for (let pos = 0; pos < minSize; pos++) {
    if (!docA.resolve(pos).node().eq(docB.resolve(pos).node())) {
      return pos
    }
  }
  if (docA.content.size !== docB.content.size) {
    return minSize
  }
  return null
}
```

### キーバインド登録

```typescript
// スプリットエディタ用のキーバインドで標準 Undo をラップ
import { keymap } from 'prosemirror-keymap'

const splitEditorKeymap = keymap({
  'Mod-z': (state, dispatch, view) => {
    if (!view) return false
    return undoWithScroll(view)
  },
})
```

### 初回通知トースト

スプリットエディタ利用時に初めて Undo クロスペインが発生した場合、
1回だけ教育的トーストを表示する。

```typescript
// セッション内で1度だけ表示（localStorage で管理）
const CROSS_PANE_UNDO_SHOWN_KEY = 'split_editor_cross_pane_undo_shown'

if (!localStorage.getItem(CROSS_PANE_UNDO_SHOWN_KEY)) {
  showToast('Undo は両方のペインの編集履歴に影響します', { duration: 4000 })
  localStorage.setItem(CROSS_PANE_UNDO_SHOWN_KEY, '1')
}
```

---

## 3.9 ケース8: Front Matter（CodeMirror 6）と TipTap の履歴分断

### 問題

YAML Front Matter は TipTap の NodeView 内に **CodeMirror 6 エディタ** として埋め込まれる
（`editor-ux-design.md §1.2` 参照）。CodeMirror 6 は独自の Undo スタックを持つため、
**TipTap (ProseMirror) の履歴と CodeMirror 6 の履歴は完全に独立している**。

```
操作シナリオ:
  1. Front Matter で "tags: [foo]" → "tags: [foo, bar]" に編集（CodeMirror の履歴に記録）
  2. 本文で "Hello" → "World" に編集（TipTap の履歴に記録）
  3. 本文でフォーカスした状態で Ctrl+Z
     → 「World」→「Hello」に戻る ✅（TipTap の Undo）
  4. 再度 Ctrl+Z
     → 本文の前の編集が取り消される（Front Matter の "bar" は戻らない ❌）

Front Matter にフォーカスして Ctrl+Z:
  → CodeMirror 6 の Undo が実行される（"bar" が消える） ✅
  → TipTap の履歴には影響しない
```

### Phase 1 制約: 履歴スタックは独立のままとする

**Front Matter（CodeMirror 6）と本文（TipTap）の Undo スタックは Phase 1 では統合しない。**

| 観点 | 決定 |
|------|------|
| Front Matter にフォーカス中の Ctrl+Z | CodeMirror 6 の Undo を実行 |
| 本文にフォーカス中の Ctrl+Z | TipTap (ProseMirror) の Undo を実行 |
| 跨いだ Undo（Front Matter → 本文 or 逆） | Phase 1 では未対応 |

**理由:**
- `prosemirror-codemirror` ブリッジによる統合は実装コストが高い
- Front Matter の編集頻度は本文より低く、混在 Undo の需要は限定的
- CodeMirror 6 の独立スタックは「フォーカスが当たっているエディタで Undo」という
  直感的なルールで十分許容範囲内

### UX 緩和策: Front Matter フォーカス時の視覚フィードバック

フォーカスが Front Matter ブロックにある場合、視覚的に明示することで
「今どちらのエディタが Undo を受け取るか」を伝える。

```css
/* Front Matter ブロックがアクティブの場合 */
.front-matter-node.is-cm-focused {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

```typescript
// CodeMirror 6 の focus/blur イベントで TipTap NodeView にクラスを付与
class FrontMatterNodeView implements NodeView {
  private cmView: EditorView  // CodeMirror 6 の EditorView

  constructor(/* ... */) {
    this.cmView = new CMEditorView({
      extensions: [
        // フォーカス状態を外側の DOM に伝える
        CMEditorView.focusChangeEffect.of((state, focusing) => {
          this.dom.classList.toggle('is-cm-focused', focusing)
          return null
        }),
      ],
    })
  }
}
```

### 将来検討 (Phase 7+): 統合 Undo スタック

Phase 7 以降で実装コストが許容できる場合、以下のアプローチを検討する:

- `prosemirror-codemirror` ライブラリによる双方向ブリッジ
- CodeMirror の各編集を ProseMirror トランザクションとして中継し、単一履歴スタックへ統合
- ただし IME・変換処理との相互作用に注意が必要

---

## 4. Typora 式フォーカスモデルと Undo の統合設計

### 4.1 状態遷移図

```
[レンダリング状態]
        |
        | ユーザーがブロックをクリック
        ↓
[ソース編集状態] ←→ テキスト編集（ProseMirror が履歴記録）
        |
        | ユーザーが別の場所をクリック（blur）
        | → closeHistory(tr) でヒストリーグループを閉じる
        ↓
[レンダリング状態]
```

### 4.2 履歴の境界設計

| タイミング | 処理 | 理由 |
|----------|------|------|
| ブロックをクリック（フォーカス） | `addToHistory: false` でデコレーション更新 | フォーカス自体は取り消せるべきでない |
| テキスト入力中 | デフォルト（ProseMirror が自動管理） | 通常の文字入力 |
| 別ブロックへ移動（blur） | `closeHistory(tr)` | 編集セッションを1つのUndo単位として封印 |
| Input Rule 発火 | TipTap が自動で `closeHistory` | 変換前のテキストに戻れるようにする |
| テーブル行/列の操作 | デフォルト（各コマンドが別TR） | 1操作=1Undoステップ |
| プログラム的なノード変換 | `addToHistory: false` | 内部的な状態管理、ユーザー操作でない |

### 4.3 TipTap Extension として実装する場合の全体像

```typescript
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { closeHistory } from 'prosemirror-history'
import { Decoration, DecorationSet } from 'prosemirror-view'

interface TyporaFocusState {
  focusedNodePos: number | null
  decorations: DecorationSet
}

const typoraFocusKey = new PluginKey<TyporaFocusState>('typoraFocus')

export const TyporaFocusExtension = Extension.create({
  name: 'typoraFocus',

  addProseMirrorPlugins() {
    return [
      new Plugin<TyporaFocusState>({
        key: typoraFocusKey,

        state: {
          init() {
            return { focusedNodePos: null, decorations: DecorationSet.empty }
          },
          apply(tr, prev, oldState, newState) {
            // フォーカス変更メタデータを確認
            const focusMeta = tr.getMeta(typoraFocusKey)
            if (!focusMeta) return prev

            const { focusedNodePos } = focusMeta
            if (focusedNodePos === null) {
              return { focusedNodePos: null, decorations: DecorationSet.empty }
            }

            const node = newState.doc.nodeAt(focusedNodePos)
            if (!node) return prev

            const decoration = Decoration.node(
              focusedNodePos,
              focusedNodePos + node.nodeSize,
              { class: 'is-typora-editing' }
            )
            return {
              focusedNodePos,
              decorations: DecorationSet.create(newState.doc, [decoration]),
            }
          },
        },

        props: {
          decorations(state) {
            return typoraFocusKey.getState(state)?.decorations
          },

          handleClick(view, pos) {
            const { tr, doc } = view.state
            const $pos = doc.resolve(pos)
            const blockPos = $pos.before($pos.depth)

            // ① ヒストリーグループを閉じる（前の編集セッションを封印）
            closeHistory(tr)

            // ② フォーカス変更を履歴に記録しない
            tr.setMeta('addToHistory', false)
            tr.setMeta(typoraFocusKey, { focusedNodePos: blockPos })

            view.dispatch(tr)
            return false
          },
        },
      }),
    ]
  },
})
```

---

## 5. History Extension の設定

### 5.1 TipTap での推奨設定

```typescript
import StarterKit from '@tiptap/starter-kit'

const editor = new Editor({
  extensions: [
    StarterKit.configure({
      history: {
        // 最大履歴ステップ数（デフォルト: 100）
        depth: 100,

        // この時間（ms）以内の入力は同じグループにまとめる（デフォルト: 500ms）
        // 文章執筆エディタなので少し長めに設定するとよい
        newGroupDelay: 500,
      },
    }),
    TyporaFocusExtension,
  ],
})
```

### 5.2 History を StarterKit から除外してカスタマイズする場合

```typescript
import { History } from '@tiptap/extension-history'

const editor = new Editor({
  extensions: [
    StarterKit.configure({
      history: false, // StarterKit のデフォルト History を無効化
    }),
    History.configure({
      depth: 200,         // 執筆用途では多めに
      newGroupDelay: 750, // 句読点での自然な区切りを考慮
    }),
    TyporaFocusExtension,
  ],
})
```

---

## 6. 参考: Typist（TipTap ベースエディタ）のパターン

Typist（`@doist/editor` 改め `@tiptap/typist`）は TipTap ベースの本格的エディタで、
以下のパターンを採用している:

### 6.1 プログラム的な変更を履歴から除外

```typescript
// Typist が採用するパターン: コンテンツセット時は履歴に入れない
editor.commands.setContent(content, false) // 第2引数: emitUpdate
// → 内部で addToHistory: false が設定される
```

### 6.2 コラボレーション（Yjs）利用時の注意

Y.js と組み合わせる場合は `prosemirror-history` の代わりに `y-prosemirror` の
`yUndoPlugin` を使う。この場合、API は異なるが `closeHistory` 相当の機能がある:

```typescript
import { yUndoPlugin, undo, redo } from 'y-prosemirror'
// closeHistory 相当: UndoManager.stopCapturing()
```

---

## 7. まとめ: 各ケースの実装チェックリスト

| ケース | 推奨動作 | 実装 |
|--------|---------|------|
| **ケース1** テキスト編集 | 「Earth」→「World」（変更分のみ） | blur 時に `closeHistory(tr)` |
| **ケース2** テーブル行追加×3 | 1行ずつ取り消し | 各コマンドを別 `dispatch()` で実行 |
| **ケース3** Input Rule 変換 | H2 → 段落 + "## " テキスト復元 | TipTap が自動処理（対応不要） |
| **ケース4** 複数段落選択削除 | 1回の Ctrl+Z で全復元 | ProseMirror のデフォルト動作（対応不要） |
| **ケース5** テキスト入力粒度 | 500ms 以内の入力は1グループ | `newGroupDelay: 500` 設定のみ |
| **ケース6** 自動保存 vs closeHistory | 自動保存は closeHistory を呼ばない | 保存はファイル書き込みのみ（blur 時に委任） |
| **ケース7** スプリットエディタ クロスペイン Undo | クロスペイン Undo はスペックとして受け入れ; 変更位置へ自動スクロール | `undoWithScroll()` でラップ; 初回トースト通知 |
| **ケース8** Front Matter / CodeMirror 6 履歴分断 | Phase 1: スタックは独立のまま; フォーカスのあるエディタで Undo | Front Matter フォーカス時のアウトライン強調 |
| フォーカス切替 | Undo の対象外 | `addToHistory: false` |
| レンダリング切替 | Undo の対象外 | `addToHistory: false` |
| プログラム的変換 | Undo の対象外 | `addToHistory: false` |

### 実装優先度

```
高 ① blur 時の closeHistory（ケース1の核心）
高 ② テーブル各操作の個別 dispatch（ケース2）
中 ③ Input Rule は TipTap のデフォルトで動作（ケース3）
中 ④ 自動保存で closeHistory を呼ばない（ケース6）
中 ⑤ スプリットエディタで undoWithScroll() を適用（ケース7）
低 ⑥ History の depth / newGroupDelay チューニング（ケース5）
低 ⑦ ブロックフォーカス状態のデコレーション管理
低 ⑧ Front Matter フォーカスアウトライン表示（ケース8）
```

---

## 8. 参照リソース

- [prosemirror-history ソースコード](https://github.com/prosemirror/prosemirror-history)
- [ProseMirror Guide - History and Undo](https://prosemirror.net/docs/guide/#history)
- [TipTap Extension - History](https://tiptap.dev/docs/editor/extensions/functionality/history)
- [TipTap - Custom Extensions](https://tiptap.dev/docs/editor/extensions/custom-extensions)
- [prosemirror-tables](https://github.com/prosemirror/prosemirror-tables)
- [TipTap - Table Extension](https://tiptap.dev/docs/editor/extensions/nodes/table)
