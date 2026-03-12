/**
 * HTML スプリットビュー（左: ソースコード / 右: プレビュー）
 *
 * Phase 5 スプリットモード:
 * - ソースコードとプレビューの並列表示
 * - 同期スクロール
 * - ドラッグリサイズ（マウス + タッチ対応）
 *
 * 設計書: docs/05_Features/HTML/html-editing-design.md §3.1, §8.3
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { HtmlSourceEditor } from './HtmlSourceEditor';
import { sanitizeHtml } from '../../utils/dompurify-config';

export interface HtmlSplitViewProps {
  /** HTML テキスト */
  value: string;
  /** テキスト変更時のコールバック */
  onChange: (value: string) => void;
  /** 読み取り専用 */
  readOnly?: boolean;
  /** iframe sandbox 方式でプレビューを隔離する（security-design.md §1.2 二次防衛） */
  useSandbox?: boolean;
}

export function HtmlSplitView({
  value,
  onChange,
  readOnly = false,
  useSandbox = false,
}: HtmlSplitViewProps) {
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [syncScroll, setSyncScroll] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // ドラッグリサイズハンドラ（マウス対応）
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      setIsDragging(true);

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
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [splitRatio],
  );

  // タッチ対応
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      isDraggingRef.current = true;
      setIsDragging(true);

      const startX = touch.clientX;
      const startRatio = splitRatio;
      const containerWidth =
        containerRef.current?.getBoundingClientRect().width ?? 1;

      const handleTouchMove = (ev: TouchEvent) => {
        if (!isDraggingRef.current) return;
        const t = ev.touches[0];
        if (!t) return;
        const dx = t.clientX - startX;
        const newRatio = Math.max(
          0.2,
          Math.min(0.8, startRatio + dx / containerWidth),
        );
        setSplitRatio(newRatio);
      };

      const handleTouchEnd = () => {
        isDraggingRef.current = false;
        setIsDragging(false);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };

      document.addEventListener('touchmove', handleTouchMove, { passive: true });
      document.addEventListener('touchend', handleTouchEnd);
    },
    [splitRatio],
  );

  // プレビューのサニタイズ済みHTML（共通設定を使用）
  const sanitized = sanitizeHtml(value);

  // プレビュー更新（<style>タグの内容も適用）
  useEffect(() => {
    if (!previewRef.current) return;
    // DOMPurifyでサニタイズ済みなのでXSSリスクは低い
    previewRef.current.innerHTML = sanitized;
  }, [sanitized]);

  // 同期スクロール
  const handleSourceScroll = useCallback(() => {
    if (!syncScroll || !previewRef.current) return;
    const sourceEl = containerRef.current?.querySelector('.source-editor .cm-scroller');
    if (!sourceEl || !previewRef.current) return;

    const maxSourceScroll = sourceEl.scrollHeight - sourceEl.clientHeight;
    if (maxSourceScroll <= 0) return;
    const scrollRatio = sourceEl.scrollTop / maxSourceScroll;
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
      style={isDragging ? { userSelect: 'none' } : undefined}
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
        className={`w-1.5 cursor-col-resize flex-shrink-0 transition-colors relative group ${
          isDragging ? 'bg-blue-500' : 'bg-gray-200 hover:bg-blue-400'
        }`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        role="separator"
        aria-label="分割位置の調整"
        aria-orientation="vertical"
        tabIndex={0}
      >
        {/* ドラッグ領域を広げる透明オーバーレイ */}
        <div className="absolute inset-y-0 -left-1 -right-1" />
        {/* 中央のグリップインジケーター */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-0.5 ${
          isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } transition-opacity`}>
          <div className="w-1 h-1 rounded-full bg-white/80" />
          <div className="w-1 h-1 rounded-full bg-white/80" />
          <div className="w-1 h-1 rounded-full bg-white/80" />
        </div>
      </div>

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
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none hover:text-gray-700 transition-colors">
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={(e) => setSyncScroll(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-400 focus:ring-1"
            />
            同期スクロール
          </label>
        </div>

        {/* プレビュー本体 */}
        {useSandbox ? (
          /* iframe sandbox 方式: ブラウザレベルでスクリプト実行不可（security-design.md §1.2） */
          <iframe
            sandbox="allow-same-origin"
            srcDoc={sanitized}
            className="flex-1 w-full border-none bg-white"
            title="HTML Preview (sandbox)"
            data-testid="html-preview"
          />
        ) : (
          /* DOMPurify のみ方式: サニタイズ済み HTML を直接挿入 */
          <div
            ref={previewRef}
            className="flex-1 overflow-auto p-6 bg-white"
            data-testid="html-preview"
          />
        )}
      </div>
    </div>
  );
}
