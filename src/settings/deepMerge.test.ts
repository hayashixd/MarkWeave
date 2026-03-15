import { describe, it, expect } from 'vitest';
import { deepMerge } from './deepMerge';

describe('deepMerge', () => {
  it('フラットなオブジェクトをマージできる', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3 };
    expect(deepMerge(target, source)).toEqual({ a: 1, b: 3 });
  });

  it('ネストされたオブジェクトを再帰マージする', () => {
    const target = { nested: { a: 1, b: 2 } };
    const source = { nested: { b: 3 } };
    expect(deepMerge(target, source)).toEqual({ nested: { a: 1, b: 3 } });
  });

  it('source に undefined の値がある場合は target を保持する', () => {
    const target = { a: 1, b: 2 };
    const source = { a: undefined };
    expect(deepMerge(target, source)).toEqual({ a: 1, b: 2 });
  });

  it('target にないキーを source から追加する', () => {
    const target = { a: 1 } as Record<string, unknown>;
    const source = { b: 2 };
    expect(deepMerge(target, source)).toEqual({ a: 1, b: 2 });
  });

  it('配列はオブジェクトとしてマージせず上書きする', () => {
    const target = { arr: [1, 2, 3] };
    const source = { arr: [4, 5] };
    expect(deepMerge(target, source)).toEqual({ arr: [4, 5] });
  });

  it('元のオブジェクトを変更しない', () => {
    const target = { nested: { a: 1 } };
    const source = { nested: { a: 2 } };
    deepMerge(target, source);
    expect(target.nested.a).toBe(1);
  });

  it('深くネストされたオブジェクトをマージする', () => {
    const target = { l1: { l2: { l3: { a: 1, b: 2 } } } };
    const source = { l1: { l2: { l3: { b: 3 } } } };
    expect(deepMerge(target, source)).toEqual({
      l1: { l2: { l3: { a: 1, b: 3 } } },
    });
  });
});
