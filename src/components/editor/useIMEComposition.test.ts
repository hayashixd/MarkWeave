/**
 * useIMEComposition のユニットテスト
 *
 * CLAUDE.md 制約:
 * - 日本語入力（IME）を前提とする
 * - isComposing 中は InputRules やスラッシュコマンドを抑制する
 * - 変換中の Enter キーで誤爆しないようガードする
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIMEComposition } from './useIMEComposition';
import type { Editor } from '@tiptap/core';

function createMockEditor() {
  const domElement = document.createElement('div');
  const mockEditor = {
    view: { dom: domElement },
  } as unknown as Editor;
  return { mockEditor, domElement };
}

describe('useIMEComposition', () => {
  describe('初期状態', () => {
    it('isComposing が false で始まる', () => {
      const { mockEditor } = createMockEditor();
      const { result } = renderHook(() => useIMEComposition(mockEditor));
      expect(result.current.isComposing).toBe(false);
    });

    it('canProcess() が true を返す（変換前は処理可能）', () => {
      const { mockEditor } = createMockEditor();
      const { result } = renderHook(() => useIMEComposition(mockEditor));
      expect(result.current.canProcess()).toBe(true);
    });

    it('editor が null の場合も isComposing は false のまま', () => {
      const { result } = renderHook(() => useIMEComposition(null));
      expect(result.current.isComposing).toBe(false);
      expect(result.current.canProcess()).toBe(true);
    });
  });

  describe('compositionstart イベント', () => {
    it('isComposing が true になる', () => {
      const { mockEditor, domElement } = createMockEditor();
      const { result } = renderHook(() => useIMEComposition(mockEditor));

      act(() => {
        domElement.dispatchEvent(new Event('compositionstart'));
      });

      expect(result.current.isComposing).toBe(true);
    });

    it('canProcess() が false を返す（スラッシュコマンド・InputRule 誤爆防止）', () => {
      const { mockEditor, domElement } = createMockEditor();
      const { result } = renderHook(() => useIMEComposition(mockEditor));

      act(() => {
        domElement.dispatchEvent(new Event('compositionstart'));
      });

      expect(result.current.canProcess()).toBe(false);
    });
  });

  describe('compositionend イベント', () => {
    it('isComposing が false に戻る', () => {
      const { mockEditor, domElement } = createMockEditor();
      const { result } = renderHook(() => useIMEComposition(mockEditor));

      act(() => {
        domElement.dispatchEvent(new Event('compositionstart'));
      });
      act(() => {
        domElement.dispatchEvent(new Event('compositionend'));
      });

      expect(result.current.isComposing).toBe(false);
    });

    it('canProcess() が true に戻る（変換確定後は処理再開）', () => {
      const { mockEditor, domElement } = createMockEditor();
      const { result } = renderHook(() => useIMEComposition(mockEditor));

      act(() => {
        domElement.dispatchEvent(new Event('compositionstart'));
      });
      expect(result.current.canProcess()).toBe(false);

      act(() => {
        domElement.dispatchEvent(new Event('compositionend'));
      });
      expect(result.current.canProcess()).toBe(true);
    });
  });

  describe('複数サイクル', () => {
    it('変換 → 確定 → 変換 → 確定 の繰り返しを正しく処理する', () => {
      const { mockEditor, domElement } = createMockEditor();
      const { result } = renderHook(() => useIMEComposition(mockEditor));

      // 第1サイクル
      act(() => { domElement.dispatchEvent(new Event('compositionstart')); });
      expect(result.current.isComposing).toBe(true);
      act(() => { domElement.dispatchEvent(new Event('compositionend')); });
      expect(result.current.isComposing).toBe(false);

      // 第2サイクル（同じ結果になること）
      act(() => { domElement.dispatchEvent(new Event('compositionstart')); });
      expect(result.current.isComposing).toBe(true);
      act(() => { domElement.dispatchEvent(new Event('compositionend')); });
      expect(result.current.isComposing).toBe(false);
    });

    it('変換開始が連続しても最終状態は isComposing=true', () => {
      const { mockEditor, domElement } = createMockEditor();
      const { result } = renderHook(() => useIMEComposition(mockEditor));

      act(() => { domElement.dispatchEvent(new Event('compositionstart')); });
      act(() => { domElement.dispatchEvent(new Event('compositionstart')); });
      expect(result.current.isComposing).toBe(true);
    });
  });

  describe('クリーンアップ', () => {
    it('アンマウント時に compositionstart/compositionend リスナーが削除される', () => {
      const { mockEditor, domElement } = createMockEditor();
      const spy = vi.spyOn(domElement, 'removeEventListener');
      const { unmount } = renderHook(() => useIMEComposition(mockEditor));

      unmount();

      expect(spy).toHaveBeenCalledWith('compositionstart', expect.any(Function));
      expect(spy).toHaveBeenCalledWith('compositionend', expect.any(Function));
    });

    it('アンマウント後にイベントが発火しても例外が発生しない（メモリリーク防止）', () => {
      const { mockEditor, domElement } = createMockEditor();
      const { unmount } = renderHook(() => useIMEComposition(mockEditor));

      unmount();

      // アンマウント後のイベント発火 → 例外が起きないこと
      expect(() => {
        domElement.dispatchEvent(new Event('compositionstart'));
      }).not.toThrow();
    });
  });
});
