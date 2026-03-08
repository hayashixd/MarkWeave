/**
 * ポモドーロタイマー ステータスバーウィジェット。
 *
 * ステータスバー右側に配置し、集中/休憩のカウントダウンを表示する。
 * クリックでポップオーバーメニューを表示（開始/停止/リセット/設定変更）。
 */

import { useState, useEffect, useRef } from 'react';
import { usePomodoroStore } from '../../store/pomodoroStore';
import { useSettingsStore } from '../../store/settingsStore';

/** 秒数を MM:SS 形式にフォーマット */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function PomodoroTimer() {
  const { settings, updateSettings } = useSettingsStore();
  const { isRunning, phase, timeRemaining, sessionsCompleted, start, pause, reset, skipBreak } =
    usePomodoroStore();

  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // settings変更時にリセット済みタイマーの残り時間を更新
  const workMinutes = settings.editor.pomodoroWorkMinutes;
  const breakMinutes = settings.editor.pomodoroBreakMinutes;

  useEffect(() => {
    if (!isRunning) {
      const store = usePomodoroStore.getState();
      if (store.phase === 'work') {
        usePomodoroStore.setState({ timeRemaining: workMinutes * 60 });
      } else {
        usePomodoroStore.setState({ timeRemaining: breakMinutes * 60 });
      }
    }
  }, [workMinutes, breakMinutes, isRunning]);

  // ポップオーバー外クリックで閉じる
  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [popoverOpen]);

  if (!settings.editor.pomodoroEnabled) return null;

  const phaseLabel = phase === 'work' ? '集中' : '休憩';
  const phaseColor = phase === 'work' ? 'text-red-500' : 'text-green-500';

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        className="status-bar__button flex items-center gap-1"
        onClick={() => setPopoverOpen((v) => !v)}
        title={`ポモドーロタイマー: ${phaseLabel} ${formatTime(timeRemaining)} (${sessionsCompleted}セッション完了)`}
      >
        <span className={phaseColor}>{isRunning ? '▶' : '⏸'}</span>
        <span className={isRunning ? phaseColor : undefined}>
          {formatTime(timeRemaining)}
        </span>
        <span className="text-gray-400 text-[10px]">{phaseLabel}</span>
      </button>

      {popoverOpen && (
        <div className="status-bar__popover" style={{ minWidth: '180px' }}>
          <div className="status-bar__popover-title">
            ポモドーロタイマー
          </div>

          {/* コントロールボタン */}
          <div className="status-bar__popover-group">
            {!isRunning ? (
              <button
                type="button"
                className="status-bar__popover-item"
                onClick={() => { start(); setPopoverOpen(false); }}
              >
                ▶ 開始
              </button>
            ) : (
              <button
                type="button"
                className="status-bar__popover-item"
                onClick={() => { pause(); setPopoverOpen(false); }}
              >
                ⏸ 一時停止
              </button>
            )}
            <button
              type="button"
              className="status-bar__popover-item"
              onClick={() => { reset(); setPopoverOpen(false); }}
            >
              ↺ リセット
            </button>
            {phase === 'break' && (
              <button
                type="button"
                className="status-bar__popover-item"
                onClick={() => { skipBreak(); setPopoverOpen(false); }}
              >
                ⏭ 休憩をスキップ
              </button>
            )}
          </div>

          {/* セッション情報 */}
          <div className="status-bar__popover-group">
            <div className="status-bar__popover-label">
              完了セッション: {sessionsCompleted}
            </div>
          </div>

          {/* 時間設定 */}
          <div className="status-bar__popover-group">
            <div className="status-bar__popover-label">集中時間（分）</div>
            {[15, 25, 30, 50].map((min) => (
              <button
                key={min}
                type="button"
                className={`status-bar__popover-item${workMinutes === min ? ' status-bar__popover-item--active' : ''}`}
                onClick={() => updateSettings({ editor: { pomodoroWorkMinutes: min } })}
              >
                {min}分
              </button>
            ))}
          </div>
          <div className="status-bar__popover-group">
            <div className="status-bar__popover-label">休憩時間（分）</div>
            {[3, 5, 10, 15].map((min) => (
              <button
                key={min}
                type="button"
                className={`status-bar__popover-item${breakMinutes === min ? ' status-bar__popover-item--active' : ''}`}
                onClick={() => updateSettings({ editor: { pomodoroBreakMinutes: min } })}
              >
                {min}分
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
