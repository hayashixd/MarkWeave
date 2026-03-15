/**
 * アンビエントサウンドコントロール
 *
 * zen-mode-design.md §5 の「環境音」機能。
 * ツールバー内に小さなコントロールを配置。
 *
 * ペルソナ対応:
 * - 一般ライター/ブロガー: 集中執筆のための背景音
 * - 知識管理者: ノート記入時の集中サポート
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { ambientPlayer, type AmbientSoundType } from '../../lib/ambient-sound';

const SOUND_OPTIONS: { type: AmbientSoundType; label: string; emoji: string }[] = [
  { type: 'off',   label: '停止',         emoji: '🔇' },
  { type: 'white', label: 'ホワイトノイズ', emoji: '〰️' },
  { type: 'brown', label: 'ブラウンノイズ', emoji: '🌊' },
  { type: 'rain',  label: '雨音',         emoji: '🌧️' },
  { type: 'cafe',  label: 'カフェ',        emoji: '☕' },
];

export function AmbientSoundControl() {
  const { settings, updateSettings } = useSettingsStore();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentType = settings.editor.ambientSound;
  const volume = settings.editor.ambientVolume;
  const isPlaying = currentType !== 'off';

  // 設定変化を再生に反映
  useEffect(() => {
    if (currentType === 'off') {
      ambientPlayer.stop();
    } else {
      ambientPlayer.play(currentType, volume);
    }
  }, [currentType, volume]);

  // ページアンロード時に停止
  useEffect(() => {
    return () => { ambientPlayer.stop(); };
  }, []);

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  const handleSelect = useCallback((type: AmbientSoundType) => {
    updateSettings({ editor: { ambientSound: type } });
    setOpen(false);
  }, [updateSettings]);

  const handleVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    updateSettings({ editor: { ambientVolume: v } });
    ambientPlayer.setVolume(v);
  }, [updateSettings]);

  const currentOption = SOUND_OPTIONS.find((o) => o.type === currentType) ?? SOUND_OPTIONS[0]!;

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        title={`アンビエントサウンド: ${currentOption.label}`}
        aria-label="アンビエントサウンド"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
          isPlaying
            ? 'bg-purple-100 text-purple-600'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
        }`}
      >
        <span style={{ fontSize: '13px', lineHeight: 1 }}>{currentOption.emoji}</span>
      </button>

      {open && (
        <div className="ambient-sound-menu">
          <div className="ambient-sound-menu__title">環境音</div>
          <div className="ambient-sound-menu__options">
            {SOUND_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                className={`ambient-sound-menu__option${currentType === opt.type ? ' ambient-sound-menu__option--active' : ''}`}
                onClick={() => handleSelect(opt.type)}
              >
                <span className="ambient-sound-menu__option-emoji">{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
          {/* 音量スライダー */}
          {isPlaying && (
            <div className="ambient-sound-menu__volume">
              <span className="ambient-sound-menu__volume-label">音量</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={handleVolume}
                className="ambient-sound-menu__slider"
                aria-label="音量"
              />
              <span className="ambient-sound-menu__volume-value">{Math.round(volume * 100)}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
