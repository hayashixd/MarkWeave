declare module 'gif-encoder-2' {
  class GIFEncoder {
    constructor(
      width: number,
      height: number,
      algorithm?: 'neuquant' | 'octree',
      useOptimizer?: boolean,
      totalFrames?: number
    );

    /** 出力バッファ */
    out: { getData(): Uint8Array };

    /** ループ回数。0 = 無限ループ */
    setRepeat(repeat: number): void;
    /** フレーム表示時間 (ms) */
    setDelay(delay: number): void;
    /** 色品質 (1–30、低いほど高品質) */
    setQuality(quality: number): void;

    start(): void;
    /** RGBA 形式の生ピクセルデータ (Uint8Array | Buffer) を追加 */
    addFrame(pixels: Uint8Array | Buffer): void;
    finish(): void;
  }

  export = GIFEncoder;
}
