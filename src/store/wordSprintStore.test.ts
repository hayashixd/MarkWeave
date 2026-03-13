import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useWordSprintStore } from './wordSprintStore';

vi.mock('./settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      settings: {
        editor: {
          wordSprintDurationMinutes: 10,
          wordSprintTargetWords: 500,
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

describe('wordSprintStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useWordSprintStore.setState({
      status: 'idle',
      timeRemaining: 600,
      startWordCount: 0,
      currentWordCount: 0,
      sprintsCompleted: 0,
      lastResult: null,
      _intervalId: null,
    });
  });

  afterEach(() => {
    const state = useWordSprintStore.getState();
    if (state._intervalId) clearInterval(state._intervalId);
    vi.useRealTimers();
  });

  it('initializes with idle status', () => {
    const state = useWordSprintStore.getState();
    expect(state.status).toBe('idle');
    expect(state.timeRemaining).toBe(600);
  });

  it('starts a sprint', () => {
    useWordSprintStore.getState().start(100);
    const state = useWordSprintStore.getState();
    expect(state.status).toBe('running');
    expect(state.startWordCount).toBe(100);
    expect(state.currentWordCount).toBe(100);
    expect(state._intervalId).not.toBeNull();
  });

  it('does not start if already running', () => {
    useWordSprintStore.getState().start(100);
    const id1 = useWordSprintStore.getState()._intervalId;
    useWordSprintStore.getState().start(200);
    const id2 = useWordSprintStore.getState()._intervalId;
    expect(id1).toBe(id2);
    // startWordCount should remain 100
    expect(useWordSprintStore.getState().startWordCount).toBe(100);
  });

  it('pauses and resumes', () => {
    useWordSprintStore.getState().start(100);
    useWordSprintStore.getState().pause();
    expect(useWordSprintStore.getState().status).toBe('paused');
    expect(useWordSprintStore.getState()._intervalId).toBeNull();

    useWordSprintStore.getState().resume();
    expect(useWordSprintStore.getState().status).toBe('running');
    expect(useWordSprintStore.getState()._intervalId).not.toBeNull();
  });

  it('resume does nothing if not paused', () => {
    useWordSprintStore.getState().resume();
    expect(useWordSprintStore.getState().status).toBe('idle');
  });

  it('resets to idle', () => {
    useWordSprintStore.getState().start(100);
    vi.advanceTimersByTime(5000);
    useWordSprintStore.getState().reset();
    const state = useWordSprintStore.getState();
    expect(state.status).toBe('idle');
    expect(state.startWordCount).toBe(0);
    expect(state.currentWordCount).toBe(0);
    expect(state.lastResult).toBeNull();
  });

  it('decrements timeRemaining on tick', () => {
    useWordSprintStore.getState().start(100);
    vi.advanceTimersByTime(3000);
    expect(useWordSprintStore.getState().timeRemaining).toBe(597);
  });

  it('finishes when time runs out', () => {
    // start() resets timeRemaining from settings (600s), so advance the full duration
    useWordSprintStore.getState().start(100);
    vi.advanceTimersByTime(599 * 1000);
    expect(useWordSprintStore.getState().status).toBe('running');
    vi.advanceTimersByTime(1000);
    const state = useWordSprintStore.getState();
    expect(state.status).toBe('finished');
    expect(state.sprintsCompleted).toBe(1);
    expect(state.lastResult).not.toBeNull();
  });

  it('updateWordCount updates during running', () => {
    useWordSprintStore.getState().start(100);
    useWordSprintStore.getState().updateWordCount(200);
    expect(useWordSprintStore.getState().currentWordCount).toBe(200);
  });

  it('updateWordCount triggers finish when target reached', () => {
    useWordSprintStore.getState().start(100);
    useWordSprintStore.getState().updateWordCount(600); // 500 written >= 500 target
    expect(useWordSprintStore.getState().status).toBe('finished');
    expect(useWordSprintStore.getState().lastResult!.achieved).toBe(true);
  });

  it('updateWordCount does nothing when idle', () => {
    useWordSprintStore.getState().updateWordCount(999);
    expect(useWordSprintStore.getState().currentWordCount).toBe(0);
  });

  it('updateWordCount works in paused state', () => {
    useWordSprintStore.getState().start(100);
    useWordSprintStore.getState().pause();
    useWordSprintStore.getState().updateWordCount(200);
    expect(useWordSprintStore.getState().currentWordCount).toBe(200);
  });

  it('lastResult reports correct wordsWritten', () => {
    useWordSprintStore.getState().start(100);
    useWordSprintStore.getState().updateWordCount(350);
    // Force time to expire
    useWordSprintStore.setState({ timeRemaining: 1 });
    vi.advanceTimersByTime(1000);
    const result = useWordSprintStore.getState().lastResult!;
    expect(result.wordsWritten).toBe(250);
    expect(result.wordsTarget).toBe(500);
    expect(result.achieved).toBe(false);
  });
});
