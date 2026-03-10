/**
 * node-height-cache のユニットテスト
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  makeNodeId,
  getEstimatedHeight,
  updateHeightCache,
  invalidateHeightCache,
  _getHeightCacheSize,
} from './node-height-cache';

// ProseMirrorNode のモック
function mockNode(typeName: string, textContent: string) {
  return {
    type: { name: typeName },
    textContent,
  } as any;
}

describe('node-height-cache', () => {
  beforeEach(() => {
    invalidateHeightCache();
  });

  describe('makeNodeId', () => {
    it('typeName:offset 形式の ID を生成する', () => {
      const node = mockNode('paragraph', 'hello');
      expect(makeNodeId(node, 42)).toBe('paragraph:42');
    });
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
  });

  describe('updateHeightCache / invalidateHeightCache', () => {
    it('キャッシュに実測値を保存し、次回取得時に返す', () => {
      const node = mockNode('paragraph', 'text');
      const mockDom = {
        getBoundingClientRect: () => ({ height: 75 }),
      } as HTMLElement;

      updateHeightCache(node, 10, mockDom);
      expect(_getHeightCacheSize()).toBe(1);
      expect(getEstimatedHeight(node, 10)).toBe(75);
    });

    it('invalidateHeightCache でキャッシュが全クリアされる', () => {
      const node = mockNode('paragraph', 'text');
      const mockDom = {
        getBoundingClientRect: () => ({ height: 75 }),
      } as HTMLElement;

      updateHeightCache(node, 10, mockDom);
      expect(_getHeightCacheSize()).toBe(1);

      invalidateHeightCache();
      expect(_getHeightCacheSize()).toBe(0);

      // クリア後はデフォルト値に戻る
      expect(getEstimatedHeight(node, 10)).toBe(28);
    });
  });
});
