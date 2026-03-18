import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export interface StreamChunkPayload {
  stream_id: string;
  delta: string;
  accumulated: string;
}

export interface StreamDonePayload {
  stream_id: string;
  content: string;
  input_tokens: number;
  output_tokens: number;
}

export interface StreamErrorPayload {
  stream_id: string;
  message: string;
}

export interface StreamCallbacks {
  onChunk: (chunk: { delta: string; accumulated: string }) => void;
  onDone: (result: {
    content: string;
    inputTokens: number;
    outputTokens: number;
  }) => void;
  onError: (message: string) => void;
}

export interface AiStreamRequest {
  provider: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  streamId: string;
}

/**
 * AI ストリーミングイベントのリスナーを登録する。
 * streamId でフィルタリングし、他のストリームのイベントは無視する。
 */
export async function listenAiStream(
  streamId: string,
  callbacks: StreamCallbacks,
): Promise<UnlistenFn[]> {
  const unlisteners = await Promise.all([
    listen<StreamChunkPayload>('ai-stream-chunk', (e) => {
      if (e.payload.stream_id === streamId) {
        callbacks.onChunk({
          delta: e.payload.delta,
          accumulated: e.payload.accumulated,
        });
      }
    }),
    listen<StreamDonePayload>('ai-stream-done', (e) => {
      if (e.payload.stream_id === streamId) {
        callbacks.onDone({
          content: e.payload.content,
          inputTokens: e.payload.input_tokens,
          outputTokens: e.payload.output_tokens,
        });
      }
    }),
    listen<StreamErrorPayload>('ai-stream-error', (e) => {
      if (e.payload.stream_id === streamId) {
        callbacks.onError(e.payload.message);
      }
    }),
  ]);
  return unlisteners;
}

export async function startAiStream(request: AiStreamRequest): Promise<void> {
  await invoke('start_ai_stream', {
    request: {
      provider: request.provider,
      model: request.model,
      system: request.system,
      user: request.user,
      max_tokens: request.maxTokens,
      stream_id: request.streamId,
    },
  });
}

export async function cancelAiStream(streamId: string): Promise<void> {
  await invoke('cancel_ai_stream', { streamId });
}
