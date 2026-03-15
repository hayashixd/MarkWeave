/**
 * ポモドーロタイマー ランタイム状態ストア (Zustand)
 *
 * 25分集中 → 5分休憩のサイクルを管理する。
 * 設定値（集中時間・休憩時間）は settingsStore から取得。
 */

import { create } from 'zustand';
import { useToastStore } from './toastStore';
import { useSettingsStore } from './settingsStore';

export type PomodoroPhase = 'work' | 'break';

interface PomodoroStore {
  /** タイマーが動作中か */
  isRunning: boolean;
  /** 現在のフェーズ（集中 or 休憩） */
  phase: PomodoroPhase;
  /** 残り時間（秒） */
  timeRemaining: number;
  /** 完了したセッション数 */
  sessionsCompleted: number;
  /** setInterval の ID（内部管理用） */
  _intervalId: ReturnType<typeof setInterval> | null;

  /** タイマーを開始する */
  start: () => void;
  /** タイマーを一時停止する */
  pause: () => void;
  /** タイマーをリセットする（集中フェーズに戻る） */
  reset: () => void;
  /** 休憩をスキップして次の集中フェーズを開始する */
  skipBreak: () => void;
  /** 内部: 1秒ごとのティック処理 */
  _tick: () => void;
}

function getWorkSeconds(): number {
  return useSettingsStore.getState().settings.editor.pomodoroWorkMinutes * 60;
}

function getBreakSeconds(): number {
  return useSettingsStore.getState().settings.editor.pomodoroBreakMinutes * 60;
}

export const usePomodoroStore = create<PomodoroStore>((set, get) => ({
  isRunning: false,
  phase: 'work',
  timeRemaining: getWorkSeconds(),
  sessionsCompleted: 0,
  _intervalId: null,

  start: () => {
    const state = get();
    if (state.isRunning) return;

    // 残り0なら初期化
    if (state.timeRemaining <= 0) {
      set({ timeRemaining: state.phase === 'work' ? getWorkSeconds() : getBreakSeconds() });
    }

    const intervalId = setInterval(() => get()._tick(), 1000);
    set({ isRunning: true, _intervalId: intervalId });
  },

  pause: () => {
    const { _intervalId } = get();
    if (_intervalId) clearInterval(_intervalId);
    set({ isRunning: false, _intervalId: null });
  },

  reset: () => {
    const { _intervalId } = get();
    if (_intervalId) clearInterval(_intervalId);
    set({
      isRunning: false,
      phase: 'work',
      timeRemaining: getWorkSeconds(),
      _intervalId: null,
    });
  },

  skipBreak: () => {
    const { _intervalId } = get();
    if (_intervalId) clearInterval(_intervalId);
    set({
      isRunning: false,
      phase: 'work',
      timeRemaining: getWorkSeconds(),
      _intervalId: null,
    });
  },

  _tick: () => {
    const state = get();
    const next = state.timeRemaining - 1;

    if (next <= 0) {
      // フェーズ完了
      const { _intervalId } = state;
      if (_intervalId) clearInterval(_intervalId);

      if (state.phase === 'work') {
        // 集中セッション完了 → 休憩へ
        const completed = state.sessionsCompleted + 1;
        set({
          isRunning: false,
          phase: 'break',
          timeRemaining: getBreakSeconds(),
          sessionsCompleted: completed,
          _intervalId: null,
        });
        useToastStore.getState().show(
          'success',
          `ポモドーロ ${completed} セッション完了！休憩しましょう`,
          { label: '休憩開始', onClick: () => get().start() },
        );
      } else {
        // 休憩完了 → 集中へ
        set({
          isRunning: false,
          phase: 'work',
          timeRemaining: getWorkSeconds(),
          _intervalId: null,
        });
        useToastStore.getState().show(
          'info',
          '休憩終了！次のセッションを始めましょう',
          { label: '開始', onClick: () => get().start() },
        );
      }
    } else {
      set({ timeRemaining: next });
    }
  },
}));
