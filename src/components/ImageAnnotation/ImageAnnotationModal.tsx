/**
 * 画像アノテーションモーダル
 *
 * image-design.md §9 に準拠
 *
 * - 画像をダブルクリックでアノテーションモード開始
 * - Canvas 上で描画ツールを使用してアノテーション
 * - 完了時に元画像をバックアップし、アノテーション済み画像を上書き保存
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AnnotationToolbar } from './AnnotationToolbar';
import type { AnnotationTool, DrawState, Point } from './types';
import { DEFAULT_COLOR, DEFAULT_LINE_WIDTH, MAX_UNDO_STEPS } from './types';
import {
  drawRect,
  drawEllipse,
  drawArrow,
  drawFreehand,
  drawText,
  drawMosaic,
  drawStepNumber,
} from './drawHandlers';

interface ImageAnnotationModalProps {
  /** 画像の表示用 src（asset:// プロトコル等） */
  imageSrc: string;
  /** 画像の絶対ファイルパス（保存先） */
  imagePath: string;
  /** モーダルを閉じるコールバック */
  onClose: () => void;
  /** 保存完了コールバック */
  onSaved: () => void;
}

export function ImageAnnotationModal({
  imageSrc,
  imagePath,
  onClose,
  onSaved,
}: ImageAnnotationModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputPos, setTextInputPos] = useState<Point>({ x: 0, y: 0 });

  const [drawState, setDrawState] = useState<DrawState>({
    tool: 'rect',
    color: DEFAULT_COLOR,
    lineWidth: DEFAULT_LINE_WIDTH,
    isDrawing: false,
    startPoint: null,
    currentPoint: null,
    freehandPoints: [],
    stepCount: 1,
  });

  // 画像をロードしてキャンバスに描画
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      const canvas = canvasRef.current;
      const overlay = overlayCanvasRef.current;
      if (!canvas || !overlay) return;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      overlay.width = img.naturalWidth;
      overlay.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
      }
      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Undo スナップショットを保存
  const saveUndoState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current.push(snap);
    if (undoStackRef.current.length > MAX_UNDO_STEPS) {
      undoStackRef.current.shift();
    }
    setCanUndo(true);
  }, []);

  // Undo 実行
  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prev = stack.pop()!;
    ctx.putImageData(prev, 0, 0);
    setCanUndo(stack.length > 0);
  }, []);

  // Canvas 座標を計算（CSS サイズとの差を考慮）
  const getCanvasPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  // オーバーレイキャンバスをクリア
  const clearOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
  }, []);

  // マウスダウン
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);

    // テキストツール: クリックで入力フィールドを配置
    if (drawState.tool === 'text') {
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;
      const rect = overlay.getBoundingClientRect();
      setTextInputPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setShowTextInput(true);
      setDrawState((s) => ({ ...s, startPoint: point }));
      setTimeout(() => textInputRef.current?.focus(), 0);
      return;
    }

    // ステップ番号ツール: クリックで番号を配置
    if (drawState.tool === 'stepNumber') {
      saveUndoState();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawStepNumber(ctx, point, drawState.stepCount, drawState.color);
      }
      setDrawState((s) => ({ ...s, stepCount: Math.min(99, s.stepCount + 1) }));
      return;
    }

    // 消しゴム: Undo として動作
    if (drawState.tool === 'eraser') {
      handleUndo();
      return;
    }

    saveUndoState();
    setDrawState((s) => ({
      ...s,
      isDrawing: true,
      startPoint: point,
      currentPoint: point,
      freehandPoints: [point],
    }));
  }, [drawState.tool, drawState.color, drawState.stepCount, getCanvasPoint, saveUndoState, handleUndo]);

  // マウスムーブ
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawState.isDrawing || !drawState.startPoint) return;
    const point = getCanvasPoint(e);

    setDrawState((s) => ({
      ...s,
      currentPoint: point,
      freehandPoints: s.tool === 'freehand' ? [...s.freehandPoints, point] : s.freehandPoints,
    }));

    // オーバーレイにプレビュー描画
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const { tool, color, lineWidth, startPoint } = drawState;

    switch (tool) {
      case 'rect':
        drawRect(ctx, startPoint, point, color, lineWidth);
        break;
      case 'ellipse':
        drawEllipse(ctx, startPoint, point, color, lineWidth);
        break;
      case 'arrow':
        drawArrow(ctx, startPoint, point, color, lineWidth);
        break;
      case 'freehand':
        drawFreehand(ctx, [...drawState.freehandPoints, point], color, lineWidth);
        break;
      case 'mosaic':
        // モザイクプレビューは矩形枠のみ表示
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(
          startPoint.x,
          startPoint.y,
          point.x - startPoint.x,
          point.y - startPoint.y,
        );
        ctx.setLineDash([]);
        break;
    }
  }, [drawState, getCanvasPoint]);

  // マウスアップ
  const handleMouseUp = useCallback(() => {
    if (!drawState.isDrawing || !drawState.startPoint || !drawState.currentPoint) {
      setDrawState((s) => ({ ...s, isDrawing: false }));
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { tool, color, lineWidth, startPoint, currentPoint, freehandPoints } = drawState;

    // メインキャンバスに確定描画
    switch (tool) {
      case 'rect':
        drawRect(ctx, startPoint, currentPoint, color, lineWidth);
        break;
      case 'ellipse':
        drawEllipse(ctx, startPoint, currentPoint, color, lineWidth);
        break;
      case 'arrow':
        drawArrow(ctx, startPoint, currentPoint, color, lineWidth);
        break;
      case 'freehand':
        drawFreehand(ctx, freehandPoints, color, lineWidth);
        break;
      case 'mosaic':
        drawMosaic(ctx, startPoint, currentPoint);
        break;
    }

    clearOverlay();
    setDrawState((s) => ({
      ...s,
      isDrawing: false,
      startPoint: null,
      currentPoint: null,
      freehandPoints: [],
    }));
  }, [drawState, clearOverlay]);

  // テキスト確定
  const handleTextSubmit = useCallback((text: string) => {
    if (!text.trim() || !drawState.startPoint) {
      setShowTextInput(false);
      return;
    }
    saveUndoState();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawText(ctx, drawState.startPoint, text, drawState.color);
    }
    setShowTextInput(false);
    setDrawState((s) => ({ ...s, startPoint: null }));
  }, [drawState.startPoint, drawState.color, saveUndoState]);

  // 保存処理
  const handleSave = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setSaving(true);
    try {
      // 元画像をバックアップ
      await invoke('backup_file', { path: imagePath });

      // Canvas を Blob に変換
      const ext = imagePath.split('.').pop()?.toLowerCase() ?? 'png';
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), mimeType, 0.95),
      );
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));

      // 保存
      await invoke('write_file_bytes', { path: imagePath, bytes });
      onSaved();
    } catch (err) {
      console.error('アノテーション画像の保存に失敗:', err);
    } finally {
      setSaving(false);
    }
  }, [imagePath, onSaved]);

  // キーボードショートカット
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (showTextInput) return;

      // Ctrl+Z で Undo
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Escape でキャンセル
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // ツールショートカット
      const shortcuts: Record<string, AnnotationTool> = {
        r: 'rect',
        e: 'ellipse',
        a: 'arrow',
        f: 'freehand',
        t: 'text',
        b: 'mosaic',
        n: 'stepNumber',
        x: 'eraser',
      };
      const tool = shortcuts[e.key.toLowerCase()];
      if (tool) {
        setDrawState((s) => ({ ...s, tool }));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, onClose, showTextInput]);

  // Canvas にカーソルスタイルを設定
  const getCursor = (): string => {
    switch (drawState.tool) {
      case 'text':
        return 'text';
      case 'stepNumber':
        return 'crosshair';
      case 'eraser':
        return 'pointer';
      default:
        return 'crosshair';
    }
  };

  return (
    <div className="annotation-modal" role="dialog" aria-label="画像アノテーション">
      <div className="annotation-modal__backdrop" onClick={onClose} />
      <div className="annotation-modal__content">
        <AnnotationToolbar
          activeTool={drawState.tool}
          color={drawState.color}
          lineWidth={drawState.lineWidth}
          canUndo={canUndo}
          onToolChange={(tool) => setDrawState((s) => ({ ...s, tool }))}
          onColorChange={(color) => setDrawState((s) => ({ ...s, color }))}
          onLineWidthChange={(lineWidth) => setDrawState((s) => ({ ...s, lineWidth }))}
          onUndo={handleUndo}
        />

        <div className="annotation-modal__canvas-container">
          {!imageLoaded && (
            <div className="annotation-modal__loading">画像を読み込み中...</div>
          )}
          <canvas
            ref={canvasRef}
            className="annotation-modal__canvas annotation-modal__canvas--main"
          />
          <canvas
            ref={overlayCanvasRef}
            className="annotation-modal__canvas annotation-modal__canvas--overlay"
            style={{ cursor: getCursor() }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />

          {/* テキスト入力フィールド */}
          {showTextInput && (
            <input
              ref={textInputRef}
              className="annotation-modal__text-input"
              style={{
                left: textInputPos.x,
                top: textInputPos.y,
              }}
              placeholder="テキストを入力..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleTextSubmit(e.currentTarget.value);
                } else if (e.key === 'Escape') {
                  setShowTextInput(false);
                }
              }}
              onBlur={(e) => handleTextSubmit(e.currentTarget.value)}
            />
          )}
        </div>

        <div className="annotation-modal__actions">
          <button
            className="annotation-modal__btn annotation-modal__btn--cancel"
            onClick={onClose}
            disabled={saving}
          >
            キャンセル
          </button>
          <button
            className="annotation-modal__btn annotation-modal__btn--save"
            onClick={handleSave}
            disabled={saving || !imageLoaded}
          >
            {saving ? '保存中...' : '完了'}
          </button>
        </div>
      </div>
    </div>
  );
}
