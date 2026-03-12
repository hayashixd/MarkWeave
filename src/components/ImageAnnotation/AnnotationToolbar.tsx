/**
 * アノテーションツールバー
 *
 * image-design.md §9.3 に準拠
 * ツール選択・線幅・カラーピッカー・Undo ボタン
 */

import { useCallback, useRef, useState } from 'react';
import type { AnnotationTool } from './types';
import { COLOR_PRESETS } from './types';

interface AnnotationToolbarProps {
  activeTool: AnnotationTool;
  color: string;
  lineWidth: number;
  canUndo: boolean;
  onToolChange: (tool: AnnotationTool) => void;
  onColorChange: (color: string) => void;
  onLineWidthChange: (width: number) => void;
  onUndo: () => void;
}

interface ToolDef {
  id: AnnotationTool;
  label: string;
  icon: string;
  shortcut: string;
}

const TOOLS: ToolDef[] = [
  { id: 'rect', label: '矩形', icon: '□', shortcut: 'R' },
  { id: 'ellipse', label: '楕円', icon: '○', shortcut: 'E' },
  { id: 'arrow', label: '矢印', icon: '→', shortcut: 'A' },
  { id: 'freehand', label: 'フリーハンド', icon: '✏', shortcut: 'F' },
  { id: 'text', label: 'テキスト', icon: 'T', shortcut: 'T' },
  { id: 'mosaic', label: 'モザイク', icon: '▓', shortcut: 'B' },
  { id: 'stepNumber', label: 'ステップ番号', icon: '❶', shortcut: 'N' },
  { id: 'eraser', label: '消しゴム', icon: '⌫', shortcut: 'X' },
];

export function AnnotationToolbar({
  activeTool,
  color,
  lineWidth,
  canUndo,
  onToolChange,
  onColorChange,
  onLineWidthChange,
  onUndo,
}: AnnotationToolbarProps) {
  const [showCustomColor, setShowCustomColor] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleCustomColor = useCallback(() => {
    setShowCustomColor(true);
    setTimeout(() => colorInputRef.current?.click(), 0);
  }, []);

  return (
    <div className="annotation-toolbar" role="toolbar" aria-label="アノテーションツール">
      {/* ツールボタン */}
      <div className="annotation-toolbar__tools">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`annotation-toolbar__btn ${activeTool === tool.id ? 'annotation-toolbar__btn--active' : ''}`}
            onClick={() => onToolChange(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
            aria-pressed={activeTool === tool.id}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      {/* 区切り線 */}
      <div className="annotation-toolbar__separator" />

      {/* 線幅 */}
      <div className="annotation-toolbar__line-width">
        <label htmlFor="annotation-line-width" className="sr-only">線幅</label>
        <input
          id="annotation-line-width"
          type="range"
          min={1}
          max={10}
          value={lineWidth}
          onChange={(e) => onLineWidthChange(Number(e.target.value))}
          title={`線幅: ${lineWidth}px`}
        />
      </div>

      {/* 区切り線 */}
      <div className="annotation-toolbar__separator" />

      {/* カラーパレット */}
      <div className="annotation-toolbar__colors">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.value}
            className={`annotation-toolbar__color ${color === preset.value ? 'annotation-toolbar__color--active' : ''}`}
            style={{ backgroundColor: preset.value }}
            onClick={() => onColorChange(preset.value)}
            title={preset.label}
            aria-label={preset.label}
          />
        ))}
        <button
          className="annotation-toolbar__color annotation-toolbar__color--custom"
          onClick={handleCustomColor}
          title="カスタム色"
          aria-label="カスタム色"
        >
          +
        </button>
        {showCustomColor && (
          <input
            ref={colorInputRef}
            type="color"
            value={color}
            className="annotation-toolbar__color-input"
            onChange={(e) => {
              onColorChange(e.target.value);
              setShowCustomColor(false);
            }}
            onBlur={() => setShowCustomColor(false)}
          />
        )}
      </div>

      {/* 区切り線 */}
      <div className="annotation-toolbar__separator" />

      {/* Undo */}
      <button
        className="annotation-toolbar__btn"
        onClick={onUndo}
        disabled={!canUndo}
        title="元に戻す (Ctrl+Z)"
        aria-label="元に戻す"
      >
        ↩
      </button>
    </div>
  );
}
