/**
 * prose-lint.test.ts
 *
 * prose-lint.ts の全ルールに対する包括的テスト。
 * 各ルールについて:
 *  - 検出されるべきケース（典型例・複数マッチ）
 *  - 検出されないべきケース（正しい文体・コードブロック内・YAML FM）
 *  - エッジケース（空文字列・英語テキスト・非散文行）
 */

import { describe, it, expect } from 'vitest';
import {
  lintProse,
  checkSentenceLength,
  checkMixDearuDesumasu,
  checkWeakPhrase,
  checkRedundantExpression,
  checkDoubledWo,
  getFrontMatterEndLine,
  buildCodeBlockMask,
  removeInlineCode,
  MAX_SENTENCE_LENGTH,
  type ProseLintIssue,
} from './prose-lint';

// ─── ヘルパー ────────────────────────────────────────────────────

function makeLines(text: string): string[] {
  return text.split('\n');
}

function noIssues(issues: ProseLintIssue[]): void {
  expect(issues).toHaveLength(0);
}

function hasIssue(
  issues: ProseLintIssue[],
  ruleId: string,
  line: number,
): void {
  const found = issues.find((i) => i.ruleId === ruleId && i.line === line);
  expect(found, `Expected issue ${ruleId} at line ${line}`).toBeDefined();
}

// ─── getFrontMatterEndLine ───────────────────────────────────────

describe('getFrontMatterEndLine', () => {
  it('Front Matter なしの場合は 0 を返す', () => {
    expect(getFrontMatterEndLine(['# Title', '', 'text'])).toBe(0);
  });

  it('--- ... --- 形式を正しく検出する', () => {
    const lines = ['---', 'title: Test', 'date: 2024-01-01', '---', '# Body'];
    expect(getFrontMatterEndLine(lines)).toBe(4); // 5行目（0-based=4）から本文
  });

  it('--- ... ... 形式（ドット3つ）も受け付ける', () => {
    const lines = ['---', 'title: Test', '...', '# Body'];
    expect(getFrontMatterEndLine(lines)).toBe(3);
  });

  it('閉じタグがない場合は 0 を返す（Front Matter と見なさない）', () => {
    const lines = ['---', 'title: Test'];
    expect(getFrontMatterEndLine(lines)).toBe(0);
  });

  it('空の配列は 0 を返す', () => {
    expect(getFrontMatterEndLine([])).toBe(0);
  });
});

// ─── buildCodeBlockMask ──────────────────────────────────────────

describe('buildCodeBlockMask', () => {
  it('コードブロック内の行を true にマークする', () => {
    const lines = ['普通の行', '```typescript', 'const x = 1;', '```', '普通の行2'];
    const mask = buildCodeBlockMask(lines);
    expect(mask[0]).toBe(false);
    expect(mask[1]).toBe(true);  // フェンス行
    expect(mask[2]).toBe(true);  // コードブロック内
    expect(mask[3]).toBe(true);  // フェンス行
    expect(mask[4]).toBe(false);
  });

  it('複数のコードブロックを正しく処理する', () => {
    const lines = ['行1', '```', 'code1', '```', '行2', '```', 'code2', '```', '行3'];
    const mask = buildCodeBlockMask(lines);
    expect(mask[0]).toBe(false);
    expect(mask[1]).toBe(true);
    expect(mask[2]).toBe(true);
    expect(mask[3]).toBe(true);
    expect(mask[4]).toBe(false);
    expect(mask[5]).toBe(true);
    expect(mask[6]).toBe(true);
    expect(mask[7]).toBe(true);
    expect(mask[8]).toBe(false);
  });

  it('コードブロックなしは全て false', () => {
    const lines = ['行1', '行2'];
    const mask = buildCodeBlockMask(lines);
    expect(mask.every((v) => v === false)).toBe(true);
  });
});

// ─── removeInlineCode ────────────────────────────────────────────

describe('removeInlineCode', () => {
  it('インラインコードをスペースに置換する', () => {
    const result = removeInlineCode('これは`code`です');
    expect(result).toBe('これは      です'); // `code` = 6文字
  });

  it('複数のインラインコードを置換する', () => {
    const result = removeInlineCode('`a`と`b`の比較');
    expect(result.length).toBe('`a`と`b`の比較'.length);
    expect(result).not.toContain('a');
    expect(result).not.toContain('b');
  });

  it('インラインコードがない場合はそのまま返す', () => {
    expect(removeInlineCode('普通のテキスト')).toBe('普通のテキスト');
  });
});

// ─── SENT001: sentence-length ────────────────────────────────────

describe('SENT001: sentence-length', () => {
  const mask = (n: number) => new Array<boolean>(n).fill(false);

  it(`${MAX_SENTENCE_LENGTH}文字超の行に警告を出す`, () => {
    const longSentence = 'これは非常に長い文章です。' + 'あ'.repeat(101) + '。';
    const lines = [longSentence];
    const issues = checkSentenceLength(lines, mask(1), 0);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0].ruleId).toBe('SENT001');
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].line).toBe(1);
  });

  it(`${MAX_SENTENCE_LENGTH}文字以下の行は警告しない`, () => {
    const lines = ['短い文章です。'];
    noIssues(checkSentenceLength(lines, mask(1), 0));
  });

  it('複数の文がある行で長い文だけ検出する', () => {
    const shortSentence = '短い文です。';
    const longSentence = 'あ'.repeat(MAX_SENTENCE_LENGTH + 1) + '。';
    const lines = [shortSentence + longSentence];
    const issues = checkSentenceLength(lines, mask(1), 0);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('SENT001');
  });

  it('コードブロック内の長い行は無視する', () => {
    const lines = ['```', 'あ'.repeat(200), '```'];
    const codeMask = buildCodeBlockMask(lines);
    noIssues(checkSentenceLength(lines, codeMask, 0));
  });

  it('YAML Front Matter 内の長い行は無視する', () => {
    const fmEnd = 3;
    const lines = ['---', 'description: ' + 'あ'.repeat(100), '---', '短い文です。'];
    const codeMask = buildCodeBlockMask(lines);
    const issues = checkSentenceLength(lines, codeMask, fmEnd);
    noIssues(issues);
  });

  it('見出し行は無視する', () => {
    const lines = ['# ' + 'あ'.repeat(150)];
    noIssues(checkSentenceLength(lines, mask(1), 0));
  });

  it('空行は無視する', () => {
    const lines = [''];
    noIssues(checkSentenceLength(lines, mask(1), 0));
  });

  it('インラインコードを除外して長さを計測する', () => {
    // インラインコードを含む行：コードを除いたテキストが100字以下なら警告しない
    const code = '`' + 'x'.repeat(50) + '`';
    const text = 'あ'.repeat(60);
    const lines = [text + code]; // 実際の文字数は 60 + 52 = 112 だがコード除外後は 60
    const issues = checkSentenceLength(lines, mask(1), 0);
    noIssues(issues);
  });

  it('行番号が正しく報告される', () => {
    const lines = ['短い文。', 'あ'.repeat(MAX_SENTENCE_LENGTH + 1) + '。', '短い文。'];
    const issues = checkSentenceLength(lines, mask(3), 0);
    expect(issues[0].line).toBe(2);
  });
});

// ─── STYLE001: no-mix-dearu-desumasu ────────────────────────────

describe('STYLE001: no-mix-dearu-desumasu', () => {
  const mask = (n: number) => new Array<boolean>(n).fill(false);

  it('ですます調のみの文書は警告しない', () => {
    const lines = [
      'これはテストです。',
      '動作を確認しました。',
      '問題ありません。',
      '実装は完了しています。',
    ];
    noIssues(checkMixDearuDesumasu(lines, mask(lines.length), 0));
  });

  it('だ・である調のみの文書は警告しない', () => {
    const lines = [
      'これはテストである。',
      '動作を確認した。',
      '問題はない。',
      '実装は完了している。',
    ];
    noIssues(checkMixDearuDesumasu(lines, mask(lines.length), 0));
  });

  it('明確に混在する場合に少数派の行を警告する', () => {
    const lines = [
      'これはテストです。',      // ですます
      '動作を確認しました。',    // ですます
      '問題ありません。',        // ですます
      '実装は完了したのだ。',    // だ・である ← 少数派（「だ。」で終わる）
      '機能は正常に動いています。', // ですます
    ];
    const issues = checkMixDearuDesumasu(lines, mask(lines.length), 0);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues.every((i) => i.ruleId === 'STYLE001')).toBe(true);
    hasIssue(issues, 'STYLE001', 4); // だ・である調の行
  });

  it('少数派が 10% 未満の場合は警告しない（引用等の意図的混用）', () => {
    // だ・である調が 1/10 = 10% で境界値
    const lines = Array(9).fill('これはテストです。');
    lines.push('これは例外である。'); // 1/10 = 10% ちょうど → 境界値
    // 10% 未満なら警告なし → 9対1の場合は 1/10 = 10% なのでギリギリ警告あり
    // 実際には 10% 未満のケースを作るため 1/11 のケースを使う
    const lines2 = Array(10).fill('これはテストです。');
    lines2.push('これは例外である。'); // 1/11 ≈ 9% → 10% 未満
    const issues = checkMixDearuDesumasu(lines2, mask(lines2.length), 0);
    noIssues(issues);
  });

  it('コードブロック内の文体は判定対象外', () => {
    const lines = [
      'これはテストです。',
      '問題ありません。',
      '```',
      'これは例外である。', // コードブロック内
      '```',
    ];
    const codeMask = buildCodeBlockMask(lines);
    noIssues(checkMixDearuDesumasu(lines, codeMask, 0));
  });

  it('YAML Front Matter 内の文体は判定対象外', () => {
    const fmEnd = 3;
    const lines = [
      '---',
      'description: これは説明である。',
      '---',
      'これはテストです。',
      '問題ありません。',
    ];
    const codeMask = buildCodeBlockMask(lines);
    noIssues(checkMixDearuDesumasu(lines, codeMask, fmEnd));
  });

  it('見出し行は判定対象外', () => {
    const lines = [
      '# だ・である調の見出し',
      'これはテストです。',
      'これも問題ありません。',
    ];
    noIssues(checkMixDearuDesumasu(lines, mask(lines.length), 0));
  });

  it('報告件数は最大 5 件', () => {
    // だ・である調が多数、ですます調が少数（7件）
    const dearuLines = Array(10).fill('これは説明である。');
    const desumasuLines = [
      '一つ目です。',
      '二つ目です。',
      '三つ目です。',
      '四つ目です。',
      '五つ目です。',
      '六つ目です。',
      '七つ目です。',
    ];
    const lines = [...dearuLines, ...desumasuLines];
    const issues = checkMixDearuDesumasu(lines, mask(lines.length), 0);
    expect(issues.length).toBeLessThanOrEqual(5);
  });
});

// ─── STYLE002: ja-no-weak-phrase ─────────────────────────────────

describe('STYLE002: ja-no-weak-phrase', () => {
  const mask = (n: number) => new Array<boolean>(n).fill(false);

  it('「かもしれません」を検出する', () => {
    const lines = ['問題があるかもしれません。'];
    const issues = checkWeakPhrase(lines, mask(1), 0);
    hasIssue(issues, 'STYLE002', 1);
  });

  it('「かもしれない」を検出する', () => {
    const lines = ['問題があるかもしれない。'];
    const issues = checkWeakPhrase(lines, mask(1), 0);
    hasIssue(issues, 'STYLE002', 1);
  });

  it('「と思います」を検出する', () => {
    const lines = ['これが原因だと思います。'];
    const issues = checkWeakPhrase(lines, mask(1), 0);
    hasIssue(issues, 'STYLE002', 1);
  });

  it('「と思われます」を検出する', () => {
    const lines = ['これが最善策だと思われます。'];
    const issues = checkWeakPhrase(lines, mask(1), 0);
    hasIssue(issues, 'STYLE002', 1);
  });

  it('「と思う」を検出する', () => {
    const lines = ['これが原因だと思う。'];
    const issues = checkWeakPhrase(lines, mask(1), 0);
    hasIssue(issues, 'STYLE002', 1);
  });

  it('「ではないでしょうか」を検出する', () => {
    const lines = ['これは問題ではないでしょうか。'];
    const issues = checkWeakPhrase(lines, mask(1), 0);
    hasIssue(issues, 'STYLE002', 1);
  });

  it('「ような気がします」を検出する', () => {
    const lines = ['効果があるような気がします。'];
    const issues = checkWeakPhrase(lines, mask(1), 0);
    hasIssue(issues, 'STYLE002', 1);
  });

  it('「ような気がする」を検出する', () => {
    const lines = ['効果があるような気がする。'];
    const issues = checkWeakPhrase(lines, mask(1), 0);
    hasIssue(issues, 'STYLE002', 1);
  });

  it('弱い表現を含まない行は検出しない', () => {
    const lines = ['この実装はメモリ効率が高い。', 'テストが全て通過した。'];
    noIssues(checkWeakPhrase(lines, mask(2), 0));
  });

  it('コードブロック内の弱い表現は検出しない', () => {
    const lines = [
      '```',
      'const message = "これは問題かもしれない";',
      '```',
    ];
    const codeMask = buildCodeBlockMask(lines);
    noIssues(checkWeakPhrase(lines, codeMask, 0));
  });

  it('インラインコード内の弱い表現は検出しない', () => {
    const lines = ['関数 `isProblematic()` を呼び出します。'];
    noIssues(checkWeakPhrase(lines, mask(1), 0));
  });

  it('YAML Front Matter 内の弱い表現は検出しない', () => {
    const fmEnd = 3;
    const lines = ['---', 'description: 問題があるかもしれない', '---', '正常な文章です。'];
    noIssues(checkWeakPhrase(lines, buildCodeBlockMask(lines), fmEnd));
  });

  it('複数の弱い表現を含む行は複数件報告する', () => {
    const lines = ['これはかもしれないし、また問題だと思います。'];
    const issues = checkWeakPhrase(lines, mask(1), 0);
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });

  it('複数行にわたる場合は正しい行番号を報告する', () => {
    const lines = ['正常な文章です。', 'これは問題かもしれません。'];
    const issues = checkWeakPhrase(lines, mask(2), 0);
    expect(issues[0].line).toBe(2);
  });

  it('列番号が正しく報告される', () => {
    const lines = ['これは問題かもしれない。'];
    const issues = checkWeakPhrase(lines, mask(1), 0);
    expect(issues[0].column).toBe('これは問題'.length + 1); // 「かもしれない」の開始位置
  });
});

// ─── STYLE003: ja-no-redundant-expression ────────────────────────

describe('STYLE003: ja-no-redundant-expression', () => {
  const mask = (n: number) => new Array<boolean>(n).fill(false);

  it('「ことができる」を検出する', () => {
    const lines = ['ファイルを読み込むことができる。'];
    const issues = checkRedundantExpression(lines, mask(1), 0);
    hasIssue(issues, 'STYLE003', 1);
    expect(issues[0].suggestion).toBeDefined();
  });

  it('「ことができます」を検出する', () => {
    const lines = ['ファイルを読み込むことができます。'];
    const issues = checkRedundantExpression(lines, mask(1), 0);
    hasIssue(issues, 'STYLE003', 1);
  });

  it('「を行う」を検出する', () => {
    const lines = ['データの変換を行う。'];
    const issues = checkRedundantExpression(lines, mask(1), 0);
    hasIssue(issues, 'STYLE003', 1);
  });

  it('「を行います」を検出する', () => {
    const lines = ['データの変換を行います。'];
    const issues = checkRedundantExpression(lines, mask(1), 0);
    hasIssue(issues, 'STYLE003', 1);
  });

  it('「という形で」を検出する', () => {
    const lines = ['設定ファイルという形で管理します。'];
    const issues = checkRedundantExpression(lines, mask(1), 0);
    hasIssue(issues, 'STYLE003', 1);
  });

  it('「ということになります」を検出する', () => {
    const lines = ['結果的に問題ということになります。'];
    const issues = checkRedundantExpression(lines, mask(1), 0);
    hasIssue(issues, 'STYLE003', 1);
  });

  it('「という点において」を検出する', () => {
    const lines = ['パフォーマンスという点において優れています。'];
    const issues = checkRedundantExpression(lines, mask(1), 0);
    hasIssue(issues, 'STYLE003', 1);
  });

  it('「という点について」を検出する', () => {
    const lines = ['パフォーマンスという点について説明します。'];
    const issues = checkRedundantExpression(lines, mask(1), 0);
    hasIssue(issues, 'STYLE003', 1);
  });

  it('冗長表現を含まない行は検出しない', () => {
    const lines = ['データを変換する。', '処理が完了しました。'];
    noIssues(checkRedundantExpression(lines, mask(2), 0));
  });

  it('コードブロック内の冗長表現は検出しない', () => {
    const lines = ['```javascript', '// この処理を行うことができる', '```'];
    const codeMask = buildCodeBlockMask(lines);
    noIssues(checkRedundantExpression(lines, codeMask, 0));
  });

  it('インラインコード内の冗長表現は検出しない', () => {
    const lines = ['関数 `doSomething()` を呼び出します。'];
    noIssues(checkRedundantExpression(lines, mask(1), 0));
  });

  it('YAML Front Matter 内の冗長表現は検出しない', () => {
    const fmEnd = 4;
    const lines = [
      '---',
      'title: データの変換を行う方法',
      'description: 冗長表現の例',
      '---',
      'シンプルな文章です。',
    ];
    noIssues(checkRedundantExpression(lines, buildCodeBlockMask(lines), fmEnd));
  });

  it('全パターンに suggestion が設定されている', () => {
    const texts = [
      'ことができる。',
      'を行う。',
      'という形で。',
      'ということになります。',
      'という点において。',
    ];
    for (const text of texts) {
      const lines = [`テスト文章 ${text} テスト。`];
      const issues = checkRedundantExpression(lines, mask(1), 0);
      expect(issues.length).toBeGreaterThanOrEqual(1);
      expect(issues[0].suggestion).toBeDefined();
      expect(issues[0].suggestion!.length).toBeGreaterThan(0);
    }
  });

  it('同じ行に複数の冗長表現がある場合は複数件報告する', () => {
    const lines = ['この処理を行うことができます。'];
    const issues = checkRedundantExpression(lines, mask(1), 0);
    // 「を行う」「ことができます」の両方を検出
    expect(issues.length).toBeGreaterThanOrEqual(2);
    const ruleIds = issues.map((i) => i.ruleId);
    expect(ruleIds.every((id) => id === 'STYLE003')).toBe(true);
  });
});

// ─── STYLE004: no-doubled-wo ─────────────────────────────────────

describe('STYLE004: no-doubled-wo', () => {
  const mask = (n: number) => new Array<boolean>(n).fill(false);

  it('一文内で「を」が 15 文字以内に 2 回ある場合を検出する', () => {
    const lines = ['本を図書館を借りた。'];
    const issues = checkDoubledWo(lines, mask(1), 0);
    hasIssue(issues, 'STYLE004', 1);
    expect(issues[0].severity).toBe('warning');
  });

  it('「を」の間隔が 16 文字以上の場合は検出しない', () => {
    const lines = ['この本をとても長い解説文章の後に続けて図書館を返却した。'];
    // 「本を」から「館を」の間が長い場合はスキップ
    const issues = checkDoubledWo(lines, mask(1), 0);
    // 間隔によっては検出されないことを確認（この文は「を」が遠い）
    // 文字数を数えると: 「この本を」(4) 「とても長い解説文章の後に続けて図書館を」(19文字超)
    // 19 > 15 なので検出されないはず
    noIssues(issues);
  });

  it('を が 1 回しかない文は検出しない', () => {
    const lines = ['本を読んだ。'];
    noIssues(checkDoubledWo(lines, mask(1), 0));
  });

  it('コードブロック内は検出しない', () => {
    const lines = ['```', 'list.filter(x => x.startsWith("a")).map(x => x.trim())', '```'];
    const codeMask = buildCodeBlockMask(lines);
    noIssues(checkDoubledWo(lines, codeMask, 0));
  });

  it('YAML Front Matter 内は検出しない', () => {
    const fmEnd = 3;
    const lines = ['---', 'title: 本を図書館を借りる', '---', '正常な文章。'];
    noIssues(checkDoubledWo(lines, buildCodeBlockMask(lines), fmEnd));
  });

  it('見出し行は検出しない', () => {
    const lines = ['# 本を図書館を借りる方法'];
    noIssues(checkDoubledWo(lines, mask(1), 0));
  });

  it('文をまたいだ「を」は検出しない（別の文なので正常）', () => {
    const lines = ['本を読んだ。次に映画を観た。'];
    noIssues(checkDoubledWo(lines, mask(1), 0));
  });

  it('同じ文で 1 件だけ報告する（重複報告しない）', () => {
    const lines = ['本を図書館を返却をした。']; // を が 3 回
    const issues = checkDoubledWo(lines, mask(1), 0);
    expect(issues.length).toBe(1); // 同じ文で複数あっても 1 件
  });

  it('正しい行番号を報告する', () => {
    const lines = ['正常な文章。', '本を図書館を借りた。', '正常な文章。'];
    const issues = checkDoubledWo(lines, mask(3), 0);
    expect(issues[0].line).toBe(2);
  });
});

// ─── lintProse（統合テスト） ─────────────────────────────────────

describe('lintProse（統合テスト）', () => {
  it('空文字列は空の結果を返す', () => {
    const result = lintProse('');
    expect(result.issues).toHaveLength(0);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.infoCount).toBe(0);
  });

  it('スペースのみは空の結果を返す', () => {
    const result = lintProse('   \n\n   ');
    expect(result.issues).toHaveLength(0);
  });

  it('問題のない文章は何も報告しない', () => {
    const result = lintProse(`# テストドキュメント

これはテストです。
問題のない短い文章です。
別の行です。
`);
    expect(result.issues).toHaveLength(0);
  });

  it('複数のルール違反をまとめて検出する', () => {
    const markdown = `# タイトル

この処理を行うことができると思います。
`;
    const result = lintProse(markdown);
    // 「を行うことができます」(STYLE003) + 「と思います」(STYLE002) が期待される
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
    const ruleIds = result.issues.map((i) => i.ruleId);
    expect(ruleIds).toContain('STYLE002');
    expect(ruleIds).toContain('STYLE003');
  });

  it('結果は行番号でソートされている', () => {
    const markdown = `この処理を行うことができる。
短い文。
これは問題かもしれない。
`;
    const result = lintProse(markdown);
    for (let i = 1; i < result.issues.length; i++) {
      expect(result.issues[i].line).toBeGreaterThanOrEqual(result.issues[i - 1].line);
    }
  });

  it('errorCount, warningCount, infoCount が正確に集計される', () => {
    const result = lintProse('この処理を行うことができると思います。');
    expect(result.errorCount).toBe(0); // エラーは出ない
    expect(result.warningCount + result.infoCount).toBe(result.issues.length);
    // severity の内訳が一致
    expect(result.warningCount).toBe(
      result.issues.filter((i) => i.severity === 'warning').length,
    );
    expect(result.infoCount).toBe(
      result.issues.filter((i) => i.severity === 'info').length,
    );
  });

  it('YAML Front Matter + コードブロックを含む実用的なドキュメント', () => {
    const markdown = `---
title: テスト記事
description: これはテスト
---

# はじめに

これは短い導入文です。

## 実装方法

\`\`\`typescript
// この処理を行うことができる（コードブロック内は無視）
const result = await processData();
\`\`\`

データを処理します。

## まとめ

以上が実装方法です。
`;
    const result = lintProse(markdown);
    // YAML FM とコードブロック内の冗長表現は報告されないはず
    const redundantIssues = result.issues.filter((i) => i.ruleId === 'STYLE003');
    expect(redundantIssues).toHaveLength(0);
  });

  it('英語のみのテキストで日本語ルールは誤検知しない', () => {
    const result = lintProse(`# English Only Document

This is a test document.
It contains only English text.
No Japanese characters at all.
`);
    // 英語テキストには日本語ルールはほぼ反応しない
    // SENT001 は文字数で反応する可能性があるが、この文章は短い
    expect(result.issues.length).toBe(0);
  });
});
