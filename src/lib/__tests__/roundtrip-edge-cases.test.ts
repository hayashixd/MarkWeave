/**
 * MCP 実機検証で発見したラウンドトリップのエッジケース・既知バグ・正規化動作テスト
 *
 * 発見日: 2026-03-18
 * 発見方法: mcp__test-automation__roundtrip_check による実機検証
 *
 * ファイルの構成:
 *  1. ✅ 修正済みバグの回帰テスト（2026-03-18 修正）
 *  2. 🟡 既知の正規化動作 — 意味は同一、表記のみ変換される（回帰防止）
 *  3. ✅ 正常動作の追加確認 — 既存テストにない記法が正しく動くことを確認
 */

import { describe, it, expect } from 'vitest';
import { markdownToTipTap } from '../markdown-to-tiptap';
import { tiptapToMarkdown } from '../tiptap-to-markdown';

function roundtrip(markdown: string): string {
  return tiptapToMarkdown(markdownToTipTap(markdown));
}

function expectRoundtrip(markdown: string): void {
  expect(roundtrip(markdown)).toBe(markdown);
}

function expectNormalized(input: string, expected: string): void {
  expect(roundtrip(input)).toBe(expected);
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 既知バグ — 修正後に GREEN になる
// ─────────────────────────────────────────────────────────────────────────────

describe('roundtrip: 下付き文字（修正済み: singleTilde: false）', () => {
  /**
   * FIX (2026-03-18): remarkGfm({ singleTilde: false }) により
   *   ~text~ が strikethrough に化けなくなった。
   *   plain text として通過するためラウンドトリップする。
   */
  it('下付き文字 ~text~ がラウンドトリップ後も ~text~ のまま保たれる', () => {
    expectRoundtrip('H~2~O は水の化学式。CO~2~ は二酸化炭素。\n');
  });

  it('下付き文字のみの行がラウンドトリップで壊れない', () => {
    expectRoundtrip('~下付き~\n');
  });

  it('上付き・下付きの混在がそれぞれ保たれる', () => {
    expectRoundtrip('x^2^ + H~2~O\n');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🟡 既知の正規化動作（意味は同一・表記のみ変換）
// ─────────────────────────────────────────────────────────────────────────────

describe('roundtrip: 🟡 正規化動作（意味等価・表記変換）', () => {
  /**
   * 水平線バリエーション: ***, ___ は --- に統一される
   * 理由: TipTap は horizontalRule ノード1種類のみ持つため、
   *       シリアライズ時は常に --- を出力する。
   */
  describe('水平線の正規化', () => {
    it('*** は --- に正規化される', () => {
      expectNormalized('***\n', '---\n');
    });

    it('___ は --- に正規化される', () => {
      expectNormalized('___\n', '---\n');
    });

    it('--- はそのまま保たれる（正規形）', () => {
      expectRoundtrip('---\n');
    });

    it('文書中の *** も --- に正規化される', () => {
      expectNormalized(
        '# Section 1\n\n***\n\n# Section 2\n',
        '# Section 1\n\n---\n\n# Section 2\n',
      );
    });
  });

  /**
   * テーブルセパレーター: |---| は | --- | に正規化される
   * 理由: tiptap-to-markdown のシリアライザーが常にスペース付き形式を出力する。
   * 意味: 列幅の指定なし（左揃え相当）は同一。
   */
  describe('テーブルセパレーターの正規化', () => {
    it('|---| セパレーターは | --- | に正規化される', () => {
      expectNormalized(
        '| Col |\n|---|\n| val |\n',
        '| Col |\n| --- |\n| val |\n',
      );
    });

    it('|-----| など長い破線も | --- | に正規化される', () => {
      expectNormalized(
        '| A | B |\n|-----|-----|\n| 1 | 2 |\n',
        '| A | B |\n| --- | --- |\n| 1 | 2 |\n',
      );
    });

    it('| --- | 形式はそのまま保たれる（正規形）', () => {
      expectRoundtrip('| Col |\n| --- |\n| val |\n');
    });

    it('整列指定 :--- / :---: / ---: は保たれる', () => {
      expectRoundtrip('| L | C | R |\n| :--- | :---: | ---: |\n| a | b | c |\n');
    });
  });

  /**
   * インデントコードブロック: 4スペースインデント → フェンスドコードブロックに変換
   * 理由: TipTap の codeBlock ノードはフェンスド形式で出力される。
   * 意味: 内容は同一（インデントが除去されて言語なしフェンスドになる）。
   */
  describe('インデントコードブロックの正規化', () => {
    it('4スペースインデントコードは ``` フェンスドに変換される', () => {
      expectNormalized(
        '    code line 1\n    code line 2\n',
        '```\ncode line 1\ncode line 2\n```\n',
      );
    });

    it('日本語を含むインデントコードも変換される', () => {
      expectNormalized(
        '    // 日本語コメント\n    const x = 1;\n',
        '```\n// 日本語コメント\nconst x = 1;\n```\n',
      );
    });
  });

  /**
   * 連続見出しへの空行挿入
   * 理由: ProseMirror はブロックノード間に段落区切りを必要とする。
   *       空行なしの連続見出しは保存時に空行が挿入される。
   */
  describe('連続見出しへの空行挿入', () => {
    it('空行なしの連続見出しに空行が挿入される', () => {
      expectNormalized(
        '# H1\n## H2\n### H3\n',
        '# H1\n\n## H2\n\n### H3\n',
      );
    });

    it('空行ありの連続見出しはそのまま（正規形）', () => {
      expectRoundtrip('# H1\n\n## H2\n\n### H3\n');
    });
  });

  /**
   * 参照形式リンクのインライン形式への正規化（修正済み: 2026-03-18）
   * 理由: markdown-to-tiptap が linkReference を inline link に解決する。
   *       definition ノードは出力から除去（_linkDefs に吸収）。
   * 意味: リンクのテキスト・URL・タイトルは完全に保持される。
   */
  describe('参照形式リンクの正規化（データロスなし）', () => {
    it('参照形式リンクがインライン形式に正規化される', () => {
      expectNormalized(
        '[参照リンク][ref]\n\n[ref]: https://example.com\n',
        '[参照リンク](https://example.com)\n',
      );
    });

    it('タイトル付き参照形式リンクがインライン形式に正規化される', () => {
      expectNormalized(
        '[リンク][ref]\n\n[ref]: https://example.com "タイトル"\n',
        '[リンク](https://example.com "タイトル")\n',
      );
    });

    it('番号参照リンクがインライン形式に正規化される', () => {
      expectNormalized(
        '[リンク][1]\n\n[1]: https://example.com\n',
        '[リンク](https://example.com)\n',
      );
    });
  });

  /**
   * 脚注定義間の空行挿入
   * 理由: tiptap-to-markdown が脚注定義を段落として出力する。
   * 意味: 脚注の内容は同一。
   */
  describe('脚注定義間の空行挿入', () => {
    it('空行なし連続脚注定義に空行が挿入される', () => {
      expectNormalized(
        'テキスト[^1]と[^note]。\n\n[^1]: 番号付き脚注\n[^note]: 名前付き脚注\n',
        'テキスト[^1]と[^note]。\n\n[^1]: 番号付き脚注\n\n[^note]: 名前付き脚注\n',
      );
    });

    it('空行ありの脚注定義はそのまま（正規形）', () => {
      expectRoundtrip('最初の脚注[^1]と二番目の脚注[^2]。\n\n[^1]: 一番目\n\n[^2]: 二番目\n');
    });
  });

  /**
   * HTML ブロックの除去
   * 理由: TipTap は raw HTML ブロックをサポートしない（セキュリティ・WYSIWYG の制約）。
   * 動作: HTML ブロック全体が出力から消える（意図的な動作）。
   */
  describe('HTML ブロックの除去（意図的動作）', () => {
    it('<div> ブロックは除去される', () => {
      expectNormalized(
        '<div class="custom">\nHTMLブロック\n</div>\n\n通常テキスト\n',
        '\n\n通常テキスト\n',
      );
    });

    it('インライン HTML タグを含む段落は安全にテキスト化される', () => {
      // インライン <span> は remark が除去するか保持するか確認
      const output = roundtrip('<span>インライン</span>テキスト\n');
      // 内容（テキスト部分）が失われないこと
      expect(output).toContain('テキスト');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ✅ 正常動作の追加確認（既存テストにない記法）
// ─────────────────────────────────────────────────────────────────────────────

describe('roundtrip: ✅ 正常動作の追加確認', () => {
  describe('拡張インラインマークアップ', () => {
    it('取り消し線 ~~ は正しくラウンドトリップする', () => {
      expectRoundtrip('~~取り消し線テキスト~~\n');
    });

    it('上付き文字 ^text^ は plain text として保たれる', () => {
      // remark が ^ を特殊記号として解析しないため plain text として通過
      expectRoundtrip('x^2^ + y^2^ = r^2^\n');
    });

    it('ハイライト ==text== はラウンドトリップする', () => {
      expectRoundtrip('==ハイライトテキスト==\n');
    });
  });

  describe('数式', () => {
    it('ブロック数式 $$ はラウンドトリップする', () => {
      expectRoundtrip('$$\nE = mc^2\n$$\n');
    });

    it('インライン数式 $ はラウンドトリップする', () => {
      expectRoundtrip('インライン $x = \\frac{a}{b}$ 数式\n');
    });

    it('複雑な LaTeX 式がラウンドトリップする', () => {
      expectRoundtrip('$$\n\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}\n$$\n');
    });
  });

  describe('チェックリスト（タスクリスト）', () => {
    it('完了・未完了タスクがラウンドトリップする', () => {
      expectRoundtrip('- [x] 完了タスク\n- [ ] 未完了タスク\n');
    });

    it('日本語タスク項目がラウンドトリップする', () => {
      expectRoundtrip('- [x] 完了\n- [ ] 未完了\n- [x] **太字**のタスク\n');
    });
  });

  describe('ネスト引用', () => {
    it('ネストした blockquote がラウンドトリップする', () => {
      expectRoundtrip('> 外側\n>\n> > ネスト\n> > 2行目\n>\n> 外側に戻る\n');
    });

    it('引用内の強調がラウンドトリップする', () => {
      expectRoundtrip('> 引用内の**太字**と`コード`\n');
    });
  });

  describe('ハードラインブレーク', () => {
    it('行末スペース2つのハードラインブレークが保たれる', () => {
      expectRoundtrip('テキスト  \n改行後\n');
    });
  });

  describe('複合: 日本語を含む複雑なドキュメント', () => {
    it('日本語見出し・リスト・コードブロックの複合ドキュメントがラウンドトリップする', () => {
      const md = [
        '# 日本語タイトル',
        '',
        '**太字**と*斜体*が混在するパラグラフ。',
        '',
        '## セクション',
        '',
        '- リスト項目１',
        '- リスト項目２（**太字**を含む）',
        '',
        '```typescript',
        '// 日本語コメント',
        'const x: string = "テスト";',
        '```',
        '',
        '| 列A | 列B |',
        '| --- | --- |',
        '| 値1 | 値2 |',
        '',
      ].join('\n');
      expectRoundtrip(md);
    });
  });
});
