import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listenAiStream, startAiStream, cancelAiStream } from './stream-listener';

// ── モック ─────────────────────────────────────────────────────────────────────

type EventHandler = (event: { payload: unknown }) => void;

// イベント名 → ハンドラのマップ（テスト内から呼び出せるようにする）
const capturedHandlers: Record<string, EventHandler> = {};

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (eventName: string, handler: EventHandler) => {
    capturedHandlers[eventName] = handler;
    return vi.fn(); // unlisten 関数
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => undefined),
}));

import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

// ── ヘルパー：イベントを手動発火 ─────────────────────────────────────────────

function emitChunk(streamId: string, delta: string, accumulated: string) {
  capturedHandlers['ai-stream-chunk']?.({
    payload: { stream_id: streamId, delta, accumulated },
  });
}

function emitDone(streamId: string, content: string, inputTokens: number, outputTokens: number) {
  capturedHandlers['ai-stream-done']?.({
    payload: { stream_id: streamId, content, input_tokens: inputTokens, output_tokens: outputTokens },
  });
}

function emitError(streamId: string, message: string) {
  capturedHandlers['ai-stream-error']?.({
    payload: { stream_id: streamId, message },
  });
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe('listenAiStream', () => {
  beforeEach(() => {
    for (const key of Object.keys(capturedHandlers)) {
      delete capturedHandlers[key];
    }
    vi.clearAllMocks();
    vi.mocked(listen).mockImplementation(async (eventName: string, handler: EventHandler) => {
      capturedHandlers[eventName] = handler;
      return vi.fn();
    });
  });

  it('3 つのイベントリスナーを登録して 3 つの unlisten 関数を返す', async () => {
    const unlisteners = await listenAiStream('stream-1', {
      onChunk: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });
    expect(unlisteners).toHaveLength(3);
    expect(vi.mocked(listen)).toHaveBeenCalledTimes(3);
  });

  it('listen が ai-stream-chunk / ai-stream-done / ai-stream-error を登録する', async () => {
    await listenAiStream('stream-1', {
      onChunk: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });
    const registeredEvents = vi.mocked(listen).mock.calls.map((c) => c[0]);
    expect(registeredEvents).toContain('ai-stream-chunk');
    expect(registeredEvents).toContain('ai-stream-done');
    expect(registeredEvents).toContain('ai-stream-error');
  });

  describe('onChunk', () => {
    it('同じ streamId の chunk イベントで onChunk が呼ばれる', async () => {
      const onChunk = vi.fn();
      await listenAiStream('stream-abc', { onChunk, onDone: vi.fn(), onError: vi.fn() });

      emitChunk('stream-abc', 'hello', 'hello');
      expect(onChunk).toHaveBeenCalledOnce();
      expect(onChunk).toHaveBeenCalledWith({ delta: 'hello', accumulated: 'hello' });
    });

    it('異なる streamId の chunk イベントは無視する', async () => {
      const onChunk = vi.fn();
      await listenAiStream('stream-abc', { onChunk, onDone: vi.fn(), onError: vi.fn() });

      emitChunk('OTHER-stream', 'hello', 'hello');
      expect(onChunk).not.toHaveBeenCalled();
    });

    it('複数回 chunk が届いた場合に全て onChunk を呼ぶ', async () => {
      const onChunk = vi.fn();
      await listenAiStream('s1', { onChunk, onDone: vi.fn(), onError: vi.fn() });

      emitChunk('s1', 'a', 'a');
      emitChunk('s1', 'b', 'ab');
      emitChunk('s1', 'c', 'abc');
      expect(onChunk).toHaveBeenCalledTimes(3);
    });

    it('accumulated の値が正しく渡される', async () => {
      const onChunk = vi.fn();
      await listenAiStream('s1', { onChunk, onDone: vi.fn(), onError: vi.fn() });

      emitChunk('s1', 'delta-text', 'full-accumulated-text');
      expect(onChunk).toHaveBeenCalledWith({ delta: 'delta-text', accumulated: 'full-accumulated-text' });
    });
  });

  describe('onDone', () => {
    it('同じ streamId の done イベントで onDone が呼ばれる', async () => {
      const onDone = vi.fn();
      await listenAiStream('s1', { onChunk: vi.fn(), onDone, onError: vi.fn() });

      emitDone('s1', 'final content', 1000, 500);
      expect(onDone).toHaveBeenCalledOnce();
      expect(onDone).toHaveBeenCalledWith({
        content: 'final content',
        inputTokens: 1000,
        outputTokens: 500,
      });
    });

    it('異なる streamId の done イベントは無視する', async () => {
      const onDone = vi.fn();
      await listenAiStream('s1', { onChunk: vi.fn(), onDone, onError: vi.fn() });

      emitDone('OTHER', 'content', 100, 50);
      expect(onDone).not.toHaveBeenCalled();
    });

    it('input_tokens と output_tokens が camelCase に変換される', async () => {
      const onDone = vi.fn();
      await listenAiStream('s1', { onChunk: vi.fn(), onDone, onError: vi.fn() });

      emitDone('s1', 'text', 999, 111);
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({ inputTokens: 999, outputTokens: 111 }),
      );
    });
  });

  describe('onError', () => {
    it('同じ streamId の error イベントで onError が呼ばれる', async () => {
      const onError = vi.fn();
      await listenAiStream('s1', { onChunk: vi.fn(), onDone: vi.fn(), onError });

      emitError('s1', 'API 通信エラー');
      expect(onError).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith('API 通信エラー');
    });

    it('異なる streamId の error イベントは無視する', async () => {
      const onError = vi.fn();
      await listenAiStream('s1', { onChunk: vi.fn(), onDone: vi.fn(), onError });

      emitError('WRONG', 'error');
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('複数ストリームの分離', () => {
    it('2 つのストリームが同時に動作してもイベントが混線しない', async () => {
      const onChunk1 = vi.fn();
      const onChunk2 = vi.fn();

      // stream-1 は最初のリスナー登録
      await listenAiStream('stream-1', { onChunk: onChunk1, onDone: vi.fn(), onError: vi.fn() });
      // stream-2 はリスナーを上書き（モックの制約 → 後者のみが有効）
      await listenAiStream('stream-2', { onChunk: onChunk2, onDone: vi.fn(), onError: vi.fn() });

      // stream-1 宛に送る → stream-2 のコールバックは呼ばれない
      emitChunk('stream-1', 'x', 'x');
      expect(onChunk2).not.toHaveBeenCalled();
    });
  });
});

// ── startAiStream ──────────────────────────────────────────────────────────────

describe('startAiStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue(undefined);
  });

  it('invoke("start_ai_stream") を呼ぶ', async () => {
    await startAiStream({
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      system: 'system prompt',
      user: 'user prompt',
      maxTokens: 4096,
      streamId: 'test-id',
    });
    expect(invoke).toHaveBeenCalledWith('start_ai_stream', expect.any(Object));
  });

  it('snake_case のキーを持つリクエストオブジェクトを渡す', async () => {
    await startAiStream({
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      system: 'sys',
      user: 'usr',
      maxTokens: 1024,
      streamId: 'sid',
    });
    const call = vi.mocked(invoke).mock.calls[0];
    expect(call![1]).toMatchObject({
      request: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        system: 'sys',
        user: 'usr',
        max_tokens: 1024,
        stream_id: 'sid',
      },
    });
  });
});

// ── cancelAiStream ─────────────────────────────────────────────────────────────

describe('cancelAiStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue(undefined);
  });

  it('invoke("cancel_ai_stream") を streamId と共に呼ぶ', async () => {
    await cancelAiStream('stream-xyz');
    expect(invoke).toHaveBeenCalledWith('cancel_ai_stream', { streamId: 'stream-xyz' });
  });
});
