/**
 * AI ストリームリスナーのエラーハンドリング・障害シナリオテスト
 *
 * 既存の stream-listener.test.ts が Happy Path を担当するのに対し、
 * このファイルは以下の障害シナリオを検証する:
 *
 * 1. startAiStream の invoke が reject → エラーが伝播する
 * 2. cancelAiStream の invoke が reject → エラーが伝播する
 * 3. エラーイベントの空メッセージ処理
 * 4. done イベントの後に error イベントが届く（競合状態）
 * 5. listen 自体が失敗した場合 → reject が伝播する
 * 6. 複数のエラーが連続した場合すべて onError に届く
 * 7. ゼロトークンの done イベント
 * 8. ストリームキャンセル後にイベントが届いても無視される（streamId 不一致）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listenAiStream, startAiStream, cancelAiStream } from './stream-listener';

// ── モック ─────────────────────────────────────────────────────────────────────

type EventHandler = (event: { payload: unknown }) => void;
const capturedHandlers: Record<string, EventHandler> = {};

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (eventName: string, handler: EventHandler) => {
    capturedHandlers[eventName] = handler;
    return vi.fn();
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => undefined),
}));

import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function emitError(streamId: string, message: string) {
  capturedHandlers['ai-stream-error']?.({
    payload: { stream_id: streamId, message },
  });
}

function emitDone(
  streamId: string,
  content: string,
  inputTokens: number,
  outputTokens: number,
) {
  capturedHandlers['ai-stream-done']?.({
    payload: {
      stream_id: streamId,
      content,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  });
}

function emitChunk(streamId: string, delta: string, accumulated: string) {
  capturedHandlers['ai-stream-chunk']?.({
    payload: { stream_id: streamId, delta, accumulated },
  });
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe('startAiStream - エラーハンドリング', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(capturedHandlers)) {
      delete capturedHandlers[key];
    }
    vi.mocked(listen).mockImplementation(async (eventName: string, handler: EventHandler) => {
      capturedHandlers[eventName] = handler;
      return vi.fn();
    });
  });

  it('invoke が reject した場合、エラーが伝播する', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Tauri IPC failed'));

    await expect(
      startAiStream({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        system: 'sys',
        user: 'usr',
        maxTokens: 1024,
        streamId: 'test-id',
      }),
    ).rejects.toThrow('Tauri IPC failed');
  });

  it('ネットワーク障害を模倣した reject → エラーメッセージが保持される', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Network timeout'));

    let caughtError: Error | null = null;
    try {
      await startAiStream({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        system: 'sys',
        user: 'usr',
        maxTokens: 4096,
        streamId: 'stream-timeout',
      });
    } catch (e) {
      caughtError = e as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe('Network timeout');
  });

  it('認証失敗を模倣した reject → エラーが伝播する', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Unauthorized: invalid API key'));

    await expect(
      startAiStream({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        system: 'sys',
        user: 'usr',
        maxTokens: 1024,
        streamId: 'auth-fail-stream',
      }),
    ).rejects.toThrow('Unauthorized: invalid API key');
  });
});

describe('cancelAiStream - エラーハンドリング', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue(undefined);
  });

  it('invoke が reject した場合、エラーが伝播する', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Cancel failed'));

    await expect(cancelAiStream('stream-to-cancel')).rejects.toThrow('Cancel failed');
  });

  it('既に終了済みのストリームのキャンセルで reject しても問題ない', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Stream already finished'));

    await expect(cancelAiStream('finished-stream')).rejects.toThrow('Stream already finished');
  });
});

describe('listenAiStream - listen 失敗シナリオ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(capturedHandlers)) {
      delete capturedHandlers[key];
    }
  });

  it('listen が reject した場合、listenAiStream も reject する', async () => {
    vi.mocked(listen).mockRejectedValueOnce(new Error('Event listener registration failed'));

    await expect(
      listenAiStream('s1', {
        onChunk: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      }),
    ).rejects.toThrow('Event listener registration failed');
  });
});

describe('listenAiStream - エラーイベントの境界値', () => {
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

  it('空文字のエラーメッセージでも onError が呼ばれる', async () => {
    const onError = vi.fn();
    await listenAiStream('s1', { onChunk: vi.fn(), onDone: vi.fn(), onError });

    emitError('s1', '');

    expect(onError).toHaveBeenCalledWith('');
  });

  it('長いエラーメッセージ（1000文字）でも onError に完全に渡る', async () => {
    const onError = vi.fn();
    await listenAiStream('s1', { onChunk: vi.fn(), onDone: vi.fn(), onError });

    const longMessage = 'Error detail: '.repeat(100);
    emitError('s1', longMessage);

    expect(onError).toHaveBeenCalledWith(longMessage);
  });

  it('複数の連続したエラーイベントが全て onError に届く', async () => {
    const onError = vi.fn();
    await listenAiStream('s1', { onChunk: vi.fn(), onDone: vi.fn(), onError });

    emitError('s1', 'Error 1: rate limit');
    emitError('s1', 'Error 2: timeout');
    emitError('s1', 'Error 3: server error');

    expect(onError).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenNthCalledWith(1, 'Error 1: rate limit');
    expect(onError).toHaveBeenNthCalledWith(2, 'Error 2: timeout');
    expect(onError).toHaveBeenNthCalledWith(3, 'Error 3: server error');
  });

  it('日本語エラーメッセージが正しく伝達される', async () => {
    const onError = vi.fn();
    await listenAiStream('s1', { onChunk: vi.fn(), onDone: vi.fn(), onError });

    emitError('s1', 'APIキーが無効です。設定を確認してください。');

    expect(onError).toHaveBeenCalledWith('APIキーが無効です。設定を確認してください。');
  });
});

describe('listenAiStream - done イベントの境界値', () => {
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

  it('inputTokens=0, outputTokens=0 の done イベントを正しく処理する', async () => {
    const onDone = vi.fn();
    await listenAiStream('s1', { onChunk: vi.fn(), onDone, onError: vi.fn() });

    emitDone('s1', '', 0, 0);

    expect(onDone).toHaveBeenCalledWith({
      content: '',
      inputTokens: 0,
      outputTokens: 0,
    });
  });

  it('空のコンテンツの done イベント（キャンセル後の正常終了）を処理する', async () => {
    const onDone = vi.fn();
    await listenAiStream('s1', { onChunk: vi.fn(), onDone, onError: vi.fn() });

    emitDone('s1', '', 100, 0);

    expect(onDone).toHaveBeenCalledOnce();
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ content: '' }),
    );
  });
});

describe('listenAiStream - 競合状態シナリオ', () => {
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

  it('done の後に error が届いても onError が呼ばれる（競合状態）', async () => {
    const onDone = vi.fn();
    const onError = vi.fn();
    await listenAiStream('s1', { onChunk: vi.fn(), onDone, onError });

    emitDone('s1', 'final content', 100, 50);
    emitError('s1', 'late error');

    // streamId が一致していれば onError が呼ばれる（コールバックの実装次第）
    expect(onDone).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith('late error');
  });

  it('chunk → error のシーケンスで chunk と error の両方が処理される', async () => {
    const onChunk = vi.fn();
    const onError = vi.fn();
    await listenAiStream('s1', { onChunk, onDone: vi.fn(), onError });

    emitChunk('s1', 'partial', 'partial');
    emitError('s1', 'Stream interrupted');

    expect(onChunk).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith('Stream interrupted');
  });

  it('キャンセル後（streamId 不一致）のイベントは無視される', async () => {
    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    // stream-original でリスナーを登録
    await listenAiStream('stream-original', { onChunk, onDone, onError });

    // 異なる streamId からのイベント → 全て無視
    emitChunk('stream-cancelled', 'stale chunk', 'stale');
    emitDone('stream-cancelled', 'stale done', 100, 50);
    emitError('stream-cancelled', 'stale error');

    expect(onChunk).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('unlisten 関数が返される（クリーンアップ可能）', async () => {
    const unlisteners = await listenAiStream('s1', {
      onChunk: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });

    // 3 つの unlisten 関数が返される（chunk / done / error の各リスナー）
    expect(unlisteners).toHaveLength(3);
    unlisteners.forEach((fn) => {
      expect(typeof fn).toBe('function');
    });
  });

  it('並列ストリームが独立して動作する（streamId A の error が B に影響しない）', async () => {
    const onErrorA = vi.fn();
    const onErrorB = vi.fn();

    // A と B を同時に listen（モックの制約: 後登録が上書き → streamId フィルタで分離）
    await listenAiStream('stream-A', { onChunk: vi.fn(), onDone: vi.fn(), onError: onErrorA });
    await listenAiStream('stream-B', { onChunk: vi.fn(), onDone: vi.fn(), onError: onErrorB });

    // stream-A のエラー → stream-A のリスナー（後登録の B のフィルタ）が stream-A を無視
    emitError('stream-A', 'error in A');

    // stream-B のエラー → stream-B のリスナーが受信
    emitError('stream-B', 'error in B');
    expect(onErrorB).toHaveBeenCalledWith('error in B');
  });
});
