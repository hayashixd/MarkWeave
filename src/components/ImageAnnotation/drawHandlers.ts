/**
 * アノテーション描画ハンドラ
 *
 * image-design.md §9.5, §9.7 に準拠
 * HTML Canvas API を使用してブラウザ側で完結
 */

import type { Point } from './types';

/**
 * 矩形を描画する
 */
export function drawRect(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  lineWidth: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
  ctx.stroke();
}

/**
 * 楕円を描画する
 */
export function drawEllipse(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  lineWidth: number,
): void {
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const rx = Math.abs(end.x - start.x) / 2;
  const ry = Math.abs(end.y - start.y) / 2;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * 矢印を描画する（終点に塗りつぶし三角形）
 */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  lineWidth: number,
): void {
  const headLength = Math.max(15, lineWidth * 5);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // シャフト
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  // 矢じり（塗りつぶし三角形）
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - headLength * Math.cos(angle - Math.PI / 6),
    end.y - headLength * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    end.x - headLength * Math.cos(angle + Math.PI / 6),
    end.y - headLength * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
}

/**
 * フリーハンド線を描画する
 */
export function drawFreehand(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  lineWidth: number,
): void {
  if (points.length < 2) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

/**
 * テキストを描画する
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  position: Point,
  text: string,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.font = 'bold 16px sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(text, position.x, position.y);
}

/**
 * モザイク（ブロック化ぼかし）を描画する
 *
 * ドラッグ矩形範囲に 10×10px ブロックモザイク
 */
export function drawMosaic(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
): void {
  const blockSize = 10;
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);

  if (w < 2 || h < 2) return;

  const imageData = ctx.getImageData(x, y, w, h);
  const { data } = imageData;

  for (let by = 0; by < h; by += blockSize) {
    for (let bx = 0; bx < w; bx += blockSize) {
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      const bw = Math.min(blockSize, w - bx);
      const bh = Math.min(blockSize, h - by);

      // ブロック内の平均色を計算
      for (let py = by; py < by + bh; py++) {
        for (let px = bx; px < bx + bw; px++) {
          const idx = (py * w + px) * 4;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          a += data[idx + 3];
          count++;
        }
      }

      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      a = Math.round(a / count);

      // ブロック全体を平均色で塗る
      for (let py = by; py < by + bh; py++) {
        for (let px = bx; px < bx + bw; px++) {
          const idx = (py * w + px) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = a;
        }
      }
    }
  }

  ctx.putImageData(imageData, x, y);
}

/**
 * ステップ番号（丸囲み数字）を描画する
 */
export function drawStepNumber(
  ctx: CanvasRenderingContext2D,
  position: Point,
  stepNumber: number,
  color: string,
): void {
  const radius = 14;
  const text = String(stepNumber);

  // 丸を描画
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
  ctx.fill();

  // テキスト（白抜き）
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, position.x, position.y);

  // リセット
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}
