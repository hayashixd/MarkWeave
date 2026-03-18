/**
 * AI出力パターン ラウンドトリップテスト
 *
 * Claude / OpenAI が生成する典型的な Markdown 出力が
 * markdownToTipTap → tiptapToMarkdown を経て冪等に往復することを検証する。
 *
 * 検証方法:
 *   - 各入力に末尾改行を付けた状態で比較（tiptapToMarkdown は末尾改行を出力する）
 *   - テーブルは意図的に正規化されるため、expected に正規化済み形式を使用
 *
 * 実機確認: npx tsx src/__rt_probe.ts で全パターンを事前検証済み（2025-03-18）
 */
import { describe, it, expect } from 'vitest';
import { markdownToTipTap } from '../markdown-to-tiptap';
import { tiptapToMarkdown } from '../tiptap-to-markdown';

/** 末尾改行を保証して往復検証 */
function expectRoundtrip(markdown: string): void {
  const normalized = markdown.endsWith('\n') ? markdown : markdown + '\n';
  const doc = markdownToTipTap(normalized);
  const output = tiptapToMarkdown(doc);
  expect(output).toBe(normalized);
}

/** 入力と期待値が異なる場合（意図的な正規化）の検証 */
function expectNormalized(input: string, expected: string): void {
  const expectedN = expected.endsWith('\n') ? expected : expected + '\n';
  const doc = markdownToTipTap(input);
  const output = tiptapToMarkdown(doc);
  expect(output).toBe(expectedN);
}

// ── 1. 日本語段落（基本） ─────────────────────────────────────────────────────

describe('ai-output roundtrip: 日本語段落', () => {
  it('シンプルな日本語段落', () => {
    expectRoundtrip('日本語のテスト段落です。');
  });

  it('複数の日本語段落', () => {
    expectRoundtrip('段落1\n\n段落2\n\n段落3');
  });

  it('長い日本語段落（200文字以上）', () => {
    expectRoundtrip('これは非常に長い段落です。'.repeat(10));
  });

  it('日英混在テキスト', () => {
    expectRoundtrip('この関数は`Array.from()`を使用して変換します。');
  });
});

// ── 2. 見出し ─────────────────────────────────────────────────────────────────

describe('ai-output roundtrip: 見出し', () => {
  it('H1 見出し + 段落', () => {
    expectRoundtrip('# 見出し1\n\n段落テキスト。');
  });

  it('複数レベルの見出し', () => {
    expectRoundtrip('# 見出し1\n\n段落テキスト。\n\n## 見出し2\n\n段落2。');
  });
});

// ── 3. インライン装飾 ─────────────────────────────────────────────────────────

describe('ai-output roundtrip: インライン装飾', () => {
  it('太字', () => {
    expectRoundtrip('**太字テキスト**が含まれます。');
  });

  it('イタリック', () => {
    expectRoundtrip('*イタリックテキスト*が含まれます。');
  });

  it('インラインコード', () => {
    expectRoundtrip('`useState`フックを使って状態を管理します。');
  });

  it('打ち消し線', () => {
    expectRoundtrip('~~削除されたテキスト~~');
  });

  it('太字・イタリック・コードの混在', () => {
    expectRoundtrip('**太字**と*イタリック*と`インラインコード`。');
  });

  it('AI校正の変更前後パターン', () => {
    expectRoundtrip('**修正前:** この実装は効率的ではない。\n\n**修正後:** この実装は非効率です。');
  });
});

// ── 4. コードブロック ─────────────────────────────────────────────────────────

describe('ai-output roundtrip: コードブロック', () => {
  it('TypeScript コードブロック', () => {
    expectRoundtrip(
      '```typescript\nfunction greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n```',
    );
  });

  it('言語指定なしコードブロック', () => {
    expectRoundtrip('```\necho "hello"\n```');
  });

  it('説明文 + コードブロック（AI出力典型パターン）', () => {
    expectRoundtrip(
      '修正後のコードです。\n\n```javascript\nconsole.log("hello");\n```\n\n上記のように変更してください。',
    );
  });

  it('複数コードブロック', () => {
    expectRoundtrip(
      '**変更前:**\n\n```javascript\nvar x = 1;\n```\n\n**変更後:**\n\n```javascript\nconst x = 1;\n```',
    );
  });
});

// ── 5. リスト ─────────────────────────────────────────────────────────────────

describe('ai-output roundtrip: リスト', () => {
  it('順序なしリスト', () => {
    expectRoundtrip('- 項目1\n- 項目2\n- 項目3');
  });

  it('順序ありリスト', () => {
    expectRoundtrip('1. 最初\n2. 次\n3. 最後');
  });

  it('ネストしたリスト', () => {
    expectRoundtrip('- 親1\n  - 子1\n  - 子2\n- 親2');
  });

  it('タスクリスト', () => {
    expectRoundtrip('- [x] 完了タスク\n- [ ] 未完タスク');
  });

  it('AI提案の番号付きリスト', () => {
    expectRoundtrip('改善点は以下のとおりです。\n\n1. より簡潔な表現に変更\n2. 文体を統一\n3. 誤字を修正');
  });
});

// ── 6. 引用ブロック ───────────────────────────────────────────────────────────

describe('ai-output roundtrip: 引用ブロック', () => {
  it('シンプルな引用', () => {
    expectRoundtrip('> これは引用です。');
  });

  it('複数行の引用', () => {
    expectRoundtrip('> これは引用です。\n>\n> 複数行の引用。');
  });
});

// ── 7. 数式 ───────────────────────────────────────────────────────────────────

describe('ai-output roundtrip: 数式', () => {
  it('インライン数式', () => {
    expectRoundtrip('コスト関数は$f(x) = x^2$で表されます。');
  });

  it('ブロック数式', () => {
    expectRoundtrip('$$\nE = mc^2\n$$');
  });
});

// ── 8. その他 ─────────────────────────────────────────────────────────────────

describe('ai-output roundtrip: その他要素', () => {
  it('水平線', () => {
    expectRoundtrip('---');
  });

  it('リンク', () => {
    expectRoundtrip('[Zenn](https://zenn.dev) はMarkdownで記事が書けます。');
  });

  it('画像', () => {
    expectRoundtrip('![説明](./images/sample.png)');
  });
});

// ── 9. テーブル（正規化あり） ─────────────────────────────────────────────────

describe('ai-output roundtrip: テーブル（正規化）', () => {
  /**
   * テーブルはセパレータ行・セル幅が正規化される（既知の動作）
   * 入力: |-----|-----| → 出力: | --- | --- |
   * 入力: | A   | B   | → 出力: | A | B |
   *
   * テストでは正規化済みの形式を expected として使用する。
   */
  it('正規化済みテーブル形式はそのまま往復する', () => {
    expectRoundtrip('| 列1 | 列2 |\n| --- | --- |\n| A | B |\n| C | D |');
  });

  it('パディング付きテーブルは正規化される（既知の動作）', () => {
    expectNormalized(
      '| 列1 | 列2 |\n|-----|-----|\n| A   | B   |\n| C   | D   |',
      '| 列1 | 列2 |\n| --- | --- |\n| A | B |\n| C | D |',
    );
  });

  it('3列テーブル', () => {
    expectRoundtrip('| 名前 | 型 | 説明 |\n| --- | --- | --- |\n| id | string | ID |\n| name | string | 名前 |');
  });
});

// ── 10. AI出力の複合パターン ──────────────────────────────────────────────────

describe('ai-output roundtrip: 複合パターン', () => {
  it('見出し + リスト + コードブロック', () => {
    expectRoundtrip(
      '## 変更点\n\n以下を修正しました。\n\n- 型定義を追加\n- エラー処理を改善\n\n```typescript\ntype Result = { ok: boolean };\n```',
    );
  });

  it('AI校正レポートの典型構造', () => {
    expectRoundtrip(
      '元のテキスト：「この実装は効率的ではない。」\n\n修正後：「この実装は非効率です。」\n\n**変更点：**\n\n1. より簡潔な表現に変更\n2. 文体を統一',
    );
  });

  it('技術記事AI補完パターン（見出し + 段落 + コード）', () => {
    expectRoundtrip(
      '# TypeScript の型推論\n\nTypeScript は変数の型を自動的に推論します。\n\n```typescript\nconst x = 42; // number と推論される\n```\n\n上記の例では`x`は`number`型として扱われます。',
    );
  });
});
