/**
 * マニュアル用スクリーンショット撮影ヘルパー
 *
 * captureStep: 連番付きでスクリーンショットを保存
 * captureWithAnnotation: 撮影後にアノテーション（矩形ハイライト・テキストラベル）を合成
 */
import type { Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";

/** ステップカウンタ（シナリオごとにリセット） */
let stepCounter = 0;

/** カウンタをリセット */
export function resetStepCounter(): void {
  stepCounter = 0;
}

/**
 * 現在の画面を連番付きで保存する
 *
 * @param page - Playwright の Page オブジェクト
 * @param stepName - ステップ名（ファイル名に使用）
 * @param outputDir - 出力先ディレクトリ（絶対パスまたはプロジェクトルートからの相対パス）
 * @returns 保存されたファイルのパス
 */
export async function captureStep(
  page: Page,
  stepName: string,
  outputDir: string
): Promise<string> {
  stepCounter++;
  const dir = path.isAbsolute(outputDir)
    ? outputDir
    : path.resolve(process.cwd(), outputDir);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const paddedIndex = String(stepCounter).padStart(2, "0");
  const safeName = stepName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${paddedIndex}_${safeName}.png`;
  const filePath = path.join(dir, fileName);

  await page.screenshot({ path: filePath, fullPage: false });

  return filePath;
}

/** アノテーション定義 */
export interface Annotation {
  /** ハイライトする矩形領域 (px) */
  rect: { x: number; y: number; width: number; height: number };
  /** ラベルテキスト（矩形の上に表示） */
  label?: string;
  /** 矩形の色 (CSS カラー) デフォルト: red */
  color?: string;
}

/**
 * スクリーンショットを撮影し、sharp でアノテーションを合成して保存する
 *
 * @param page - Playwright の Page オブジェクト
 * @param stepName - ステップ名
 * @param annotations - アノテーション配列
 * @param outputDir - 出力先ディレクトリ
 * @returns 保存されたファイルのパス
 */
export async function captureWithAnnotation(
  page: Page,
  stepName: string,
  annotations: Annotation[],
  outputDir: string
): Promise<string> {
  // まず通常のスクリーンショットを撮影
  const rawPath = await captureStep(page, stepName, outputDir);

  if (annotations.length === 0) {
    return rawPath;
  }

  // SVG オーバーレイを生成
  const metadata = await sharp(rawPath).metadata();
  const imgWidth = metadata.width ?? 1280;
  const imgHeight = metadata.height ?? 720;

  const svgParts: string[] = [];
  for (const ann of annotations) {
    const color = ann.color ?? "red";
    const { x, y, width, height } = ann.rect;

    // 矩形ハイライト（半透明塗り + 枠線）
    svgParts.push(
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" ` +
        `fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="3" rx="4" />`
    );

    // テキストラベル
    if (ann.label) {
      const labelY = Math.max(y - 8, 18);
      svgParts.push(
        `<rect x="${x}" y="${labelY - 16}" width="${ann.label.length * 10 + 12}" height="22" ` +
          `fill="${color}" rx="4" />` +
          `<text x="${x + 6}" y="${labelY}" font-family="sans-serif" font-size="14" ` +
          `font-weight="bold" fill="white">${escapeXml(ann.label)}</text>`
      );
    }
  }

  const svg = `<svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">${svgParts.join("")}</svg>`;

  // sharp でオーバーレイを合成
  await sharp(rawPath)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .toFile(rawPath + ".tmp.png");

  // tmp を上書き
  fs.renameSync(rawPath + ".tmp.png", rawPath);

  return rawPath;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
