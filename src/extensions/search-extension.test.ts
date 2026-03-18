/**
 * SearchExtension の純粋関数ユニットテスト
 *
 * findMatches (と内部の escapeRegex) の挙動を検証する。
 * ProseMirror ノードはシンプルなモックで代替する。
 */
import { describe, it, expect } from 'vitest';
import { findMatches, type SearchOptions } from './SearchExtension';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

// ─── ヘルパー ────────────────────────────────────────────────────────────────

/**
 * テキストノードのリストから ProseMirrorNode.descendants を模倣するモック doc を作る。
 * pos はドキュメント内の絶対オフセット（ProseMirrorの慣習に合わせてノードの開始位置）。
 */
function mockDoc(
  nodes: Array<{ text: string; pos: number }>
): ProseMirrorNode {
  return {
    descendants: (
      fn: (node: ProseMirrorNode, pos: number) => boolean | void
    ) => {
      for (const { text, pos } of nodes) {
        fn({ isText: true, text } as unknown as ProseMirrorNode, pos);
      }
    },
  } as unknown as ProseMirrorNode;
}

const defaultOptions: SearchOptions = {
  caseSensitive: false,
  wholeWord: false,
  regex: false,
};

// ─── 基本マッチ ──────────────────────────────────────────────────────────────

describe('findMatches', () => {
  it('空クエリでは空配列を返す', () => {
    const doc = mockDoc([{ text: 'Hello World', pos: 1 }]);
    expect(findMatches(doc, '', defaultOptions)).toEqual([]);
  });

  it('単純なテキストマッチ', () => {
    const doc = mockDoc([{ text: 'Hello World', pos: 1 }]);
    const matches = findMatches(doc, 'World', defaultOptions);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual({ from: 7, to: 12 }); // pos=1, index=6 → 1+6=7
  });

  it('複数マッチを正しく返す', () => {
    const doc = mockDoc([{ text: 'abc abc abc', pos: 1 }]);
    const matches = findMatches(doc, 'abc', defaultOptions);
    expect(matches).toHaveLength(3);
  });

  it('複数ノードにまたがるマッチ', () => {
    const doc = mockDoc([
      { text: 'Hello', pos: 1 },
      { text: 'World', pos: 10 },
    ]);
    const matches = findMatches(doc, 'World', defaultOptions);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual({ from: 10, to: 15 });
  });

  it('マッチがない場合は空配列を返す', () => {
    const doc = mockDoc([{ text: 'Hello World', pos: 1 }]);
    expect(findMatches(doc, 'xyz', defaultOptions)).toEqual([]);
  });

  // ─── 大文字小文字 ──────────────────────────────────────────────
  it('デフォルト（大文字小文字無視）で一致する', () => {
    const doc = mockDoc([{ text: 'Hello WORLD', pos: 1 }]);
    const matches = findMatches(doc, 'world', defaultOptions);
    expect(matches).toHaveLength(1);
  });

  it('caseSensitive=true では大文字小文字を区別する', () => {
    const doc = mockDoc([{ text: 'Hello WORLD', pos: 1 }]);
    const caseSensitive = { ...defaultOptions, caseSensitive: true };
    expect(findMatches(doc, 'world', caseSensitive)).toHaveLength(0);
    expect(findMatches(doc, 'WORLD', caseSensitive)).toHaveLength(1);
  });

  // ─── 単語単位検索 ───────────────────────────────────────────────
  it('wholeWord=true では部分マッチを除外する', () => {
    const doc = mockDoc([{ text: 'test testing tested', pos: 1 }]);
    const wholeWord = { ...defaultOptions, wholeWord: true };
    const matches = findMatches(doc, 'test', wholeWord);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual({ from: 1, to: 5 });
  });

  it('wholeWord=false では部分マッチを含む', () => {
    const doc = mockDoc([{ text: 'test testing tested', pos: 1 }]);
    const matches = findMatches(doc, 'test', defaultOptions);
    expect(matches).toHaveLength(3);
  });

  // ─── 正規表現モード ─────────────────────────────────────────────
  it('regex=true で正規表現マッチが動作する', () => {
    const doc = mockDoc([{ text: 'abc123def456', pos: 1 }]);
    const regexOptions = { ...defaultOptions, regex: true };
    const matches = findMatches(doc, '\\d+', regexOptions);
    expect(matches).toHaveLength(2);
  });

  it('regex=false では正規表現特殊文字をリテラルとして扱う', () => {
    const doc = mockDoc([{ text: 'a.b a*b a+b', pos: 1 }]);
    // '.' はエスケープされてリテラルになる
    const matches = findMatches(doc, 'a.b', defaultOptions);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual({ from: 1, to: 4 });
  });

  it('regex=true で無効な正規表現は空配列を返す（クラッシュしない）', () => {
    const doc = mockDoc([{ text: 'some text', pos: 1 }]);
    const regexOptions = { ...defaultOptions, regex: true };
    // '[invalid' は無効な正規表現
    expect(findMatches(doc, '[invalid', regexOptions)).toEqual([]);
  });

  // ─── 正規表現特殊文字のエスケープ（escapeRegex の間接テスト） ──
  it.each([
    ['.', 'a.b'],
    ['*', 'a*b'],
    ['+', 'a+b'],
    ['?', 'a?b'],
    ['^', 'a^b'],
    ['$', 'a$b'],
    ['(', 'a(b'],
    [')', 'a)b'],
    ['[', 'a[b'],
    ['{', 'a{b'],
    ['\\', 'a\\b'],
    ['|', 'a|b'],
  ])(
    'regex=false のとき "%s" を含むクエリでもクラッシュしない',
    (special, text) => {
      const doc = mockDoc([{ text, pos: 1 }]);
      expect(() => findMatches(doc, special, defaultOptions)).not.toThrow();
    }
  );

  // ─── 日本語テキスト ─────────────────────────────────────────────
  it('日本語テキストのマッチ', () => {
    const doc = mockDoc([{ text: 'これはテストです', pos: 1 }]);
    const matches = findMatches(doc, 'テスト', defaultOptions);
    expect(matches).toHaveLength(1);
  });

  // ─── 空テキストノード ───────────────────────────────────────────
  it('テキストが空のノードはスキップする', () => {
    const doc = mockDoc([
      { text: '', pos: 1 },
      { text: 'hello', pos: 5 },
    ]);
    const matches = findMatches(doc, 'hello', defaultOptions);
    expect(matches).toHaveLength(1);
  });
});
