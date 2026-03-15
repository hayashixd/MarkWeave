/**
 * スプリッタ（ドラッグリサイズハンドル）コンポーネント
 *
 * split-editor-design.md §8.2 に準拠:
 * - PointerEvents ベースのドラッグ操作
 * - 20%〜80% の範囲制限
 * - ダブルクリックで均等幅に戻す
 * - WAI-ARIA separator ロール
 */

import type React from 'react';
import { useCallback, useRef } from 'react';
import type { LayoutType } from '../../store/paneStore';

interface SplitterProps {
  /** 分割方向: vertical = 左右分割, horizontal = 上下分割 */
  direction: Exclude<LayoutType, 'single'>;
  /** 分割比率の変更コールバック */
  onRatioChange: (ratio: number) => void;
  /** ダブルクリックでリセット */
  onReset?: () => void;
}

export function Splitter({ direction, onRatioChange, onReset }: SplitterProps) {
  const splitterRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      isDragging.current = true;
      target.dataset.dragging = 'true';

      const container = target.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      const handlePointerMove = (moveE: PointerEvent) => {
        if (!isDragging.current) return;
        const ratio =
          direction === 'vertical'
            ? (moveE.clientX - rect.left) / rect.width
            : (moveE.clientY - rect.top) / rect.height;
        onRatioChange(ratio);
      };

      const handlePointerUp = () => {
        isDragging.current = false;
        if (target.dataset.dragging) {
          delete target.dataset.dragging;
        }
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp, { once: true });
    },
    [direction, onRatioChange],
  );

  const handleDoubleClick = useCallback(() => {
    onReset?.();
    onRatioChange(0.5);
  }, [onRatioChange, onReset]);

  const isVertical = direction === 'vertical';

  return (
    <div
      ref={splitterRef}
      className={`splitter flex-shrink-0 relative group transition-colors ${
        isVertical
          ? 'w-1.5 cursor-col-resize bg-gray-200 hover:bg-blue-400 data-[dragging=true]:bg-blue-500'
          : 'h-1.5 cursor-row-resize bg-gray-200 hover:bg-blue-400 data-[dragging=true]:bg-blue-500'
      }`}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      role="separator"
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
      aria-label="ペイン分割位置の調整"
      tabIndex={0}
    >
      {/* ドラッグ領域を広げる透明オーバーレイ */}
      <div
        className={
          isVertical
            ? 'absolute inset-y-0 -left-1 -right-1'
            : 'absolute inset-x-0 -top-1 -bottom-1'
        }
      />
      {/* 中央のグリップインジケーター */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${
          isVertical ? 'flex flex-col gap-0.5' : 'flex flex-row gap-0.5'
        } opacity-0 group-hover:opacity-100 transition-opacity`}
      >
        <div className="w-1 h-1 rounded-full bg-white/80" />
        <div className="w-1 h-1 rounded-full bg-white/80" />
        <div className="w-1 h-1 rounded-full bg-white/80" />
      </div>
    </div>
  );
}
