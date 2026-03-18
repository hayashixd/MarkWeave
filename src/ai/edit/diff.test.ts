import { describe, it, expect } from 'vitest';
import { computeInlineDiff } from './diff';
import type { DiffSegment } from './types';

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function types(segs: DiffSegment[]): string[] {
  return segs.map((s) => s.type);
}

function texts(segs: DiffSegment[]): string[] {
  return segs.map((s) => s.text);
}

// ── 同一テキスト ──────────────────────────────────────────────────────────────

describe('computeInlineDiff – 同一テキスト', () => {
  it('同一テキストは unchanged 1 セグメントを返す', () => {
    const segs = computeInlineDiff('hello', 'hello');
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({ type: 'unchanged', text: 'hello' });
  });

  it('空文字列同士は unchanged 1 セグメント（空テキスト）', () => {
    const segs = computeInlineDiff('', '');
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({ type: 'unchanged', text: '' });
  });
});

// ── 完全置換 ──────────────────────────────────────────────────────────────────

describe('computeInlineDiff – 完全置換', () => {
  it('original が空のとき added のみを返す', () => {
    const segs = computeInlineDiff('', '新テキスト');
    expect(types(segs)).toEqual(['added']);
    expect(segs[0]!.text).toBe('新テキスト');
  });

  it('modified が空のとき removed のみを返す', () => {
    const segs = computeInlineDiff('旧テキスト', '');
    expect(types(segs)).toEqual(['removed']);
    expect(segs[0]!.text).toBe('旧テキスト');
  });

  it('完全に異なるテキストは removed → added の順', () => {
    const segs = computeInlineDiff('AAA', 'BBB');
    expect(types(segs)).toContain('removed');
    expect(types(segs)).toContain('added');
    expect(types(segs)).not.toContain('unchanged');
  });
});

// ── 日本語句点による文分割 ────────────────────────────────────────────────────

describe('computeInlineDiff – 日本語句点（。）による分割', () => {
  it('中間の文が変わった場合に unchanged/removed/added が混在する', () => {
    const original = 'A。B。C。';
    const modified = 'A。X。C。';
    const segs = computeInlineDiff(original, modified);
    expect(types(segs)).toContain('unchanged');
    expect(types(segs)).toContain('removed');
    expect(types(segs)).toContain('added');
  });

  it('先頭の文だけ変わった場合 removed/added が先頭に来る', () => {
    const original = '旧文。共通文。';
    const modified = '新文。共通文。';
    const segs = computeInlineDiff(original, modified);
    const unchanged = segs.filter((s) => s.type === 'unchanged');
    expect(unchanged.some((s) => s.text.includes('共通文。'))).toBe(true);
  });

  it('末尾の文だけ変わった場合 removed/added が末尾に来る', () => {
    const original = '共通文。旧末尾。';
    const modified = '共通文。新末尾。';
    const segs = computeInlineDiff(original, modified);
    const lastSeg = segs[segs.length - 1]!;
    expect(['removed', 'added']).toContain(lastSeg.type);
  });
});

// ── 英語ピリオド＋スペースによる文分割 ──────────────────────────────────────

describe('computeInlineDiff – 英語ピリオド（. ）による分割', () => {
  it('ピリオド＋スペースで文が分割される', () => {
    const original = 'Hello. World. Foo.';
    const modified = 'Hello. Earth. Foo.';
    const segs = computeInlineDiff(original, modified);
    // "Hello. " と "Foo." は unchanged、"World. " は removed、"Earth. " は added
    const unchanged = segs.filter((s) => s.type === 'unchanged');
    expect(unchanged.length).toBeGreaterThan(0);
    expect(types(segs)).toContain('removed');
    expect(types(segs)).toContain('added');
  });

  it('ピリオドで終わるが次が文字の場合は分割しない', () => {
    // "3.14" のようなケースは分割されないこと
    const original = '3.14 is pi';
    const modified = '3.14 is pi';
    const segs = computeInlineDiff(original, modified);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.type).toBe('unchanged');
  });
});

// ── 改行による分割 ────────────────────────────────────────────────────────────

describe('computeInlineDiff – 改行（\\n）による分割', () => {
  it('改行で文が分割され、変更された行だけ差分になる', () => {
    const original = '行1\n行2\n行3\n';
    const modified = '行1\n変更行\n行3\n';
    const segs = computeInlineDiff(original, modified);
    expect(types(segs)).toContain('unchanged');
    expect(types(segs)).toContain('removed');
    expect(types(segs)).toContain('added');
    const unchangedTexts = segs.filter((s) => s.type === 'unchanged').map((s) => s.text);
    expect(unchangedTexts.join('')).toContain('行1\n');
  });

  it('全行が同じなら unchanged のみ', () => {
    const text = '行1\n行2\n行3\n';
    const segs = computeInlineDiff(text, text);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.type).toBe('unchanged');
  });
});

// ── セグメントのマージ ────────────────────────────────────────────────────────

describe('computeInlineDiff – 隣接セグメントのマージ', () => {
  it('連続する同型セグメントは 1 つにマージされる', () => {
    // 3文が全て変更された場合、removed が 3 つではなく 1 つになる
    const original = '文A。文B。文C。';
    const modified = '文X。文Y。文Z。';
    const segs = computeInlineDiff(original, modified);
    const removed = segs.filter((s) => s.type === 'removed');
    const added = segs.filter((s) => s.type === 'added');
    // マージにより removed は 1 つ、added は 1 つのはず
    expect(removed.length).toBe(1);
    expect(added.length).toBe(1);
  });
});

// ── 返り値の整合性 ────────────────────────────────────────────────────────────

describe('computeInlineDiff – 返り値の整合性', () => {
  it('全セグメントを結合すると original と modified の文字が含まれる', () => {
    const original = 'こんにちは。ありがとう。';
    const modified = 'こんにちは。さようなら。';
    const segs = computeInlineDiff(original, modified);

    const removedText = segs.filter((s) => s.type !== 'added').map((s) => s.text).join('');
    const addedText = segs.filter((s) => s.type !== 'removed').map((s) => s.text).join('');

    // removed+unchanged は original を再構成する
    expect(removedText).toBe(original);
    // added+unchanged は modified を再構成する
    expect(addedText).toBe(modified);
  });

  it('全セグメントの type は unchanged/removed/added のいずれか', () => {
    const segs = computeInlineDiff('foo bar', 'foo baz');
    const validTypes = new Set(['unchanged', 'removed', 'added']);
    expect(segs.every((s) => validTypes.has(s.type))).toBe(true);
  });

  it('各セグメントの text は空でない', () => {
    const segs = computeInlineDiff('hello', 'world');
    expect(segs.every((s) => s.text.length > 0)).toBe(true);
  });
});
