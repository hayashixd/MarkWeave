/**
 * ワードスプリント ステータスバーウィジェット。
 *
 * ステータスバー右側に配置し、スプリントのカウントダウンと文字数進捗を表示する。
 * クリックでポップオーバーメニューを表示（開始/停止/リセット/設定変更）。
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useWordSprintStore } from '../../store/wordSprintStore';
import { useSettingsStore } from '../../store/settingsStore';

/** 秒数を MM:SS 形式にフォーマット */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface WordSprintWidgetProps {
  /** 現在の文字数（StatusBar から渡される） */
  charCount: number;
}

export function WordSprintWidget({ charCount }: WordSprintWidgetProps) {
  const { settings, updateSettings } = useSettingsStore();
  const {
    status,
    timeRemaining,
    startWordCount,
    currentWordCount,
    sprintsCompleted,
    lastResult,
    start,
    pause,
    resume,
    reset,
    updateWordCount,
  } = useWordSprintStore();

  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const durationMinutes = settings.editor.wordSprintDurationMinutes;
  const targetWords = settings.editor.wordSprintTargetWords;

  // 設定変更時にアイドル状態のタイマー残り時間を更新
  useEffect(() => {
    if (status === 'idle') {
      useWordSprintStore.setState({ timeRemaining: durationMinutes * 60 });
    }
  }, [durationMinutes, status]);

  // 文字数の変化をストアに反映
  useEffect(() => {
    if (status === 'running' || status === 'paused') {
      updateWordCount(charCount);
    }
  }, [charCount, status, updateWordCount]);

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

  const handleStart = useCallback(() => {
    start(charCount);
    setPopoverOpen(false);
  }, [start, charCount]);

  const handlePause = useCallback(() => {
    pause();
    setPopoverOpen(false);
  }, [pause]);

  const handleResume = useCallback(() => {
    resume();
    setPopoverOpen(false);
  }, [resume]);

  const handleReset = useCallback(() => {
    reset();
    setPopoverOpen(false);
  }, [reset]);

  if (!settings.editor.wordSprintEnabled) return null;

  const wordsWritten = status !== 'idle'
    ? Math.max(0, currentWordCount - startWordCount)
    : 0;
  const progress = targetWords > 0 ? Math.min(wordsWritten / targetWords, 1) : 0;

  const statusIcon = (() => {
    switch (status) {
      case 'running': return '✍';
      case 'paused': return '⏸';
      case 'finished': return lastResult?.achieved ? '🎉' : '⏱';
      default: return '🏃';
    }
  })();

  const statusColor = (() => {
    switch (status) {
      case 'running': return 'text-purple-500';
      case 'paused': return 'text-yellow-500';
      case 'finished': return lastResult?.achieved ? 'text-green-500' : 'text-orange-500';
      default: return 'text-gray-400';
    }
  })();

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        className="status-bar__button flex items-center gap-1"
        onClick={() => setPopoverOpen((v) => !v)}
        title={`ワードスプリント: ${formatTime(timeRemaining)} (${wordsWritten}/${targetWords}文字)`}
      >
        <span className={statusColor}>{statusIcon}</span>
        {status !== 'idle' && (
          <>
            <span className={status === 'running' ? statusColor : undefined}>
              {formatTime(timeRemaining)}
            </span>
            <span className="text-gray-400 text-[10px]">
              {wordsWritten}/{targetWords}
            </span>
          </>
        )}
        {status === 'idle' && (
          <span className="text-gray-400 text-[10px]">スプリント</span>
        )}
      </button>

      {popoverOpen && (
        <div className="status-bar__popover" style={{ minWidth: '220px' }}>
          <div className="status-bar__popover-title">
            ワードスプリント
          </div>

          {/* スプリント進捗 */}
          {status !== 'idle' && (
            <div className="status-bar__popover-group">
              <div className="px-3 py-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600">
                    {wordsWritten.toLocaleString()} / {targetWords.toLocaleString()}文字
                  </span>
                  <span className={lastResult?.achieved ? 'text-green-600 font-medium' : 'text-gray-500'}>
                    {Math.round(progress * 100)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      progress >= 1 ? 'bg-green-500' : 'bg-purple-400'
                    }`}
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 最後の結果 */}
          {status === 'finished' && lastResult && (
            <div className="status-bar__popover-group">
              <div className="px-3 py-2 text-xs">
                <div className={lastResult.achieved ? 'text-green-600 font-medium' : 'text-orange-600 font-medium'}>
                  {lastResult.achieved ? '🎉 目標達成！' : '⏱ 時間切れ'}
                </div>
                <div className="text-gray-500 mt-1">
                  {lastResult.wordsWritten.toLocaleString()}文字
                  （{Math.floor(lastResult.elapsedSeconds / 60)}分{lastResult.elapsedSeconds % 60}秒）
                </div>
              </div>
            </div>
          )}

          {/* コントロールボタン */}
          <div className="status-bar__popover-group">
            {status === 'idle' || status === 'finished' ? (
              <button
                type="button"
                className="status-bar__popover-item"
                onClick={handleStart}
              >
                ▶ スプリント開始
              </button>
            ) : status === 'running' ? (
              <button
                type="button"
                className="status-bar__popover-item"
                onClick={handlePause}
              >
                ⏸ 一時停止
              </button>
            ) : status === 'paused' ? (
              <button
                type="button"
                className="status-bar__popover-item"
                onClick={handleResume}
              >
                ▶ 再開
              </button>
            ) : null}
            {status !== 'idle' && (
              <button
                type="button"
                className="status-bar__popover-item"
                onClick={handleReset}
              >
                ↺ リセット
              </button>
            )}
          </div>

          {/* セッション情報 */}
          {sprintsCompleted > 0 && (
            <div className="status-bar__popover-group">
              <div className="status-bar__popover-label">
                完了スプリント: {sprintsCompleted}
              </div>
            </div>
          )}

          {/* 時間設定 */}
          <div className="status-bar__popover-group">
            <div className="status-bar__popover-label">制限時間（分）</div>
            {[5, 10, 15, 20, 30].map((min) => (
              <button
                key={min}
                type="button"
                className={`status-bar__popover-item${durationMinutes === min ? ' status-bar__popover-item--active' : ''}`}
                onClick={() => updateSettings({ editor: { wordSprintDurationMinutes: min } })}
              >
                {min}分
              </button>
            ))}
          </div>

          {/* 目標文字数設定 */}
          <div className="status-bar__popover-group">
            <div className="status-bar__popover-label">目標文字数</div>
            {[200, 500, 1000, 2000].map((count) => (
              <button
                key={count}
                type="button"
                className={`status-bar__popover-item${targetWords === count ? ' status-bar__popover-item--active' : ''}`}
                onClick={() => updateSettings({ editor: { wordSprintTargetWords: count } })}
              >
                {count.toLocaleString()}文字
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
