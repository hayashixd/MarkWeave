/**
 * AI API クライアント（セキュリティ設計書 §4.6 準拠）
 *
 * WebView から外部 API を直接呼ぶことは CSP `connect-src` により禁止されている。
 * すべての AI API 通信は Tauri コマンド（Rust）経由で行う。
 */

import { invoke } from '@tauri-apps/api/core';

export interface AiRequest {
  provider: 'anthropic' | 'openai';
  model: string;
  prompt: string;
  maxTokens: number;
}

export interface AiResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * AI API を Rust 経由で呼び出す。
 * WebView から直接 API を叩くことは CSP により禁止されている。
 */
export async function callAiApi(request: AiRequest): Promise<AiResponse> {
  return invoke<AiResponse>('call_ai_api', {
    request: {
      provider: request.provider,
      model: request.model,
      prompt: request.prompt,
      max_tokens: request.maxTokens,
    },
  });
}
