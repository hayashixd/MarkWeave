/**
 * 画像アノテーション型定義
 *
 * image-design.md §9 に準拠
 */

export type AnnotationTool =
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'freehand'
  | 'text'
  | 'mosaic'
  | 'stepNumber'
  | 'eraser';

export interface AnnotationColor {
  label: string;
  value: string;
}

export const COLOR_PRESETS: AnnotationColor[] = [
  { label: '赤', value: '#ff0000' },
  { label: '青', value: '#0066ff' },
  { label: '黄', value: '#ffcc00' },
  { label: '緑', value: '#00cc44' },
  { label: '黒', value: '#000000' },
  { label: '白', value: '#ffffff' },
];

export const DEFAULT_COLOR = '#ff0000';
export const DEFAULT_LINE_WIDTH = 3;
export const MAX_UNDO_STEPS = 20;

export interface Point {
  x: number;
  y: number;
}

export interface DrawState {
  tool: AnnotationTool;
  color: string;
  lineWidth: number;
  isDrawing: boolean;
  startPoint: Point | null;
  currentPoint: Point | null;
  freehandPoints: Point[];
  stepCount: number;
}
