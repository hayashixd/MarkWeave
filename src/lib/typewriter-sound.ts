/**
 * タイプライター打鍵音プレイヤー
 *
 * zen-mode-design.md の「タイプライター打鍵音フィードバック」機能に準拠。
 * Web Audio API のみで音を合成するため、外部音声ファイルは不要。
 *
 * ペルソナ対応:
 * - 一般ライター/ブロガー: 打鍵音で執筆リズムを実感し、モチベーション維持
 * - Zen Mode との統合で没入感を高める
 *
 * サウンドスタイル:
 * - mechanical: モダンなメカニカルキーボードのコクッとした音
 * - soft: メンブレンキーボードの柔らかな音
 * - typewriter: ヴィンテージタイプライターの打鍵音
 */

export type TypewriterSoundStyle = 'mechanical' | 'soft' | 'typewriter';

class TypewriterSoundPlayer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * 打鍵音を一発再生する。
   * キーダウンイベントのたびに呼ぶ（IME入力中は呼ばない）。
   */
  playKey(style: TypewriterSoundStyle = 'mechanical', volume = 0.3): void {
    if (volume <= 0) return;
    try {
      const ctx = this.getContext();
      switch (style) {
        case 'mechanical': this.playMechanical(ctx, volume); break;
        case 'soft':       this.playSoft(ctx, volume);       break;
        case 'typewriter': this.playTypewriter(ctx, volume); break;
      }
    } catch {
      // Web Audio が使用できない環境ではサイレントに無視
    }
  }

  /** モダンメカニカルキーボード: 高域バンドパスノイズの短いクリック */
  private playMechanical(ctx: AudioContext, volume: number): void {
    const now = ctx.currentTime;
    const dur = 0.025;

    const src = this.createNoiseSource(ctx, dur + 0.01);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3200;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 1.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + dur + 0.01);
  }

  /** メンブレンキーボード: 中域の柔らかな音 */
  private playSoft(ctx: AudioContext, volume: number): void {
    const now = ctx.currentTime;
    const dur = 0.035;

    const src = this.createNoiseSource(ctx, dur + 0.01);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + dur + 0.01);
  }

  /**
   * ヴィンテージタイプライター:
   * 高域クリック + 低域インパクト音の2層構造
   */
  private playTypewriter(ctx: AudioContext, volume: number): void {
    const now = ctx.currentTime;

    // 高域クリック
    const clickSrc = this.createNoiseSource(ctx, 0.02);
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'highpass';
    clickFilter.frequency.value = 4000;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(volume * 1.0, now);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);
    clickSrc.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickSrc.start(now);
    clickSrc.stop(now + 0.02);

    // 低域インパクト（タイプライター特有の「ガシャッ」）
    const thudOsc = ctx.createOscillator();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(120, now);
    thudOsc.frequency.exponentialRampToValueAtTime(40, now + 0.04);
    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(volume * 0.6, now);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    thudOsc.connect(thudGain);
    thudGain.connect(ctx.destination);
    thudOsc.start(now);
    thudOsc.stop(now + 0.045);
  }

  /** 短いホワイトノイズバッファソースを生成 */
  private createNoiseSource(ctx: AudioContext, durationSec: number): AudioBufferSourceNode {
    const bufSize = Math.ceil(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    return src;
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
  }
}

/** アプリ全体で共有するシングルトンインスタンス */
export const typewriterPlayer = new TypewriterSoundPlayer();
