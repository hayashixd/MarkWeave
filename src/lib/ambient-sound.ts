/**
 * アンビエントサウンドプレイヤー
 *
 * zen-mode-design.md の「環境音」機能に準拠。
 * Web Audio API のみで音を合成するため、外部音声ファイルは不要。
 *
 * ペルソナ対応:
 * - 一般ライター/ブロガー: カフェ音・雨音で執筆に集中
 * - 知識管理者: ホワイトノイズで周囲の雑音をマスキング
 * - 全ペルソナ: Zen Mode との統合で没入感を高める
 *
 * 実装方針:
 * - White noise: Math.random() でバッファを生成
 * - Brown noise: White noise を積分フィルタで低域強調
 * - Rain: Brown noise + 高域バンドパスフィルタ (雨粒のシャー音)
 * - Cafe: Brown noise + 中域バンドパス (話し声帯域) + 軽いリバーブ
 */

export type AmbientSoundType = 'off' | 'white' | 'brown' | 'rain' | 'cafe';

class AmbientSoundPlayer {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private currentType: AmbientSoundType = 'off';

  /** Web Audio Context を初期化（ユーザーインタラクション後に呼ぶ） */
  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /** ノイズバッファを生成（約4秒分をループ） */
  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const bufferSize = sampleRate * 4; // 4秒
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    // Brown noise: 前のサンプルに白色ノイズを積み重ねる
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5; // 音量補正
    }

    return buffer;
  }

  /** White noise バッファ */
  private createWhiteNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /** 現在の再生を停止してリソースを解放 */
  private stopCurrent() {
    try {
      this.sourceNode?.stop();
    } catch { /* 既に停止済み */ }
    this.sourceNode?.disconnect();
    this.filterNodes.forEach((f) => f.disconnect());
    this.gainNode?.disconnect();
    this.sourceNode = null;
    this.filterNodes = [];
    this.gainNode = null;
  }

  /** 指定タイプを再生開始 */
  play(type: AmbientSoundType, volume: number) {
    if (type === 'off') {
      this.stop();
      return;
    }

    this.stopCurrent();
    this.currentType = type;

    const ctx = this.getContext();

    // ゲインノード（音量コントロール）
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    this.gainNode.connect(ctx.destination);

    // ノイズソース
    const isWhite = type === 'white';
    const buffer = isWhite
      ? this.createWhiteNoiseBuffer(ctx)
      : this.createNoiseBuffer(ctx);

    this.sourceNode = ctx.createBufferSource();
    this.sourceNode.buffer = buffer;
    this.sourceNode.loop = true;

    let lastNode: AudioNode = this.sourceNode;

    if (type === 'white') {
      // そのままゲインに繋ぐ
    } else if (type === 'brown') {
      // 低域ローパス: よりまろやかな低周波ノイズ
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 200;
      lp.Q.value = 0.5;
      this.filterNodes.push(lp);
      lastNode.connect(lp);
      lastNode = lp;
    } else if (type === 'rain') {
      // 雨音: ブラウンノイズ + ハイパス（シャー音帯域 3kHz 以上を強調）
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2000;
      hp.Q.value = 0.8;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 8000;
      lp.Q.value = 0.5;
      this.filterNodes.push(hp, lp);
      lastNode.connect(hp);
      hp.connect(lp);
      lastNode = lp;
    } else if (type === 'cafe') {
      // カフェ音: 中域バンドパス（会話帯域 300–3000 Hz）+ リバーブ風
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 800;
      bp.Q.value = 0.3;
      // 軽いコンプ風にピーキングフィルタを加える
      const peak = ctx.createBiquadFilter();
      peak.type = 'peaking';
      peak.frequency.value = 1200;
      peak.Q.value = 1.0;
      peak.gain.value = 4;
      this.filterNodes.push(bp, peak);
      lastNode.connect(bp);
      bp.connect(peak);
      lastNode = peak;
    }

    lastNode.connect(this.gainNode);
    this.sourceNode.start();
  }

  /** 停止 */
  stop() {
    this.stopCurrent();
    this.currentType = 'off';
  }

  /** 音量変更（再生中のまま即時反映） */
  setVolume(volume: number) {
    if (this.gainNode) {
      this.gainNode.gain.setTargetAtTime(
        Math.max(0, Math.min(1, volume)),
        this.getContext().currentTime,
        0.05,
      );
    }
  }

  getCurrentType(): AmbientSoundType {
    return this.currentType;
  }
}

/** シングルトン */
export const ambientPlayer = new AmbientSoundPlayer();
