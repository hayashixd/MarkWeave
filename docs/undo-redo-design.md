# Undo/Redo 粒度設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> 対象: TipTap (ProseMirror ラッパー) を使った Undo/Redo 設計
> 更新日: 2026-02-23

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
| **ケース1** テキスト編集 | 「Earth」→「World」（変更分のみ） | blur時に `closeHistory(tr)` |
| **ケース2** テーブル行追加×3 | 1行ずつ取り消し | 各コマンドを別 `dispatch()` で実行 |
| **ケース3** Input Rule 変換 | H2 → 段落 + "## " テキスト復元 | TipTap が自動処理（対応不要） |
| フォーカス切替 | Undo の対象外 | `addToHistory: false` |
| レンダリング切替 | Undo の対象外 | `addToHistory: false` |
| プログラム的変換 | Undo の対象外 | `addToHistory: false` |

### 実装優先度

```
高 ① blur 時の closeHistory（ケース1の核心）
高 ② テーブル各操作の個別 dispatch（ケース2）
中 ③ Input Rule は TipTap のデフォルトで動作（ケース3）
低 ④ History の depth / newGroupDelay チューニング
低 ⑤ ブロックフォーカス状態のデコレーション管理
```

---

## 8. 参照リソース

- [prosemirror-history ソースコード](https://github.com/prosemirror/prosemirror-history)
- [ProseMirror Guide - History and Undo](https://prosemirror.net/docs/guide/#history)
- [TipTap Extension - History](https://tiptap.dev/docs/editor/extensions/functionality/history)
- [TipTap - Custom Extensions](https://tiptap.dev/docs/editor/extensions/custom-extensions)
- [prosemirror-tables](https://github.com/prosemirror/prosemirror-tables)
- [TipTap - Table Extension](https://tiptap.dev/docs/editor/extensions/nodes/table)
