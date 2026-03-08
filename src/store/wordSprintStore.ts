/**
 * ワードスプリント ランタイム状態ストア (Zustand)
 *
 * 時間制限付き目標文字数達成モード。
 * 開始 → タイマーカウントダウン → 達成/未達のサマリー表示。
 * 設定値（制限時間・目標文字数）は settingsStore から取得。
 */

import { create } from 'zustand';
import { useToastStore } from './toastStore';
import { useSettingsStore } from './settingsStore';

export type SprintStatus = 'idle' | 'running' | 'paused' | 'finished';

interface SprintResult {
  /** 達成したかどうか */
  achieved: boolean;
  /** スプリント中に書いた文字数 */
  wordsWritten: number;
  /** 目標文字数 */
  wordsTarget: number;
  /** 実際にかかった時間（秒） */
  elapsedSeconds: number;
  /** 設定した制限時間（秒） */
  totalSeconds: number;
}

interface WordSprintStore {
  /** スプリントの状態 */
  status: SprintStatus;
  /** 残り時間（秒） */
  timeRemaining: number;
  /** スプリント開始時の文字数 */
  startWordCount: number;
  /** 現在の文字数（外部から更新される） */
  currentWordCount: number;
  /** 完了したスプリント数 */
  sprintsCompleted: number;
  /** 最後のスプリント結果 */
  lastResult: SprintResult | null;
  /** setInterval の ID（内部管理用） */
  _intervalId: ReturnType<typeof setInterval> | null;

  /** スプリントを開始する（現在の文字数を渡す） */
  start: (currentWordCount: number) => void;
  /** スプリントを一時停止する */
  pause: () => void;
  /** 一時停止から再開する */
  resume: () => void;
  /** スプリントをリセットする */
  reset: () => void;
  /** 外部から現在の文字数を更新する */
  updateWordCount: (count: number) => void;
  /** 内部: 1秒ごとのティック処理 */
  _tick: () => void;
  /** 内部: スプリント完了処理 */
  _finish: () => void;
}

function getSprintSeconds(): number {
  return useSettingsStore.getState().settings.editor.wordSprintDurationMinutes * 60;
}

function getTargetWords(): number {
  return useSettingsStore.getState().settings.editor.wordSprintTargetWords;
}

export const useWordSprintStore = create<WordSprintStore>((set, get) => ({
  status: 'idle',
  timeRemaining: getSprintSeconds(),
  startWordCount: 0,
  currentWordCount: 0,
  sprintsCompleted: 0,
  lastResult: null,
  _intervalId: null,

  start: (currentWordCount: number) => {
    const state = get();
    if (state.status === 'running') return;

    // 前のインターバルをクリア
    if (state._intervalId) clearInterval(state._intervalId);

    const intervalId = setInterval(() => get()._tick(), 1000);
    set({
      status: 'running',
      timeRemaining: getSprintSeconds(),
      startWordCount: currentWordCount,
      currentWordCount,
      lastResult: null,
      _intervalId: intervalId,
    });
  },

  pause: () => {
    const { _intervalId } = get();
    if (_intervalId) clearInterval(_intervalId);
    set({ status: 'paused', _intervalId: null });
  },

  resume: () => {
    const state = get();
    if (state.status !== 'paused') return;

    const intervalId = setInterval(() => get()._tick(), 1000);
    set({ status: 'running', _intervalId: intervalId });
  },

  reset: () => {
    const { _intervalId } = get();
    if (_intervalId) clearInterval(_intervalId);
    set({
      status: 'idle',
      timeRemaining: getSprintSeconds(),
      startWordCount: 0,
      currentWordCount: 0,
      lastResult: null,
      _intervalId: null,
    });
  },

  updateWordCount: (count: number) => {
    const state = get();
    if (state.status !== 'running' && state.status !== 'paused') return;
    set({ currentWordCount: count });

    // 目標達成チェック（実行中のみ）
    if (state.status === 'running') {
      const written = count - state.startWordCount;
      if (written >= getTargetWords()) {
        get()._finish();
      }
    }
  },

  _tick: () => {
    const state = get();
    const next = state.timeRemaining - 1;

    if (next <= 0) {
      // 時間切れ
      get()._finish();
    } else {
      set({ timeRemaining: next });
    }
  },

  _finish: () => {
    const state = get();
    const { _intervalId } = state;
    if (_intervalId) clearInterval(_intervalId);

    const totalSeconds = getSprintSeconds();
    const wordsTarget = getTargetWords();
    const wordsWritten = Math.max(0, state.currentWordCount - state.startWordCount);
    const achieved = wordsWritten >= wordsTarget;
    const elapsedSeconds = totalSeconds - state.timeRemaining;
    const completed = state.sprintsCompleted + 1;

    const result: SprintResult = {
      achieved,
      wordsWritten,
      wordsTarget,
      elapsedSeconds,
      totalSeconds,
    };

    set({
      status: 'finished',
      sprintsCompleted: completed,
      lastResult: result,
      _intervalId: null,
    });

    if (achieved) {
      useToastStore.getState().show(
        'success',
        `目標達成！ ${wordsWritten.toLocaleString()}文字を書きました（${Math.floor(elapsedSeconds / 60)}分${elapsedSeconds % 60}秒）`,
        { label: 'もう1回', onClick: () => get().start(state.currentWordCount) },
      );
    } else {
      useToastStore.getState().show(
        'info',
        `スプリント終了！ ${wordsWritten.toLocaleString()} / ${wordsTarget.toLocaleString()}文字（${Math.round((wordsWritten / wordsTarget) * 100)}%）`,
        { label: 'リトライ', onClick: () => get().start(state.currentWordCount) },
      );
    }
  },
}));
