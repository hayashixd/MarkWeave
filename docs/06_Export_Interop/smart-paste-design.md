# スマートペースト設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [概要と目的](#1-概要と目的)
2. [クリップボードの種類別動作設計](#2-クリップボードの種類別動作設計)
3. [HTML → Markdown 変換パイプライン](#3-html--markdown-変換パイプライン)
4. [ユーザー体験（UX）設計](#4-ユーザー体験ux設計)
5. [動作モード設定](#5-動作モード設定)
6. [ソースモード時の動作](#6-ソースモード時の動作)
7. [エッジケースの処理方針](#7-エッジケースの処理方針)
8. [実装設計](#8-実装設計)
9. [実装フェーズ](#9-実装フェーズ)

---

## 1. 概要と目的

**スマートペースト**とは、クリップボードに HTML コンテンツが含まれる場合に自動的に Markdown へ変換してエディタに挿入する機能。

### 1.1 対象ユースケース

| ペーストの発生元 | 典型的なコンテンツ | スマートペーストの効果 |
|-----------------|------------------|--------------------|
| Web ブラウザ（Chrome/Firefox）| 記事の段落・見出し・リンク | Markdown の `##`, `**`, `[text](url)` に変換 |
| Google Docs / Notion | 箇条書き・テーブル・見出し | Markdown リスト・テーブルに変換 |
| GitHub / GitLab | コードブロック・PR 説明文 | バッククォートコードブロックとして挿入 |
| Microsoft Word | 文書の構造化テキスト | 見出し・リストに変換（スタイルは除去）|
| ChatGPT / Claude | 既に Markdown 形式のテキスト | テキスト変換不要で `text/plain` として挿入 |
| VS Code などのエディタ | プレーンコード | コードブロックとして挿入 |

### 1.2 Typora との比較

Typora はスマートペーストを黙って自動実行する（`Ctrl+Shift+V` でプレーンテキスト貼り付け）。
本エディタは設定により 3 つのモードを提供する（§5 参照）。

---

## 2. クリップボードの種類別動作設計

ペースト時にクリップボードの MIME タイプを確認して動作を分岐する。

```
Ctrl+V が押される
      │
      ▼
クリップボードに text/html があるか？
      │
      ├─ Yes → スマートペースト処理（§3）
      │
      └─ No  → 通常の text/plain としてそのまま挿入
```

### 2.1 MIME タイプ優先順位

| 優先度 | MIME タイプ | 説明 |
|--------|-----------|------|
| 1位 | `text/html` | ブラウザ・Office 系アプリからのリッチテキスト |
| 2位 | `text/plain` | プレーンテキスト（フォールバック）|
| 3位 | `image/png` 等 | 画像（[image-storage-design.md](./image-storage-design.md) で処理）|

`text/html` が存在する場合にのみスマートペーストを起動する。
`text/plain` のみの場合は通常ペーストとして扱い、turndown を呼ばない。

---

## 3. HTML → Markdown 変換パイプライン

### 3.1 変換ライブラリ

`turndown`（+ `turndown-plugin-gfm`）を使用する。これは `src/core/converter/html-to-md.ts` のスタブで既に採用が決定済み。

```
クリップボード HTML
        │
        ▼
  DOMPurify でサニタイズ     ← XSS 防止（security-design.md §2 参照）
        │
        ▼
  Turndown で HTML → MD 変換
  （GFM テーブル・取り消し線プラグイン有効）
        │
        ▼
  変換後 Markdown を TipTap に挿入
```

### 3.2 Turndown の設定

```typescript
// src/core/converter/smart-paste.ts
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import DOMPurify from 'dompurify';

const turndown = new TurndownService({
  headingStyle: 'atx',       // # 記法（Setextではなく）
  hr: '---',
  bulletListMarker: '-',     // リスト記号を '-' に統一
  codeBlockStyle: 'fenced',  // ``` 形式
  fence: '```',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined',
});

turndown.use(gfm);  // テーブル・取り消し線・タスクリスト対応

/** HTML → Markdown 変換 */
export function htmlToMarkdown(html: string): string {
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  return turndown.turndown(clean);
}
```

### 3.3 変換されるもの・されないもの

HTML → Markdown 変換の完全な変換マトリクス（許容ロスの定義を含む）は
**[html-editing-design.md §10](../05_Features/HTML/html-editing-design.md)** を単一の真実源（SoT）とする。

ペースト時に特有の注意点:

- **DOMPurify による事前サニタイズ**: `<script>` タグ・危険な属性はペースト前に除去される（[security-design.md §2](../01_Architecture/security-design.md) 参照）
- **スタイル属性は常に除去**: ペースト元のインラインスタイル（`color`, `font-size` 等）は Markdown に対応する表現がないため除去される
- **`<div>` 構造の消失**: `<div>` タグは除去され、内部テキストのみが保持される。これはペーストの文脈では通常の挙動として許容する

---

## 4. ユーザー体験（UX）設計

### 4.1 `auto` モード（デフォルト）

HTML クリップボードを検出した場合、確認なしで即座に Markdown へ変換して挿入する。

```
Ctrl+V
  │
  ├─ HTML あり → Markdown に変換して挿入（無音・即時）
  │
  └─ HTML なし → プレーンテキストとして挿入
```

**理由**: ほぼすべてのケースで HTML → MD 変換が望ましい。確認ダイアログは操作の流れを壊す。

### 4.2 `ask` モード

HTML クリップボードを検出した場合、インライン確認バーを表示する（モーダルダイアログは使わない）。

```
─────────────────────────────────────────────────────────
 クリップボードに書式付きテキストがあります
 [Markdown として貼り付け]  [プレーンテキストとして貼り付け]
─────────────────────────────────────────────────────────
```

- キーボードで操作可能（`Enter` = Markdown, `Escape` = プレーン）
- 3秒後にデフォルト（Markdown）で自動実行する（タイムアウト表示あり）

### 4.3 プレーンテキスト貼り付け（常時使用可能）

設定モードに関係なく `Ctrl+Shift+V`（`Cmd+Shift+V`）でプレーンテキストとして貼り付ける。
この操作は Typora 互換。

| キー | 動作 |
|------|------|
| `Ctrl+V` | 設定モードに従ったスマートペースト |
| `Ctrl+Shift+V` | 常にプレーンテキストとして貼り付け |

---

## 5. 動作モード設定

[user-settings-design.md](./user-settings-design.md) §2.2 の `editor.smartPasteMode` で制御する。

| モード | 動作 | ユーザー向け説明 |
|--------|------|----------------|
| `'auto'`（デフォルト）| 常に自動変換 | 「Markdown に変換して貼り付け」|
| `'ask'` | 都度確認 | 「貼り付けのたびに確認する」|
| `'never'` | スマートペーストを無効化 | 「常にプレーンテキストとして貼り付け」|

---

## 6. ソースモード時の動作

ソースモード（CodeMirror）でペーストした場合はスマートペーストを**行わない**。
ソースモードはユーザーが生テキストを直接操作する場であり、HTML の自動変換は意図しない改変につながるため。

| モード | `Ctrl+V` の動作 |
|--------|---------------|
| WYSIWYG モード | スマートペースト（設定による）|
| ソースモード | 常にプレーンテキストとして挿入 |

---

## 7. エッジケースの処理方針

### 7.1 ChatGPT / Claude からのペースト

これらのアプリはコピー時に `text/html` に Markdown をレンダリングした HTML を入れる場合がある。
turndown で変換するとほぼ元の Markdown に戻るため問題ない。

ただし数式（LaTeX `\(...\)` 記法）は一部のアプリで `<span class="math">` 等としてコピーされる。
このケースは Turndown のカスタムルールで対応する：

```typescript
// $...$ 形式に変換するカスタムルール
turndown.addRule('inlineMath', {
  filter: (node) =>
    node.nodeName === 'SPAN' &&
    (node.classList.contains('math') || node.classList.contains('katex')),
  replacement: (content) => `$${content}$`,
});
```

### 7.2 コードブロックのペースト（VS Code から）

VS Code からコピーした `<pre><code class="language-typescript">` は turndown の GFM プラグインで
自動的に ` ```typescript ` 形式に変換される。問題なし。

### 7.3 大量テキストのペースト（>100KB）

変換処理が UI をブロックしないよう `setTimeout(..., 0)` で非同期化する。
変換中は `Paste` キャレットにローディングスピナーを表示（目安: 100KB で < 200ms の見込み）。

### 7.4 画像を含むクリップボード

`text/html` に `<img>` タグが含まれる場合:
- `src` が `http://` / `https://` → `![alt](url)` としてそのまま挿入
- `src` が `data:image/...` → 画像を保存してローカルパスに変換（[image-storage-design.md](./image-storage-design.md) §1 参照）

---

## 8. 実装設計

### 8.1 ファイル構成

```
src/core/converter/
  smart-paste.ts       ← htmlToMarkdown() の実装
src/renderer/wysiwyg/
  paste-handler.ts     ← TipTap の paste 拡張として実装
```

### 8.2 TipTap への組み込み

TipTap の `Extension` として `paste` イベントをインターセプトする。

```typescript
// src/renderer/wysiwyg/paste-handler.ts
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { htmlToMarkdown } from '../../core/converter/smart-paste';
import { useSettingsStore } from '../../settings/settingsStore';

export const SmartPasteExtension = Extension.create({
  name: 'smartPaste',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('smartPaste'),
        props: {
          handlePaste: (view, event) => {
            const { smartPasteMode } = useSettingsStore.getState().settings.editor;
            if (smartPasteMode === 'never') return false;

            const html = event.clipboardData?.getData('text/html');
            if (!html) return false; // プレーンテキストのみ → TipTap デフォルト処理

            // auto モード: 即時変換
            if (smartPasteMode === 'auto') {
              const md = htmlToMarkdown(html);
              insertMarkdownAtCursor(view, md);
              return true;
            }

            // ask モード: 確認バーを表示（省略: UI コンポーネントへのイベント発火）
            triggerAskBar(view, html);
            return true;
          },
        },
      }),
    ];
  },
});
```

---

## 9. 実装フェーズ

| フェーズ | 実装内容 |
|---------|---------|
| Phase 1（MVP）| `htmlToMarkdown()` 実装、`SmartPasteExtension` 組み込み、`auto` モードのみ |
| Phase 1（後半）| `Ctrl+Shift+V` のプレーンテキスト貼り付け |
| Phase 3 | `ask` モードの確認バー UI |
| Phase 3 | 画像 data-URI の保存連携 |
| Phase 3 | 数式 LaTeX の Turndown カスタムルール |

---

## 関連ドキュメント

- [user-settings-design.md](./user-settings-design.md) §2.2 — `smartPasteMode` 設定
- [image-storage-design.md](./image-storage-design.md) — ペースト時の画像保存
- [security-design.md](./security-design.md) §2 — DOMPurify による HTML サニタイズ
- [keyboard-shortcuts.md](./keyboard-shortcuts.md) — `Ctrl+Shift+V` のショートカット定義
