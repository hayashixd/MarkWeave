/**
 * HTML スプリットビュー（左: ソースコード / 右: プレビュー）
 *
 * Phase 5 スプリットモード:
 * - ソースコードとプレビューの並列表示
 * - 同期スクロール
 * - ドラッグリサイズ
 *
 * 設計書: docs/05_Features/HTML/html-editing-design.md §3.1, §8.3
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { HtmlSourceEditor } from './HtmlSourceEditor';
import DOMPurify from 'dompurify';

export interface HtmlSplitViewProps {
  /** HTML テキスト */
  value: string;
  /** テキスト変更時のコールバック */
  onChange: (value: string) => void;
  /** 読み取り専用 */
  readOnly?: boolean;
}

export function HtmlSplitView({
  value,
  onChange,
  readOnly = false,
}: HtmlSplitViewProps) {
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [syncScroll, setSyncScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // ドラッグリサイズハンドラ
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;

      const startX = e.clientX;
      const startRatio = splitRatio;
      const containerWidth =
        containerRef.current?.getBoundingClientRect().width ?? 1;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const dx = ev.clientX - startX;
        const newRatio = Math.max(
          0.2,
          Math.min(0.8, startRatio + dx / containerWidth),
        );
        setSplitRatio(newRatio);
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [splitRatio],
  );

  // プレビューのサニタイズ済みHTML
  const sanitizedHtml = DOMPurify.sanitize(value, {
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ADD_TAGS: ['style'],
    FORBID_TAGS: ['script'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  });

  // プレビュー更新（<style>タグの内容も適用）
  useEffect(() => {
    if (!previewRef.current) return;
    // shadow DOM等ではなく直接innerHTMLに設定
    // DOMPurifyでサニタイズ済みなのでXSSリスクは低い
    previewRef.current.innerHTML = sanitizedHtml;
  }, [sanitizedHtml]);

  // 同期スクロール
  const handleSourceScroll = useCallback(() => {
    if (!syncScroll || !previewRef.current) return;
    // CodeMirrorのスクロール位置をプレビューに同期
    // 比率ベースの同期
    const sourceEl = containerRef.current?.querySelector('.source-editor .cm-scroller');
    if (!sourceEl || !previewRef.current) return;

    const scrollRatio =
      sourceEl.scrollTop /
      (sourceEl.scrollHeight - sourceEl.clientHeight || 1);
    const previewMaxScroll =
      previewRef.current.scrollHeight - previewRef.current.clientHeight;
    previewRef.current.scrollTop = scrollRatio * previewMaxScroll;
  }, [syncScroll]);

  // ソース側のスクロールイベント監視
  useEffect(() => {
    const sourceEl = containerRef.current?.querySelector(
      '.source-editor .cm-scroller',
    );
    if (!sourceEl) return;

    sourceEl.addEventListener('scroll', handleSourceScroll);
    return () => sourceEl.removeEventListener('scroll', handleSourceScroll);
  }, [handleSourceScroll]);

  return (
    <div
      ref={containerRef}
      className="flex flex-1 min-h-0 relative"
      data-testid="html-split-view"
    >
      {/* 左ペイン: ソースエディタ */}
      <div
        className="flex flex-col min-w-0 overflow-hidden"
        style={{ width: `${splitRatio * 100}%` }}
      >
        <HtmlSourceEditor
          value={value}
          onChange={onChange}
          readOnly={readOnly}
        />
      </div>

      {/* リサイズハンドル */}
      <div
        className="w-1 bg-gray-300 hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors"
        onMouseDown={handleMouseDown}
        role="separator"
        aria-label="分割位置の調整"
        aria-orientation="vertical"
      />

      {/* 右ペイン: プレビュー */}
      <div
        className="flex flex-col min-w-0 overflow-hidden"
        style={{ width: `${(1 - splitRatio) * 100}%` }}
      >
        {/* プレビューヘッダー */}
        <div className="flex items-center justify-between px-3 py-1 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <span className="text-xs text-gray-500 font-medium">
            プレビュー
          </span>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={(e) => setSyncScroll(e.target.checked)}
              className="w-3 h-3"
            />
            同期スクロール
          </label>
        </div>

        {/* プレビュー本体 */}
        <div
          ref={previewRef}
          className="flex-1 overflow-auto p-6 bg-white prose prose-neutral max-w-none"
          data-testid="html-preview"
        />
      </div>
    </div>
  );
}
