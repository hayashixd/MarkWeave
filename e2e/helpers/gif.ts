/**
 * アニメーション GIF 録画ヘルパー
 *
 * Playwright の page.screenshot() でフレームを収集し、
 * gif-encoder-2 + sharp で RGBA ピクセルデータに変換して animated GIF を生成する。
 *
 * 使い方:
 *   const recorder = new GifRecorder({ width: 1280, height: 720, defaultDelay: 1000 });
 *   await recorder.addFrame(page, 1500);   // 1.5 秒間表示するフレーム
 *   await recorder.addFrame(page);         // defaultDelay を使うフレーム
 *   await recorder.save('docs/demo-gifs/demo.gif');
 */
import GIFEncoder from 'gif-encoder-2';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

interface Frame {
  data: Buffer;
  delay: number; // ms
}

export interface GifRecorderOptions {
  /** フレーム間のデフォルト待機時間 (ms)。デフォルト: 800 */
  defaultDelay?: number;
  /** 出力 GIF の幅 (px)。省略時はスクリーンショットの実寸 */
  width?: number;
  /** 出力 GIF の高さ (px)。省略時はスクリーンショットの実寸 */
  height?: number;
  /**
   * 色品質 (1–30、低いほど高品質・低速)。デフォルト: 10
   * README 用途では 8 程度が品質とサイズのバランスが良い。
   */
  quality?: number;
}

export class GifRecorder {
  private readonly frames: Frame[] = [];
  private readonly defaultDelay: number;
  private readonly outputWidth: number | undefined;
  private readonly outputHeight: number | undefined;
  private readonly quality: number;

  constructor(options: GifRecorderOptions = {}) {
    this.defaultDelay = options.defaultDelay ?? 800;
    this.outputWidth = options.width;
    this.outputHeight = options.height;
    this.quality = options.quality ?? 10;
  }

  /**
   * 現在の画面をフレームとして追加する。
   * @param page Playwright の Page
   * @param delayMs このフレームの表示時間 (ms)。省略時は defaultDelay を使用。
   */
  async addFrame(page: Page, delayMs?: number): Promise<void> {
    const data = await page.screenshot({ type: 'png' });
    this.frames.push({ data, delay: delayMs ?? this.defaultDelay });
  }

  /**
   * 収集したフレームをアニメーション GIF として保存する。
   * @param outputPath 出力先ファイルパス（.gif）。相対パスはプロジェクトルート基準。
   */
  async save(outputPath: string): Promise<void> {
    if (this.frames.length === 0) throw new Error('No frames captured');

    const absPath = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(process.cwd(), outputPath);
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // 出力サイズを決定（指定なければ 1 フレーム目の実寸）
    const firstMeta = await sharp(this.frames[0]!.data).metadata();
    const w = this.outputWidth ?? firstMeta.width!;
    const h = this.outputHeight ?? firstMeta.height!;

    const encoder = new GIFEncoder(w, h, 'neuquant', true, this.frames.length);
    encoder.setRepeat(0); // 0 = 無限ループ
    encoder.setQuality(this.quality);
    encoder.start();

    for (const { data, delay } of this.frames) {
      encoder.setDelay(delay);

      // PNG → RGBA raw ピクセルデータに変換
      // flatten で半透明を白背景に合成し、ensureAlpha で 4ch (RGBA) を保証
      const { data: pixels } = await sharp(data)
        .resize(w, h, { fit: 'fill' })
        .flatten({ background: '#ffffff' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      encoder.addFrame(pixels);
    }

    encoder.finish();
    fs.writeFileSync(absPath, Buffer.from(encoder.out.getData()));
    console.log(`GIF saved: ${absPath} (${this.frames.length} frames)`);
  }
}
