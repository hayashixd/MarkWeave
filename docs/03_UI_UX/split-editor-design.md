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

## 関連ドキュメント

- [editor-ux-design.md](./editor-ux-design.md) §9 — ソース ↔ プレビュー スプリットビュー設計
- [window-tab-session-design.md](./window-tab-session-design.md) — タブ・セッション管理設計
- [keyboard-shortcuts.md](./keyboard-shortcuts.md) — ペイン操作のキーボードショートカット
- [accessibility-design.md](./accessibility-design.md) — ペイン間のフォーカス管理・ARIA
