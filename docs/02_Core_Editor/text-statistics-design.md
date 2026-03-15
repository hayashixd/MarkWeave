# テキスト統計・処理設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [文字数・単語数カウント表示](#1-文字数単語数カウント表示)
2. [読み時間推定](#2-読み時間推定)
3. [スペルチェック統合](#3-スペルチェック統合)
4. [IME / CJK 入力最適化](#4-ime--cjk-入力最適化)

---

## 1. 文字数・単語数カウント表示

### 1.1 表示場所

```
ステータスバー（右側）:
┌──────────────────────────────────────────────────────────────┐
│ Markdown  LF  UTF-8  日本語  |  1,234 文字  210 単語  3分  │
└──────────────────────────────────────────────────────────────┘
                                 ↑文字数     ↑単語数  ↑読み時間
```

選択テキストがある場合は選択範囲の統計を優先表示:

```
│ 選択中: 123 文字  21 単語
```

### 1.2 文字カウントの定義

| カウント方法 | 内容 |
|------------|------|
| **文字数**（CJK・スペースを含む）| Unicode コードポイント数。絵文字サロゲートペアを 1 としてカウント |
| **文字数**（スペースなし）| ホワイトスペース（スペース・タブ・改行）を除いた文字数 |
| **単語数** | 半角: スペース区切りのトークン数、CJK: 形態素解析またはヒューリスティック |
| **段落数** | 空行区切りのブロック数 |
| **見出し数** | `#`〜`######` の数 |

設定でどのカウント方法をデフォルト表示するか選択可能（`charCountMode: 'all' | 'no-space' | 'words'`）。

### 1.3 CJK テキストの単語カウント

日本語・中国語・韓国語はスペース区切りがないため、単語カウントには工夫が必要。

```typescript
// src/utils/text-stats.ts

export interface TextStats {
  chars: number;        // スペース含む文字数
  charsNoSpace: number; // スペースなし文字数
  words: number;        // 単語数
  paragraphs: number;   // 段落数
  sentences: number;    // 文数（. ! ? 区切り）
}

export function countTextStats(plainText: string): TextStats {
  const chars = [...plainText].length; // サロゲートペア対応

  const noSpace = plainText.replace(/\s/g, '');
  const charsNoSpace = [...noSpace].length;

  // 単語数: 英語（スペース区切り）+ CJK（文字数の1/2を概算）
  const asciiWords = (plainText.match(/\b\w+\b/g) ?? []).length;
  const cjkChars = (plainText.match(/[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7A3]/g) ?? []).length;
  // CJK はおよそ 2 文字 = 1 単語として概算（精度よりシンプルさを優先）
  const words = asciiWords + Math.ceil(cjkChars / 2);

  const paragraphs = plainText.split(/\n{2,}/).filter(p => p.trim()).length;
  const sentences = (plainText.match(/[.!?。！？]/g) ?? []).length;

  return { chars, charsNoSpace, words, paragraphs, sentences };
}
```

### 1.4 Markdown 記法の除外オプション

設定でマークダウン記法（`**`, `#`, `[]()` 等）を除いた「実質的な文字数」を表示できる。

```typescript
/**
 * Markdown 記法を取り除いたプレーンテキストを返す
 * （統計計算用。TipTap の getText() を使用）
 */
export function getPlainText(editor: Editor): string {
  return editor.state.doc.textContent;
}
```

---

## 2. 読み時間推定

### 2.1 推定アルゴリズム

```typescript
// src/utils/reading-time.ts

const READING_SPEED = {
  ja: 500,  // 日本語: 分速 500 文字（音読 200 〜 黙読 600 の中間値）
  zh: 500,  // 中国語: 同上
  ko: 500,  // 韓国語: 同上
  en: 200,  // 英語: 分速 200 単語
  default: 200,
} as const;

export function estimateReadingTime(
  stats: TextStats,
  language: string,
): { minutes: number; label: string } {
  const lang = language.slice(0, 2).toLowerCase() as keyof typeof READING_SPEED;
  const speed = READING_SPEED[lang] ?? READING_SPEED.default;

  // CJK は文字数基準、英語は単語数基準
  const isCjk = ['ja', 'zh', 'ko'].includes(lang);
  const count = isCjk ? stats.charsNoSpace : stats.words;

  const minutes = Math.ceil(count / speed);

  const label = minutes < 1
    ? '1分未満'
    : minutes < 60
    ? `${minutes}分`
    : `${Math.floor(minutes / 60)}時間${minutes % 60}分`;

  return { minutes, label };
}
```

### 2.2 表示形式

```
1分未満 → "< 1分"
1〜59分 → "3分"
60分以上 → "1時間30分"
```

---

## 3. スペルチェック統合

### 3.1 アーキテクチャ

ブラウザの組み込みスペルチェック（`contenteditable` の `spellcheck` 属性）を
ベースとして使用し、追加カスタマイズを行う。

```typescript
// TipTap エディタに spellcheck を有効化
<EditorContent
  editor={editor}
  spellCheck={settings.spellCheck}
  lang={detectedLanguage}  // 言語ヒントを付与
/>
```

### 3.2 スペルチェックの範囲制御

コードブロック・数式・Front Matter 内ではスペルチェックを無効化する。

```typescript
// TipTap Extension でコードブロックに spellcheck=false を付与
const DisableSpellCheckInCode = Extension.create({
  name: 'disableSpellCheckInCode',
  addGlobalAttributes() {
    return [
      {
        types: ['codeBlock', 'code', 'mathInline', 'mathBlock'],
        attributes: {
          spellcheck: {
            default: 'false',
            renderHTML: () => ({ spellcheck: 'false' }),
          },
        },
      },
    ];
  },
});
```

### 3.3 カスタム辞書

ユーザー定義の単語リスト（技術用語・固有名詞）を辞書に追加できる。

```
コンテキストメニュー（赤い下線付き単語の右クリック）:
  → 「"tiptap" を辞書に追加」
```

```typescript
// カスタム辞書の保存
interface CustomDictionary {
  words: string[];
}

// @tauri-apps/plugin-store に保存
// キー: 'customDictionary'
```

ブラウザの組み込みスペルチェックはカスタム辞書を直接操作できないため、
`spellcheck=false` を付与してハイライトを消す方式で対応:

```typescript
// カスタム辞書に登録済み単語のハイライトを抑制する TipTap Mark
const CustomDictionaryMark = Mark.create({
  name: 'customWord',
  renderHTML: ({ HTMLAttributes }) => [
    'span',
    { ...HTMLAttributes, spellcheck: 'false' },
    0,
  ],
});
```

### 3.4 スペルチェック設定 UI

```
設定 → エディタ → スペルチェック

┌─────────────────────────────────────────────────────┐
│  スペルチェック                                       │
├─────────────────────────────────────────────────────┤
│  ☑ スペルチェックを有効にする                        │
│  □ 自動修正を有効にする                              │
│                                                     │
│  カスタム辞書:                                       │
│  ┌───────────────────────────────────────────────┐  │
│  │ tiptap                            [削除]      │  │
│  │ Mermaid                           [削除]      │  │
│  │ ProseMirror                       [削除]      │  │
│  └───────────────────────────────────────────────┘  │
│  [+ 単語を追加]                                      │
└─────────────────────────────────────────────────────┘
```

---

## 4. IME / CJK 入力最適化

### 4.1 IME 入力中の問題

TipTap / ProseMirror はデフォルトで IME 変換中（`compositionstart`〜`compositionend`）
の入力を適切に処理するが、いくつかの既知の問題がある。

| 問題 | 原因 | 対策 |
|------|------|------|
| IME 変換確定前に Markdown 変換が走る | `inputRule` が composing 中に発火 | `composing` フラグをチェック |
| 変換候補ウィンドウ位置がズレる | スクロールオフセット考慮漏れ | `getBoundingClientRect()` でキャレット位置を取得 |
| 変換確定時に Undo ステップが増える | 各変換候補が個別のトランザクションになる | `compositionend` まで Undo をまとめる |

### 4.2 InputRule の composing 対策

```typescript
// inputRule が IME 変換中に発火しないようにする
import { InputRule } from '@tiptap/core';

// カスタム InputRule: composing 中は無効
export function createSafeInputRule(config: InputRuleConfig): InputRule {
  return new InputRule({
    ...config,
    handler: ({ state, match, range }) => {
      // IME 変換中は処理しない
      if ((state as any).composing) return null;
      return config.handler({ state, match, range });
    },
  });
}
```

### 4.3 Undo のグルーピング

IME での変換一連をひとつの Undo ステップにまとめる。

```typescript
// TipTap の history extension 設定
import History from '@tiptap/extension-history';

const editor = useEditor({
  extensions: [
    History.configure({
      depth: 200,
      newGroupDelay: 500, // 500ms 以内の連続入力は1ステップにまとめる
    }),
  ],
});
```

### 4.4 中国語入力テスト

```
テストケース:
  1. Windows 11 + Microsoft IME（日本語）
  2. macOS + ことえり / Google 日本語入力
  3. Android + Gboard（日本語）
  4. iOS + 標準キーボード（日本語）
  5. Windows 11 + 中文（簡体字）Microsoft IME
```

各環境で以下を確認:
- [ ] 変換中に Markdown 記法が誤発火しない
- [ ] 変換確定後に正しく文書に反映される
- [ ] 変換中のテキストが適切にスタイリングされる（グレーアウト等）
- [ ] Undo で変換前の状態に戻れる

---

## 関連ドキュメント

- [editor-ux-design.md](./editor-ux-design.md) — エディタ UX 全般
- [ai-enhancements-design.md](./ai-enhancements-design.md) — 言語検出・AI 機能
- [cross-platform-design.md](./cross-platform-design.md) — プラットフォーム差異
- [mobile-advanced-design.md](./mobile-advanced-design.md) — モバイル固有の最適化
