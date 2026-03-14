/**
 * node-height-cache のユニットテスト
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getEstimatedHeight,
  updateHeightCache,
  invalidateHeightCache,
} from './node-height-cache';

// ProseMirrorNode のモック
function mockNode(typeName: string, textContent: string, childCount = 0) {
  return {
    type: { name: typeName },
    textContent,
    childCount,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal mock for ProseMirrorNode
  } as any;
}

/**
 * invalidateHeightCache を繰り返し呼んでキャッシュを空にするヘルパー。
 * コンテンツベースキャッシュでは invalidateHeightCache() は
 * サイズ上限超過時のみ削除するため、テスト用に複数回呼ぶ。
 */
function forceFlushCache() {
  // MAX_CACHE_SIZE (2000) を超えるまでダミーエントリを追加
  for (let i = 0; i < 2100; i++) {
    const node = mockNode('paragraph', `flush-${i}`);
    const mockDom = { getBoundingClientRect: () => ({ height: 1 }) } as HTMLElement;
    updateHeightCache(node, 0, mockDom);
  }
  invalidateHeightCache();
  // 残ったエントリもクリア
  for (let i = 0; i < 2100; i++) {
    const node = mockNode('paragraph', `flush2-${i}`);
    const mockDom = { getBoundingClientRect: () => ({ height: 1 }) } as HTMLElement;
    updateHeightCache(node, 0, mockDom);
  }
  invalidateHeightCache();
}

describe('node-height-cache', () => {
  beforeEach(() => {
    forceFlushCache();
  });

  describe('getEstimatedHeight', () => {
    it('paragraph の1行テキストはデフォルト高さ (28px) を返す', () => {
      const node = mockNode('paragraph', 'short text');
      const height = getEstimatedHeight(node, 0);
      expect(height).toBe(28);
    });

    it('空テキストのノードはデフォルト高さを返す', () => {
      const node = mockNode('paragraph', '');
      const height = getEstimatedHeight(node, 0);
      expect(height).toBe(28);
    });

    it('長いテキストは行数に応じて高さが増加する', () => {
      // 120文字 = 2行（60文字/行）→ base 28 + (2-1) * 22 = 50
      const longText = 'a'.repeat(120);
      const node = mockNode('paragraph', longText);
      const height = getEstimatedHeight(node, 0);
      expect(height).toBe(50);
    });

    it('CJK テキストは charsPerLine=30 で計算される', () => {
      // 60文字の日本語 = 2行（30文字/行）→ base 28 + (2-1) * (22+4) = 54
      const japaneseText = 'あ'.repeat(60);
      const node = mockNode('paragraph', japaneseText);
      const height = getEstimatedHeight(node, 0);
      expect(height).toBe(54);
    });

    it('codeBlock はデフォルト 104px', () => {
      const node = mockNode('codeBlock', '');
      const height = getEstimatedHeight(node, 0);
      expect(height).toBe(104);
    });

    it('未知のノードタイプはデフォルト 28px', () => {
      const node = mockNode('unknownType', '');
      const height = getEstimatedHeight(node, 0);
      expect(height).toBe(28);
    });

    it('同一内容のノードはオフセットが異なってもキャッシュヒットする', () => {
      const node1 = mockNode('paragraph', 'same content');
      const mockDom = { getBoundingClientRect: () => ({ height: 75 }) } as HTMLElement;
      updateHeightCache(node1, 10, mockDom);

      // 異なるオフセットでも同一内容ならキャッシュヒット
      const node2 = mockNode('paragraph', 'same content');
      expect(getEstimatedHeight(node2, 999)).toBe(75);
    });
  });

  describe('updateHeightCache', () => {
    it('キャッシュに実測値を保存し、次回取得時に返す', () => {
      const node = mockNode('paragraph', 'cached text');
      const mockDom = {
        getBoundingClientRect: () => ({ height: 75 }),
      } as HTMLElement;

      updateHeightCache(node, 10, mockDom);
      expect(getEstimatedHeight(node, 10)).toBe(75);
    });
  });

  describe('invalidateHeightCache', () => {
    it('キャッシュサイズが上限以下なら invalidate しても削除されない', () => {
      // キャッシュに少数のエントリだけ追加
      const node = mockNode('paragraph', 'unique-test-keep-me');
      const mockDom = { getBoundingClientRect: () => ({ height: 50 }) } as HTMLElement;
      updateHeightCache(node, 0, mockDom);

      // invalidate 前後でキャッシュにこのエントリが残っている
      invalidateHeightCache();
      expect(getEstimatedHeight(node, 0)).toBe(50); // キャッシュヒットする
    });
  });
});
