# 検索・置換 UX 設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [設計方針](#1-設計方針)
2. [単一ファイル内検索・置換](#2-単一ファイル内検索置換)
3. [ワークスペース横断全文検索](#3-ワークスペース横断全文検索)
4. [検索結果 UI 設計](#4-検索結果-ui-設計)
5. [検索オプション](#5-検索オプション)
6. [キーボードナビゲーション](#6-キーボードナビゲーション)
7. [パフォーマンスとの連携](#7-パフォーマンスとの連携)
8. [実装フェーズ](#8-実装フェーズ)

---

## 1. 設計方針

### 1.1 基本方針

- **2 種類の検索を明確に分離する**: ファイル内検索（`Ctrl+F`）とワークスペース横断検索（`Ctrl+Shift+F`）は UI も実装も独立させる
- **インクリメンタル検索**: 文字を打つたびにリアルタイムでハイライトが更新される（デバウンス 100ms）
- **WYSIWYG と検索の整合**: 検索はレンダリング済みテキストに対して行う。Markdown 記法文字（`**`・`#` 等）は検索対象から除外する
- **バックエンドは Rust 内製（walkdir + regex クレート）**: ワークスペース横断検索のパフォーマンスは `performance-design.md §6` の設計に従う。外部 ripgrep バイナリには依存しない（§1.1 参照）

---

## 2. 単一ファイル内検索・置換

### 2.1 UI 概要

`Ctrl+F` で開くフローティングバーをエディタ右上に表示する。Typora と同様の配置。

```
┌───────────────────────────────────────────────────────┐
│  エディタ本文                                          │
│                                        ┌────────────────────────────────┐
│  # 見出し 1                             │ 🔍 検索...              [×]  │
│                                        ├────────────────────────────────┤
│  本文テキストが **ここに** あります。    │ 置換...                       │
│                                        ├──────────────────┬─────────────┤
│  検索ワードにヒットした部分は          │ Aa  .*  \b  [全て置換] [置換] │
│  ハイライトされます。                  ├──────────────────┴─────────────┤
│                                        │ 3 / 12 件    [↑] [↓]         │
└───────────────────────────────────────└────────────────────────────────┘
```

### 2.2 検索ハイライトの実装

TipTap の `Decoration` API を使って検索結果をハイライトする。ProseMirror の選択範囲とは独立したデコレーションとして管理する。

```typescript
// src/renderer/wysiwyg/plugins/search-highlight.ts

import { Plugin, PluginKey, PluginState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

interface SearchState {
  query: string;
  currentIndex: number;
  matches: Array<{ from: number; to: number }>;
}

const searchPluginKey = new PluginKey<SearchState>('search');

/**
 * 検索クエリにマッチするすべての位置に Decoration を付与する。
 * 現在フォーカス中のマッチは 'search-match--current' クラスを付与する。
 */
export const searchHighlightPlugin = new Plugin<SearchState>({
  key: searchPluginKey,

  state: {
    init: () => ({ query: '', currentIndex: 0, matches: [] }),

    apply(tr, prev) {
      const meta = tr.getMeta(searchPluginKey);
      if (!meta) return prev;
      return { ...prev, ...meta };
    },
  },

  props: {
    decorations(state) {
      const { query, currentIndex, matches } = searchPluginKey.getState(state)!;
      if (!query || matches.length === 0) return DecorationSet.empty;

      const decorations = matches.map((match, i) =>
        Decoration.inline(match.from, match.to, {
          class: i === currentIndex
            ? 'search-match search-match--current'
            : 'search-match',
        })
      );

      return DecorationSet.create(state.doc, decorations);
    },
  },
});

/**
 * ドキュメントテキスト内のクエリにマッチする全位置を返す。
 * WYSIWYG モードのため、テキストノードのみを検索対象とする。
 */
export function findMatches(
  doc: Node,
  query: string,
  options: SearchOptions
): Array<{ from: number; to: number }> {
  if (!query) return [];

  const matches: Array<{ from: number; to: number }> = [];
  const flags = options.caseSensitive ? 'g' : 'gi';
  const pattern = options.regex
    ? new RegExp(query, flags)
    : new RegExp(escapeRegex(query), flags);

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(node.text)) !== null) {
      matches.push({
        from: pos + match.index,
        to: pos + match.index + match[0].length,
      });
    }
  });

  return matches;
}
```

### 2.3 置換の実装

```typescript
// src/renderer/wysiwyg/plugins/search-replace.ts

import { EditorView } from '@tiptap/pm/view';
import { searchPluginKey } from './search-highlight';

/**
 * 現在フォーカス中のマッチ 1 件を置換する。
 */
export function replaceCurrent(view: EditorView, replacement: string): void {
  const { matches, currentIndex } = searchPluginKey.getState(view.state)!;
  if (matches.length === 0) return;

  const match = matches[currentIndex];
  const tr = view.state.tr.replaceWith(
    match.from,
    match.to,
    view.state.schema.text(replacement)
  );
  view.dispatch(tr);
}

/**
 * すべてのマッチを一括置換する。
 * 後ろから置換することでオフセットのズレを防ぐ。
 */
export function replaceAll(view: EditorView, replacement: string): number {
  const { matches } = searchPluginKey.getState(view.state)!;
  if (matches.length === 0) return 0;

  let tr = view.state.tr;
  // 後ろから置換してオフセットのズレを防ぐ
  const sorted = [...matches].sort((a, b) => b.from - a.from);
  for (const match of sorted) {
    tr = tr.replaceWith(match.from, match.to, view.state.schema.text(replacement));
  }
  view.dispatch(tr);
  return matches.length;
}
```

### 2.4 検索バー React コンポーネント

```tsx
// src/components/Search/SearchBar.tsx

interface SearchBarProps {
  editor: Editor;
  onClose: () => void;
}

export function SearchBar({ editor, onClose }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
  });
  const [matchInfo, setMatchInfo] = useState({ current: 0, total: 0 });

  // デバウンスして検索実行
  const debouncedSearch = useDebouncedCallback((q: string) => {
    const matches = findMatches(editor.state.doc, q, options);
    editor.view.dispatch(
      editor.view.state.tr.setMeta(searchPluginKey, {
        query: q, matches, currentIndex: 0,
      })
    );
    setMatchInfo({ current: matches.length > 0 ? 1 : 0, total: matches.length });
  }, 100);

  // ...

  return (
    <div className="search-bar" role="search" aria-label="ドキュメント内検索">
      <div className="search-bar__input-row">
        <input
          type="text"
          placeholder="検索..."
          value={query}
          onChange={e => { setQuery(e.target.value); debouncedSearch(e.target.value); }}
          aria-label="検索キーワード"
          autoFocus
        />
        <span className="search-bar__count" aria-live="polite" aria-atomic="true">
          {matchInfo.total > 0 ? `${matchInfo.current} / ${matchInfo.total} 件` : '見つかりません'}
        </span>
        <button onClick={gotoPrev} aria-label="前の一致箇所">↑</button>
        <button onClick={gotoNext} aria-label="次の一致箇所">↓</button>
        <button onClick={onClose} aria-label="検索を閉じる">×</button>
      </div>
      {showReplace && (
        <div className="search-bar__replace-row">
          <input
            type="text"
            placeholder="置換..."
            value={replacement}
            onChange={e => setReplacement(e.target.value)}
            aria-label="置換テキスト"
          />
          <button onClick={() => replaceCurrent(editor.view, replacement)}>置換</button>
          <button onClick={() => replaceAll(editor.view, replacement)}>全て置換</button>
        </div>
      )}
      <div className="search-bar__options">
        <button
          className={options.caseSensitive ? 'active' : ''}
          onClick={() => toggleOption('caseSensitive')}
          title="大文字/小文字を区別 (Alt+C)"
          aria-pressed={options.caseSensitive}
        >Aa</button>
        <button
          className={options.regex ? 'active' : ''}
          onClick={() => toggleOption('regex')}
          title="正規表現を使用 (Alt+R)"
          aria-pressed={options.regex}
        >.*</button>
        <button
          className={options.wholeWord ? 'active' : ''}
          onClick={() => toggleOption('wholeWord')}
          title="単語単位で検索 (Alt+W)"
          aria-pressed={options.wholeWord}
        >\b</button>
      </div>
    </div>
  );
}
```

---

## 3. ワークスペース横断全文検索

### 3.1 UI 概要

`Ctrl+Shift+F` でサイドバーに検索パネルを開く。VS Code の検索サイドバーに近い配置。

```
┌──────────────────────────────────────────────┐
│  サイドバー                                   │
│  [ファイルツリー] [検索]                       │
│──────────────────────────────────────────────│
│  🔍 ワークスペース内を検索                     │
│  ┌─────────────────────────────────────────┐ │
│  │ 検索キーワード...                [Aa][.*]│ │
│  └─────────────────────────────────────────┘ │
│  ☐ ファイルを絞り込む: *.md                   │
│                                              │
│  検索結果 (28 件 / 5 ファイル)               │
│  ─────────────────────────────────────────── │
│  ▼ project-overview.md  (3 件)               │
│      15: ここに **キーワード** が含まれます   │
│      32: キーワードによる説明                 │
│      78: 別のキーワードの例                   │
│  ─────────────────────────────────────────── │
│  ▼ design/system-design.md  (12 件)          │
│      ...                                     │
│  ─────────────────────────────────────────── │
│  ▶ docs/api-reference.md  (4 件)             │
└──────────────────────────────────────────────┘
```

### 3.2 バックエンド（Rust + walkdir + regex）

> **実装方針**: 外部 ripgrep バイナリへの依存を避け、Rust の `walkdir` + `regex` クレートで内製する。
> 理由:
> - **バイナリ同梱不要**: ripgrep を同梱するとバイナリサイズが増加し、全プラットフォームのクロスコンパイルが複雑になる
> - **十分なパフォーマンス**: Rust ネイティブの `regex` クレートは JavaScript 比で 5〜20 倍高速（`performance-design.md §6.2` 参照）
> - **シンプルな依存関係**: Cargo.toml に 2 クレートを追加するだけ
>
> 将来的にワークスペースが数万ファイル規模になった場合は ripgrep ベースへの切り替えを再検討する。

バックエンドの設計は `performance-design.md §6` に準拠。フロントエンド側の UX 設計として、以下のコマンドインターフェースを使用する。

```typescript
// src/components/Search/WorkspaceSearch.tsx

import { invoke } from '@tauri-apps/api/core';

interface SearchRequest {
  workspacePath: string;
  query: string;
  options: {
    caseSensitive: boolean;
    regex: boolean;
    wholeWord: boolean;
    includeGlob?: string;  // 例: "*.md"
    excludeGlob?: string;  // 例: "node_modules/**"
  };
  limit?: number;           // 最大ファイル数（デフォルト: 100）
}

interface SearchMatch {
  lineNumber: number;
  lineText: string;          // マッチを含む行のテキスト
  matchStart: number;        // 行内でのマッチ開始位置
  matchEnd: number;          // 行内でのマッチ終了位置
}

interface SearchFileResult {
  filePath: string;
  matches: SearchMatch[];
}

// Tauri コマンド呼び出し
async function searchWorkspace(req: SearchRequest): Promise<SearchFileResult[]> {
  return invoke<SearchFileResult[]>('search_workspace', { request: req });
}
```

### 3.3 インクリメンタル検索の流れ

```
ユーザーがキーワードを入力
  │  デバウンス 300ms（全文検索はコストが高いため長め）
  ▼
[前回の検索結果をクリア]
  │
  ▼
[ローディングスピナー表示]
  │
  ▼
invoke('search_workspace', { query, options })
  │  Rust 側: walkdir + regex クレートで検索実行
  │  結果を streaming で返す（将来対応）
  ▼
[ファイルグループ別に結果を表示]
  │
  ▼
[各行の結果テキスト内のマッチ部分をハイライト]
```

### 3.4 検索結果クリックの動作

```
ユーザーが検索結果の行をクリック
  │
  ├─ 対象ファイルがすでにタブで開かれている場合
  │    → そのタブにフォーカス
  │    → 対応する行番号にスクロール
  │    → 該当テキストを選択状態にする
  │
  └─ 対象ファイルが未開の場合
       → 新しいタブで開く
       → 対応する行番号にスクロール
       → 該当テキストを選択状態にする
```

### 3.5 検索結果のマッチテキスト表示

```tsx
// src/components/Search/SearchResultItem.tsx

function SearchResultItem({ match }: { match: SearchMatch }) {
  // マッチ箇所を before / matched / after に分割してハイライト表示
  const before = match.lineText.slice(0, match.matchStart);
  const matched = match.lineText.slice(match.matchStart, match.matchEnd);
  const after = match.lineText.slice(match.matchEnd);

  // 長い行は末端を省略（先頭 60 文字・末尾 30 文字）
  const truncated = truncateLine(before, matched, after);

  return (
    <div className="search-result-match">
      <span className="search-result-match__line-num">{match.lineNumber}</span>
      <span className="search-result-match__text">
        <span>{truncated.before}</span>
        <mark className="search-result-match__highlight">{truncated.matched}</mark>
        <span>{truncated.after}</span>
      </span>
    </div>
  );
}
```

---

## 4. 検索結果 UI 設計

### 4.1 結果の折りたたみ

```
▼ ファイル名 (N 件)   → クリックで折りたたむ / 展開する
▶ ファイル名 (N 件)   → 折りたたまれた状態
```

デフォルトは全ファイル展開。ファイル数が多い場合（10 ファイル以上）は折りたたむ。

### 4.2 空状態・エラー表示

| 状態 | 表示 |
|------|------|
| 検索前（初期状態） | 「Ctrl+Shift+F で現在のワークスペースを検索」 |
| 結果 0 件 | 「"キーワード" に一致するファイルが見つかりません」 |
| ワークスペース未選択 | 「フォルダを開いて検索を使用してください（Ctrl+Shift+O）」 |
| 検索中 | スピナー + 「検索中...」 |
| エラー | 「検索エラー: {メッセージ}」（正規表現の文法エラーなど）|

### 4.3 結果件数の上限

| 設定 | デフォルト値 | 変更可能か |
|------|-----------|----------|
| 最大ファイル数 | 100 ファイル | ユーザー設定で変更可 |
| ファイルあたり最大表示件数 | 50 件（超過は「他 N 件」と表示）| 固定 |

---

## 5. 検索オプション

### 5.1 共通オプション

| オプション | ショートカット | デフォルト | 説明 |
|-----------|------------|---------|------|
| 大文字/小文字を区別 | `Alt+C` | OFF | マッチ時に case-sensitive にする |
| 正規表現を使用 | `Alt+R` | OFF | クエリを正規表現として解釈 |
| 単語単位で検索 | `Alt+W` | OFF | 単語境界 `\b` でマッチ |

### 5.2 ワークスペース検索専用オプション

| オプション | デフォルト | 例 |
|-----------|---------|-----|
| 含むファイル | `*.md` | `*.md,*.html` |
| 除外するファイル | `node_modules/**` | `docs/**,*.tmp` |

### 5.3 オプションの永続化

検索オプションの状態はセッション中のみ維持する（ファイルには保存しない）。アプリ再起動でデフォルト値に戻る。

---

## 6. キーボードナビゲーション

### 6.1 ファイル内検索（`Ctrl+F`）

| キー | 動作 |
|------|------|
| `Ctrl+F` | 検索バーを開く（すでに開いている場合はフォーカス） |
| `Enter` / `F3` | 次のマッチへ移動 |
| `Shift+Enter` / `Shift+F3` | 前のマッチへ移動 |
| `Escape` | 検索バーを閉じてエディタにフォーカスを戻す |
| `Alt+C` | 大文字/小文字を区別 トグル |
| `Alt+R` | 正規表現 トグル |
| `Alt+W` | 単語単位 トグル |
| `Ctrl+H` | 置換バーを開く |
| `Enter`（置換入力中）| 現在のマッチを置換して次へ |
| `Ctrl+Alt+Enter`（置換入力中）| すべて置換 |

### 6.2 ワークスペース横断検索（`Ctrl+Shift+F`）

| キー | 動作 |
|------|------|
| `Ctrl+Shift+F` | 検索サイドパネルを開く |
| `↑` / `↓` | 結果リストをナビゲート |
| `Enter` | 選択した結果のファイルを開く |
| `Space` | ファイルグループの折りたたみ/展開 |
| `Escape` | サイドパネルを閉じる |

---

## 7. パフォーマンスとの連携

本ドキュメントは UX 設計を扱う。バックエンド（Rust 内製検索エンジン walkdir + regex・ストリーミング結果の返却・インデックスの有無）の設計は `performance-design.md §6` を参照。

フロントエンド側で気をつけるパフォーマンスポイント:

| 課題 | 対策 |
|------|------|
| インクリメンタル検索の過多な Tauri 呼び出し | デバウンス 300ms |
| 大量の検索結果（数百行）の DOM 生成コスト | 仮想スクロール（`react-window` 等）で対応 |
| ファイル内検索の Decoration 計算コスト | デバウンス 100ms + Web Worker での並列計算（将来） |
| 検索バーが開いている状態でのタイピング遅延 | Decoration 更新は `requestAnimationFrame` でバッチ処理 |

### 7.1 仮想スクロールと検索ハイライト（Decoration）の技術的競合

#### 問題

ProseMirror の `Decoration` API（`§2.2` で使用）は、ハイライト対象の DOM ノードが
**実際にマウントされている（DOM ツリーに存在する）** ことを前提とする。

一方、仮想スクロール（`react-window` 等）は、ビューポート外のリスト項目の DOM を
**アンマウント（削除）** することでパフォーマンスを確保する。

この2つの技術の前提が衝突する。

```
ファイル内検索のハイライトフロー（Decoration API）:

  ProseMirror ドキュメント上でマッチ位置を計算
        ↓
  DecorationSet を生成（全マッチ位置に mark Decoration を付与）
        ↓
  ProseMirror が DOM を更新 → マッチ位置の DOM ノードに class を付与
        ↓
  検索バーの「次へ」→ current マッチにスクロール

仮想スクロールとの競合:

  ビューポート外のマッチ位置の DOM ノード → アンマウント済み（存在しない）
        ↓
  ProseMirror が Decoration を適用しようとする
        ↓
  DOM ノードが見つからない → ハイライトが表示されない
  または「次へ」でスクロールしようとしても DOM がないためスクロール不能
```

#### Phase 1 MVP: トレードオフとして受け入れる

**Phase 1（ファイル内検索）では仮想スクロールを有効にしない。**

| 機能 | Phase 1 の扱い |
|------|-------------|
| ファイル内検索ハイライト（Decoration API） | ✅ 実装する |
| エディタ本文の仮想スクロール | ❌ Phase 1 では無効（全 DOM をマウント） |
| ワークスペース検索結果リストの仮想スクロール | ✅ 実装する（ProseMirror Decoration と無関係） |

**理由:**
- Phase 1 の対象ファイルは通常の Markdown ドキュメント（数百〜数千行程度）
- 数万行を超えるファイルへの対応は Phase 4 以降の課題
- 仮想スクロールなしでも `requestAnimationFrame` バッチ処理と Decoration デバウンスで
  十分なパフォーマンスを確保できる

#### Phase 4+: 代替ハイライトレイヤーを設計する

超長ファイル（数万行）への対応で仮想スクロールが必要になった場合、
Decoration API に依存しない代替ハイライト実装を採用する。

**候補アプローチ:**

| アプローチ | 概要 | 課題 |
|-----------|------|------|
| **Canvas オーバーレイ** | 検索マッチ位置をエディタの座標系に変換し、Canvas でハイライト矩形を描画 | ProseMirror の座標取得 API（`coordsAtPos`）が必要；スクロール連動が複雑 |
| **疑似ハイライトレイヤー** | DOM の上に absolute 配置の div を重ねてハイライト矩形を描画 | 仮想スクロール時のスクロールオフセット計算が必要 |
| **仮想スクロール対応 Decoration** | 仮想スクロールライブラリが DOM をアンマウントする前にコールバックを受け取り、Decoration を事前計算して DOM 存在時に適用 | 仮想スクロールライブラリとの密結合 |

**Phase 4 の実装方針:**
```
1. 仮想スクロール有効時は Decoration API によるハイライトを無効化
2. Canvas オーバーレイまたは疑似ハイライトレイヤーに切り替え
3. 「現在のマッチ」へのスクロールは仮想スクロールライブラリの
   scrollToIndex() API を使用（DOM の存在に依存しない）
```

#### まとめ

```
Phase 1〜3: 仮想スクロール無効、Decoration API でハイライト
Phase 4+  : 仮想スクロール + 代替ハイライトレイヤーの組み合わせを設計・実装
```

> この制約は `performance-design.md` にも記録すること。
> 「超長ファイル対応（Phase 4+）では Decoration API に依存しない検索ハイライト実装が必要」

---

## 8. 実装フェーズ

### Phase 3（ファイル内検索・置換）

- [ ] `SearchBar` コンポーネント実装
- [ ] `searchHighlightPlugin`（TipTap Decoration）実装
- [ ] `findMatches()` テキスト検索ロジック実装
- [ ] `replaceCurrent()` / `replaceAll()` 実装
- [ ] 検索オプション（大文字/小文字・正規表現・単語単位）
- [ ] キーボードショートカット（`Ctrl+F` / `Ctrl+H` / `Enter` / `Escape`）
- [ ] CSS スタイル（`.search-match` / `.search-match--current`）

### Phase 3（ワークスペース横断全文検索）

- [ ] 検索サイドパネル UI（`WorkspaceSearchPanel` コンポーネント）
- [ ] Tauri コマンド `search_workspace` 呼び出し実装
- [ ] 検索結果リストの表示（ファイルグループ・マッチ行・ハイライト）
- [ ] 結果クリック → ファイルを開いて該当行にジャンプ
- [ ] 検索オプション（含む/除外ファイルパターン）
- [ ] 結果件数上限の超過表示
- [ ] 空状態・ローディング・エラー表示
