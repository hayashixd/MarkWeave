/**
 * IME 入力（日本語変換中）の状態を管理するフック。
 *
 * CLAUDE.md の制約:
 * - 日本語入力（IME）を前提とする
 * - isComposing 中は InputRules やスラッシュコマンドを抑制する
 * - 変換中の Enter キーで誤爆しないようガードする
 */

import { useRef, useCallback, useEffect } from 'react';
import type { Editor } from '@tiptap/core';

export interface IMECompositionState {
  /** 現在 IME 変換中かどうか */
  readonly isComposing: boolean;
  /** IME 変換中でなければ true を返す（ガード関数） */
  canProcess: () => boolean;
}

export function useIMEComposition(editor: Editor | null): IMECompositionState {
  const isComposingRef = useRef(false);

  useEffect(() => {
    if (!editor) return;

    const dom = editor.view.dom;

    const handleCompositionStart = () => {
      isComposingRef.current = true;
    };

    const handleCompositionEnd = () => {
      isComposingRef.current = false;
    };

    dom.addEventListener('compositionstart', handleCompositionStart);
    dom.addEventListener('compositionend', handleCompositionEnd);

    return () => {
      dom.removeEventListener('compositionstart', handleCompositionStart);
      dom.removeEventListener('compositionend', handleCompositionEnd);
    };
  }, [editor]);

  const canProcess = useCallback(() => {
    return !isComposingRef.current;
  }, []);

  return {
    get isComposing() {
      return isComposingRef.current;
    },
    canProcess,
  };
}
