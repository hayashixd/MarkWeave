import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { usePomodoroStore } from './pomodoroStore';

// settingsStore のデフォルト値をモック
vi.mock('./settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      settings: {
        editor: {
          pomodoroWorkMinutes: 25,
          pomodoroBreakMinutes: 5,
        },
      },
    }),
  },
}));

vi.mock('./toastStore', () => ({
  useToastStore: {
    getState: () => ({
      show: vi.fn(),
    }),
  },
}));

describe('pomodoroStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    usePomodoroStore.setState({
      isRunning: false,
      phase: 'work',
      timeRemaining: 25 * 60,
      sessionsCompleted: 0,
      _intervalId: null,
    });
  });

  afterEach(() => {
    // 念のためインターバルをクリア
    const state = usePomodoroStore.getState();
    if (state._intervalId) clearInterval(state._intervalId);
    vi.useRealTimers();
  });

  it('initializes with work phase', () => {
    const state = usePomodoroStore.getState();
    expect(state.phase).toBe('work');
    expect(state.isRunning).toBe(false);
    expect(state.timeRemaining).toBe(25 * 60);
  });

  it('starts the timer', () => {
    usePomodoroStore.getState().start();
    const state = usePomodoroStore.getState();
    expect(state.isRunning).toBe(true);
    expect(state._intervalId).not.toBeNull();
  });

  it('does not start again if already running', () => {
    usePomodoroStore.getState().start();
    const id1 = usePomodoroStore.getState()._intervalId;
    usePomodoroStore.getState().start();
    const id2 = usePomodoroStore.getState()._intervalId;
    expect(id1).toBe(id2);
  });

  it('pauses the timer', () => {
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().pause();
    const state = usePomodoroStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state._intervalId).toBeNull();
  });

  it('resets to work phase', () => {
    usePomodoroStore.getState().start();
    vi.advanceTimersByTime(5000);
    usePomodoroStore.getState().reset();
    const state = usePomodoroStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.phase).toBe('work');
    expect(state.timeRemaining).toBe(25 * 60);
  });

  it('decrements timeRemaining on tick', () => {
    usePomodoroStore.getState().start();
    vi.advanceTimersByTime(1000);
    expect(usePomodoroStore.getState().timeRemaining).toBe(25 * 60 - 1);
  });

  it('transitions to break phase when work completes', () => {
    usePomodoroStore.setState({ timeRemaining: 1 });
    usePomodoroStore.getState().start();
    vi.advanceTimersByTime(1000);
    const state = usePomodoroStore.getState();
    expect(state.phase).toBe('break');
    expect(state.isRunning).toBe(false);
    expect(state.sessionsCompleted).toBe(1);
    expect(state.timeRemaining).toBe(5 * 60);
  });

  it('transitions to work phase when break completes', () => {
    usePomodoroStore.setState({
      phase: 'break',
      timeRemaining: 1,
      sessionsCompleted: 1,
    });
    usePomodoroStore.getState().start();
    vi.advanceTimersByTime(1000);
    const state = usePomodoroStore.getState();
    expect(state.phase).toBe('work');
    expect(state.isRunning).toBe(false);
  });

  it('skipBreak resets to work phase', () => {
    usePomodoroStore.setState({ phase: 'break', timeRemaining: 300 });
    usePomodoroStore.getState().skipBreak();
    const state = usePomodoroStore.getState();
    expect(state.phase).toBe('work');
    expect(state.isRunning).toBe(false);
    expect(state.timeRemaining).toBe(25 * 60);
  });

  it('start re-initializes when timeRemaining is 0', () => {
    usePomodoroStore.setState({ timeRemaining: 0 });
    usePomodoroStore.getState().start();
    expect(usePomodoroStore.getState().timeRemaining).toBe(25 * 60);
    expect(usePomodoroStore.getState().isRunning).toBe(true);
  });

  it('increments sessions completed through multiple cycles', () => {
    // Complete 2 work sessions
    usePomodoroStore.setState({ timeRemaining: 1 });
    usePomodoroStore.getState().start();
    vi.advanceTimersByTime(1000);
    expect(usePomodoroStore.getState().sessionsCompleted).toBe(1);

    // Skip break, complete another work session
    usePomodoroStore.getState().skipBreak();
    usePomodoroStore.setState({ timeRemaining: 1 });
    usePomodoroStore.getState().start();
    vi.advanceTimersByTime(1000);
    expect(usePomodoroStore.getState().sessionsCompleted).toBe(2);
  });
});
