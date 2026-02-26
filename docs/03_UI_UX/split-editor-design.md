# ペイン分割エディタ（Split Editor）設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-25

---

## 目次

1. [概要と目的](#1-概要と目的)
2. [分割モードの種類](#2-分割モードの種類)
3. [UI 設計](#3-ui-設計)
4. [操作方法](#4-操作方法)
5. [状態管理設計](#5-状態管理設計)
6. [スクロール同期](#6-スクロール同期)
7. [制約事項](#7-制約事項)
8. [実装方針](#8-実装方針)
9. [既存スプリットビューとの関係](#9-既存スプリットビューとの関係)

---

## 1. 概要と目的

### 1.1 概要

エディタ画面を左右または上下に分割し、2 つの異なるファイル（または同じファイルの別部分）を同時に表示・編集できる機能。VS Code のスプリットエディタに相当する。

### 1.2 目的・設計思想

- **参照しながら執筆**: 別資料を参照しながらドキュメントを書く
- **翻訳作業**: 翻訳元テキストと翻訳先テキストを並べて作業する
- **差分確認**: 同じドキュメントの異なる箇所を同時に閲覧する
- **比較レビュー**: 複数ファイルの内容を比較する

> **既存スプリットビューとの区別**: [editor-ux-design.md](./editor-ux-design.md) §9 の「スプリットビュー」は *単一ファイルのソースコード ↔ プレビュー* の並列表示。本機能は *複数ファイルの WYSIWYG エディタ* を並べるペイン分割機能である。

---

## 2. 分割モードの種類

| モード | 説明 |
|-------|------|
| **左右分割（縦分割）** | エディタを左右 2 ペインに分割（デフォルト） |
| **上下分割（横分割）** | エディタを上下 2 ペインに分割 |
| **同一ファイル分割** | 同じファイルを 2 つのペインで開き、別の箇所を同時表示 |

---

## 3. UI 設計

### 3.1 左右分割レイアウト

```
┌─────────────────────────────────────────────────────────┐
│ [ツールバー]                                            │
├────────────────────────┬────────────────────────────────┤
│ [タブバー A]           │ [タブバー B]                   │
│ 📄 file-a.md ✕  +     │ 📄 file-b.md ✕  +             │
├────────────────────────┼────────────────────────────────┤
│                        │                                │
│   WYSIWYG エディタ A   ‖   WYSIWYG エディタ B          │
│                        │                                │
│ (左ペインにフォーカス) │                                │
│                        │                                │
└────────────────────────┴────────────────────────────────┘
│ [ステータスバー] (アクティブペインの情報)               │
```

- `‖` = リサイズ可能なスプリッタ（ドラッグで幅を調整）
- 各ペインは独立したタブバーを持つ（ペイン内でのタブ切り替えが可能）
- ステータスバーはフォーカスのあるペインの情報を表示

### 3.2 上下分割レイアウト

```
┌────────────────────────────────────────────────────────┐
│ [タブバー A]  📄 file-a.md ✕  +                       │
├────────────────────────────────────────────────────────┤
│   WYSIWYG エディタ A                                   │
├════════════════════════════════════════════════════════┤  ← スプリッタ
│ [タブバー B]  📄 file-b.md ✕  +                       │
├────────────────────────────────────────────────────────┤
│   WYSIWYG エディタ B                                   │
└────────────────────────────────────────────────────────┘
```

### 3.3 ペインのフォーカス表示

```
フォーカスあり: タブバーと枠が強調色（アクティブ）
フォーカスなし: タブバーと枠がグレーアウト
```

---

## 4. 操作方法

### 4.1 ペイン分割の開始

| 操作 | 動作 |
|------|------|
| `Ctrl+\` | 現在タブを右ペインで分割して開く |
| `Ctrl+K Ctrl+\` | 現在タブを下ペインで分割して開く |
| タブを右クリック →「右に分割」 | 現在タブを右ペインで分割して開く |
| タブを右クリック →「下に分割」 | 現在タブを下ペインで分割して開く |
| タブをペインへドラッグ＆ドロップ | ドロップ先のペインでタブを開く |

### 4.2 ペイン間の操作

| 操作 | 動作 |
|------|------|
| `Ctrl+Alt+←/→` | 左右のペインにフォーカスを移動 |
| `Ctrl+Alt+↑/↓` | 上下のペインにフォーカスを移動 |
| スプリッタをダブルクリック | ペインを均等幅に戻す |
| スプリッタをドラッグ | ペインの幅/高さを調整 |

### 4.3 ペイン分割の解除

| 操作 | 動作 |
|------|------|
| `Ctrl+W` でペインの最後のタブを閉じる | ペインが自動的に閉じる |
| 「ペインを閉じる」ボタン（ペインタブバー右端） | そのペインを閉じる（タブは元ペインに移動） |
| メニュー: 表示 → ペイン分割を閉じる | 全分割を解除して単一ペインに戻す |

---

## 5. 状態管理設計

### 5.1 ペイン状態の型定義

```typescript
// src/store/paneStore.ts

interface PaneLayout {
  type: 'single' | 'horizontal' | 'vertical';
  splitRatio: number;     // 0.0〜1.0（左/上ペインの割合、デフォルト: 0.5）
}

interface PaneState {
  id: string;             // 'pane-1' | 'pane-2'
  tabs: TabId[];          // このペインに属するタブの ID 一覧
  activeTabId: TabId | null;
  isFocused: boolean;
}

interface SplitEditorStore {
  layout: PaneLayout;
  panes: PaneState[];     // 1〜2 要素
  activePaneId: string;

  // アクション
  splitPane: (direction: 'horizontal' | 'vertical', tabId?: TabId) => void;
  closePane: (paneId: string) => void;
  moveTabToPane: (tabId: TabId, fromPaneId: string, toPaneId: string) => void;
  setSplitRatio: (ratio: number) => void;
  setActivePaneId: (paneId: string) => void;
}
```

### 5.2 セッション保存

分割状態はセッションとして保存・復元される（[window-tab-session-design.md](./window-tab-session-design.md) §2 と連携）。

```typescript
interface SessionData {
  // ... 既存フィールド
  paneLayout: PaneLayout;
  panes: SerializedPaneState[];
}
```

---

## 6. スクロール同期

### 6.1 同一ファイル分割時の同期オプション

同じファイルを 2 ペインで開いている場合、スクロール同期の有効/無効を設定できる。

```
ペインタブバーの右クリックメニュー:
  ✓ スクロール同期 [有効/無効トグル]
```

- **有効時**: 一方のペインでスクロールすると、他方も比例してスクロール（§9 のアルゴリズムを流用）
- **無効時**: 各ペインが独立してスクロール

### 6.2 異なるファイル間の同期

異なるファイル間のスクロール同期は、誤動作の原因になるため提供しない。

---

## 7. 制約事項

| 制約 | 理由 |
|------|------|
| 最大 2 ペインまで | 3 分割以上はモバイル対応が困難、かつ複雑性が増す |
| モバイル（Android/iOS）では分割無効 | 画面サイズが小さく、UX が成立しない |
| ソースモードとWYSIWYGモードの混在は可 | ペインごとに独立したモードを持つ |

---

## 8. 実装方針

### 8.1 コンポーネント構造

```
<SplitEditorLayout>                    // 分割レイアウト管理
  <SplitPane id="pane-1">
    <PaneTabBar paneId="pane-1" />
    <EditorWrapper tabId={activeTabId} />
  </SplitPane>
  <Splitter
    direction={layout.type}
    onRatioChange={setSplitRatio}
  />
  {layout.type !== 'single' && (
    <SplitPane id="pane-2">
      <PaneTabBar paneId="pane-2" />
      <EditorWrapper tabId={activeTabId} />
    </SplitPane>
  )}
</SplitEditorLayout>
```

### 8.2 スプリッタのドラッグ実装

```typescript
// src/components/Splitter/index.tsx
function Splitter({ direction, onRatioChange }: SplitterProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const handlePointerMove = (moveE: PointerEvent) => {
      const container = containerRef.current!.parentElement!;
      const rect = container.getBoundingClientRect();
      const ratio = direction === 'vertical'
        ? (moveE.clientX - rect.left) / rect.width
        : (moveE.clientY - rect.top) / rect.height;
      onRatioChange(Math.max(0.2, Math.min(0.8, ratio))); // 20%〜80% に制限
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', () => {
      document.removeEventListener('pointermove', handlePointerMove);
    }, { once: true });
  };

  return (
    <div
      ref={containerRef}
      className={`splitter splitter--${direction}`}
      onPointerDown={handlePointerDown}
      role="separator"
      aria-orientation={direction === 'vertical' ? 'vertical' : 'horizontal'}
    />
  );
}
```

---

## 9. 既存スプリットビューとの関係

本機能（Split Editor / ペイン分割）と [editor-ux-design.md](./editor-ux-design.md) §9 の「スプリットビュー（ソース ↔ プレビュー）」は **別機能** として共存する。

| 機能 | スコープ | 目的 |
|------|---------|------|
| ソース ↔ プレビュー スプリットビュー | 単一ファイル | ソース編集しながらプレビューを確認 |
| ペイン分割（Split Editor）| 複数ファイルまたは同一ファイル | 別ファイルを参照しながら執筆 |

ペイン分割中の各ペインは、それぞれが「ソース ↔ プレビュー スプリットビュー」を持つことができる。

---

## 10. 同一ファイル分割時の EditorState 共有・同期設計

### 10.1 課題：2 インスタンス間の履歴破壊リスク

同一ファイルを 2 ペインで開いた場合、TipTap（ProseMirror）インスタンスを **それぞれ独立して生成すると** 以下の問題が発生する:

| 問題 | 発生メカニズム |
|------|--------------|
| Undo 履歴の不整合 | ペイン A で編集した操作をペイン B 側の Undo で元に戻せない（履歴が別々） |
| 競合上書き | 両ペインが同じ `tabId` の内容を保持するが、入力内容が一致しないまま保存される |
| スクロール同期の基準ズレ | §6 のスクロール同期がドキュメント変更後に位置計算を誤る |

> `window-tab-session-design.md` §5 の「複数ウィンドウでの排他制御（1 ウィンドウのみ書き込み権限）」は **異なるウィンドウ間** の話であり、同一ウィンドウ内のペイン分割は別問題である。

### 10.2 解決策：単一 EditorState + dispatch 共有方式

同一ファイルを 2 ペインで表示する場合、TipTap インスタンスは **1 つだけ** 生成し、React コンテキスト経由で両ペインが共有する。

```
                ┌─────────────────────────────────────────┐
                │   useEditorInstance(tabId)              │
                │   → TipTap Editor インスタンス (1個)    │
                │   → ProseMirror State (共通)            │
                │   → History (Undo/Redo) (共通)          │
                └────────────┬──────────────┬─────────────┘
                             │              │
              ┌──────────────▼──┐    ┌──────▼──────────────┐
              │  ペイン A View   │    │  ペイン B View       │
              │  EditorView(A)  │    │  EditorView(B)       │
              │  独立スクロール  │    │  独立スクロール       │
              └─────────────────┘    └─────────────────────┘
```

**実装方針**:

```typescript
// src/hooks/useEditorInstance.ts

/**
 * tabId が示すファイルの TipTap エディタインスタンスを返す。
 * 同じ tabId に対して複数回呼ばれても同一インスタンスを返す（キャッシュ済み）。
 * ProseMirror の EditorView は呼び出し元が独立して生成し、同一の EditorState を参照する。
 */
const editorCache = new Map<string, Editor>();

export function useEditorInstance(tabId: string): Editor {
  if (!editorCache.has(tabId)) {
    const editor = new Editor({
      extensions: [...sharedExtensions],
      content: tabStore.getContent(tabId),
    });
    editorCache.set(tabId, editor);
  }
  return editorCache.get(tabId)!;
}

// ペインが全て閉じられたらインスタンスを破棄
export function releaseEditorInstance(tabId: string): void {
  const editor = editorCache.get(tabId);
  if (editor) {
    editor.destroy();
    editorCache.delete(tabId);
  }
}
```

### 10.3 各ペインは独立した EditorView を持つ

TipTap の `Editor` は内部的に ProseMirror `EditorView` を持つが、
同一ファイル分割では **1 つの Editor インスタンスの State** を両ペインで共有しつつ、
各ペインは独自の **スクロール位置・カーソル位置** を管理する。

ただし TipTap API が単一の EditorView 前提であるため、実装上は以下の代替方式を採用する:

| 方式 | 採用可否 | 理由 |
|------|---------|------|
| 単一 Editor + 単一 EditorView（ペイン A のみ実エディタ、ペイン B は読み取り専用ミラー） | **採用（Phase 3）** | 実装コストが低い。ペイン B での編集時は B にフォーカスを移してフォールバック |
| 2 つの EditorView が同一 EditorState を共有（ProseMirror 低レベル API を直接使用） | 将来検討 | 複雑だが最も正確。ProseMirror 本体のドキュメントに記載あり |
| Yjs CRDT による 2 インスタンス間インメモリ同期 | 将来検討 | リアルタイム共同編集と共通基盤が使えるが、オーバースペック |

**Phase 3 での採用方式 — アクティブ/ミラー方式**:
- 同一ファイル分割時、フォーカスのあるペインが「アクティブ（実 EditorView）」となる
- フォーカスのないペインは EditorState のスナップショットを `contenteditable="false"` で表示（ミラー）
- ペイン B をクリックするとフォーカスが切り替わり、B が実 EditorView、A がミラーに変わる
- Undo/Redo 履歴は実 EditorView に集約されるため破壊されない

```
フォーカスがペイン A にある場合:
  ペイン A: EditorView (実・編集可)
  ペイン B: ミラービュー (最新スナップショット・クリックでフォーカス奪取)

→ ペイン B をクリック:
  ペイン B: EditorView (実・編集可)  ← フォーカス切り替え
  ペイン A: ミラービュー
```

### 10.4 設計の注意事項

- ミラービューは TipTap の `editable: false` モードで実装し、Undo 履歴には影響しない
- フォーカス切り替え時に実 EditorView のカーソル位置をミラー側のクリック位置に近い位置に移動する
- §6 のスクロール同期は、実 EditorView のスクロールイベントを基準に行う

---

## 11. マルチウィンドウ × ペイン分割のエッジケース

### 11.1 問題の整理

Phase 7 以降でタブのウィンドウ切り出し機能（`window-tab-session-design.md §11`）が実装されると、以下のエッジケースが発生し得る。

**シナリオ例**:
1. ウィンドウ A（左ペイン: `file.md`、右ペイン: `other.md`）
2. ユーザーがウィンドウ A から `file.md` のタブをウィンドウ B に切り出す
3. ウィンドウ A の左ペインは空になるが、ウィンドウ B が `file.md` の書き込み権限を持つ

**より複雑なシナリオ**:
1. ウィンドウ A: 左ペインで `file.md` を開いている（書き込み権限あり）
2. ユーザーがウィンドウ B を新規作成し、`file.md` を開こうとする
3. `file.md` の書き込みロック（`window-tab-session-design.md §12.2`）により、ウィンドウ B は読み取り専用で開く
4. さらにウィンドウ B 内でペイン分割し、別のファイルを右ペインに開く

### 11.2 ルールと解決策

| シナリオ | 挙動 | 根拠 |
|---------|------|------|
| ウィンドウ A の左ペイン（書き込み）＋ウィンドウ B の右ペイン（同一ファイル）| ウィンドウ B はファイルロックにより**読み取り専用**で開く | `window-tab-session-design.md §12.2` のファイルロック機構が優先 |
| 同一ウィンドウ内の左右ペインで同一ファイル | §10.2 のアクティブ/ミラー方式（単一 EditorState 共有）を使用 | ペイン分割は同一ウィンドウ内の問題 |
| タブをウィンドウに切り出す際、元がペイン分割状態だった場合 | 切り出したタブは新ウィンドウで単一ペインとして開く。元ウィンドウのペイン状態はそのまま維持 | タブ切り出しはペインごとではなくタブ単位で行う |
| ウィンドウ A が書き込み権限を持つファイルのウィンドウを閉じた場合 | ファイルロックを解放し、他のウィンドウが書き込み権限を取得できる | `window-tab-session-design.md §12.2` の「ウィンドウクローズ時にロック解放」 |

### 11.3 実装時の注意点

```
ペイン分割 × マルチウィンドウの実装チェックリスト（Phase 7）:

□ タブをウィンドウに切り出す前にペイン内の他タブを確認し、
  ペインが1タブのみの場合は「ペインが閉じる」ことをユーザーに通知する
□ 切り出し先の新ウィンドウは、元ペインの split 状態ではなく単一ペインで起動する
□ ファイルロック判定は「ウィンドウ単位」ではなく「WebviewWindow インスタンス単位」で行う
□ 読み取り専用で開かれているファイルは、スタータスバーに「🔒 読み取り専用（他のウィンドウが編集中）」を表示する
```

> **SoT**: ファイルロック・排他制御の詳細仕様は `window-tab-session-design.md §12` が正典。本セクションはペイン分割との交差点のみを記述する。

---

## 関連ドキュメント

- [editor-ux-design.md](./editor-ux-design.md) §9 — ソース ↔ プレビュー スプリットビュー設計
- [window-tab-session-design.md](../04_File_Workspace/window-tab-session-design.md) — タブ・セッション管理設計
- [keyboard-shortcuts.md](./keyboard-shortcuts.md) — ペイン操作のキーボードショートカット
- [accessibility-design.md](./accessibility-design.md) — ペイン間のフォーカス管理・ARIA
- [undo-redo-design.md](../02_Core_Editor/undo-redo-design.md) — TipTap 履歴プラグイン設計
