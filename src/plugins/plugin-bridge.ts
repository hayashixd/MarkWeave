/**
 * PluginBridge - サードパーティプラグインとの iframe/postMessage 通信
 *
 * plugin-api-design.md §4, §10 に準拠。
 * - サードパーティプラグインは <iframe sandbox="allow-scripts"> で隔離
 * - postMessage で API 要求を受け取り、権限チェック後に実行
 * - 100ms デバウンスでエディタ変更を通知
 * - RTT 計測・遅延検知・自動無効化
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  PluginRequest,
  PluginResponse,
  PluginEvent,
  PluginPermission,
  EditorPlugin,
} from './plugin-api';
import { API_METHOD_PERMISSION_MAP } from './plugin-api';
import { pluginRegistry } from './plugin-registry';

// ---------------------------------------------------------------------------
// パフォーマンス定数
// ---------------------------------------------------------------------------

const EDITOR_CHANGE_DEBOUNCE_MS = 100;
const SLOW_THRESHOLD_MS = 50;
const MAX_SLOW_COUNT = 10;
const MAX_CONSECUTIVE_TIMEOUTS = 3;
const RTT_WINDOW = 20;

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface PluginPerfStats {
  recentRtts: number[];
  avgRtt: number;
  slowCount: number;
  timeoutCount: number;
}

export interface EditorChangePayload {
  markdown: string;
}

export interface SelectionPayload {
  from: number;
  to: number;
}

// ---------------------------------------------------------------------------
// PluginBridge
// ---------------------------------------------------------------------------

export class PluginBridge {
  private iframes = new Map<string, HTMLIFrameElement>();
  private pendingCalls = new Map<string, PendingCall>();
  private perfStats = new Map<string, PluginPerfStats>();
  private changeDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** エディタの getMarkdown 関数への参照（PluginManager がセットする）*/
  getMarkdownFn: (() => string) | null = null;

  /** エディタの insertText 関数への参照 */
  insertTextFn: ((text: string) => void) | null = null;

  /** プラグイン無効化コールバック（クラッシュ時）*/
  onPluginDisabled: ((pluginId: string, reason: string) => void) | null = null;

  constructor() {
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  // -------------------------------------------------------------------------
  // iframe 管理
  // -------------------------------------------------------------------------

  /** サードパーティプラグイン用の iframe を生成してプラグインを読み込む */
  createSandbox(plugin: EditorPlugin, pluginJs: string): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    iframe.id = `plugin-sandbox-${plugin.manifest.id}`;
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.style.display = 'none';

    // ランタイム HTML を src に設定（plugin-runtime.html）
    iframe.src = '/plugin-runtime.html';
    document.body.appendChild(iframe);

    // iframe ロード後にプラグインスクリプトを注入
    iframe.addEventListener('load', () => {
      iframe.contentWindow?.postMessage(
        { type: 'load_plugin', pluginJs },
        '*',
      );
    });

    this.iframes.set(plugin.manifest.id, iframe);
    this.perfStats.set(plugin.manifest.id, {
      recentRtts: [],
      avgRtt: 0,
      slowCount: 0,
      timeoutCount: 0,
    });

    return iframe;
  }

  /** プラグインの iframe を破棄する */
  destroySandbox(pluginId: string): void {
    const iframe = this.iframes.get(pluginId);
    if (iframe) {
      iframe.remove();
      this.iframes.delete(pluginId);
    }
    this.perfStats.delete(pluginId);

    // 保留中のタイマーをキャンセル
    const timer = this.changeDebounceTimers.get(pluginId);
    if (timer) {
      clearTimeout(timer);
      this.changeDebounceTimers.delete(pluginId);
    }
  }

  // -------------------------------------------------------------------------
  // postMessage ハンドラ
  // -------------------------------------------------------------------------

  private async handleMessage(event: MessageEvent): Promise<void> {
    const pluginId = this.getPluginIdFromFrame(event.source as Window);

    // PluginBridge → Plugin の応答受信（callId ベース）
    if (!pluginId) {
      const resp = event.data as PluginResponse;
      if (resp?.type === 'api_response') {
        const pending = this.pendingCalls.get(resp.callId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingCalls.delete(resp.callId);
          if (resp.error) {
            pending.reject(new Error(resp.error));
          } else {
            pending.resolve(resp.result);
          }
        }
      }
      return;
    }

    const req = event.data as PluginRequest;
    if (req?.type !== 'api_call') return;

    // 権限チェック
    const plugin = pluginRegistry.get(pluginId);
    if (!plugin) return;

    const requiredPermission = API_METHOD_PERMISSION_MAP[req.method];
    if (requiredPermission && !plugin.manifest.permissions.includes(requiredPermission as PluginPermission)) {
      this.sendResponse(event.source as Window, req.callId, {
        error: `権限がありません: ${req.method} には ${requiredPermission} が必要です`,
      });
      return;
    }

    // API 呼び出し実行
    try {
      const result = await this.executeApiCall(pluginId, req.method, req.args);
      this.sendResponse(event.source as Window, req.callId, { result });
    } catch (err) {
      this.sendResponse(event.source as Window, req.callId, { error: String(err) });
    }
  }

  private getPluginIdFromFrame(frameWindow: Window): string | null {
    for (const [pluginId, iframe] of this.iframes) {
      if (iframe.contentWindow === frameWindow) return pluginId;
    }
    return null;
  }

  private sendResponse(
    target: Window,
    callId: string,
    data: { result?: unknown; error?: string },
  ): void {
    const resp: PluginResponse = {
      type: 'api_response',
      callId,
      ...data,
    };
    target.postMessage(resp, '*');
  }

  // -------------------------------------------------------------------------
  // API 実行
  // -------------------------------------------------------------------------

  private async executeApiCall(
    pluginId: string,
    method: string,
    args: unknown[],
  ): Promise<unknown> {
    const startMs = performance.now();

    try {
      const result = await this.dispatchApiCall(pluginId, method, args);
      const rttMs = performance.now() - startMs;
      this.recordRtt(pluginId, rttMs, false);
      return result;
    } catch (err) {
      const rttMs = performance.now() - startMs;
      const isTimeout = String(err).includes('timeout');
      this.recordRtt(pluginId, rttMs, isTimeout);
      throw err;
    }
  }

  private async dispatchApiCall(
    pluginId: string,
    method: string,
    args: unknown[],
  ): Promise<unknown> {
    switch (method) {
      case 'editor.getMarkdown':
        return this.getMarkdownFn?.() ?? '';

      case 'editor.insertText': {
        const [text] = args as [string];
        this.insertTextFn?.(text);
        return undefined;
      }

      case 'fs.readFile': {
        const [path] = args as [string];
        return invoke<string>('plugin_read_file', { pluginId, path });
      }

      case 'fs.writeFile': {
        const [path, content] = args as [string, string];
        return invoke<void>('plugin_write_file', { pluginId, path, content });
      }

      case 'fs.listDirectory': {
        const [path] = args as [string];
        return invoke<string[]>('plugin_list_directory', { pluginId, path });
      }

      case 'clipboard.readText':
        return navigator.clipboard.readText();

      case 'clipboard.writeText': {
        const [text] = args as [string];
        await navigator.clipboard.writeText(text);
        return undefined;
      }

      case 'network.fetch': {
        const [url, options] = args as [string, RequestInit];
        const resp = await fetch(url, options);
        return resp.text();
      }

      case 'ui.showToast': {
        const [message, type] = args as [string, string];
        // toastStore へのブリッジ（実際のトースト表示は useEffect 等で処理）
        window.dispatchEvent(new CustomEvent('plugin:showToast', { detail: { message, type } }));
        return undefined;
      }

      default:
        throw new Error(`未実装の API メソッド: ${method}`);
    }
  }

  // -------------------------------------------------------------------------
  // RTT 計測・パフォーマンス監視
  // -------------------------------------------------------------------------

  private recordRtt(pluginId: string, rttMs: number, isTimeout: boolean): void {
    const stats = this.getOrCreateStats(pluginId);

    stats.recentRtts.push(rttMs);
    if (stats.recentRtts.length > RTT_WINDOW) stats.recentRtts.shift();
    stats.avgRtt =
      stats.recentRtts.reduce((a, b) => a + b, 0) / stats.recentRtts.length;

    if (isTimeout) {
      stats.timeoutCount++;
      if (stats.timeoutCount >= MAX_CONSECUTIVE_TIMEOUTS) {
        const reason = `プラグインが ${MAX_CONSECUTIVE_TIMEOUTS} 回連続でタイムアウトしました`;
        this.onPluginDisabled?.(pluginId, reason);
      }
    } else {
      stats.timeoutCount = 0; // 成功したらリセット
    }

    if (rttMs > SLOW_THRESHOLD_MS) {
      stats.slowCount++;
      if (stats.slowCount >= MAX_SLOW_COUNT) {
        const reason = `プラグインのレスポンスが遅すぎます (平均 ${stats.avgRtt.toFixed(0)}ms)`;
        this.onPluginDisabled?.(pluginId, reason);
      }
    }
  }

  private getOrCreateStats(pluginId: string): PluginPerfStats {
    if (!this.perfStats.has(pluginId)) {
      this.perfStats.set(pluginId, {
        recentRtts: [],
        avgRtt: 0,
        slowCount: 0,
        timeoutCount: 0,
      });
    }
    return this.perfStats.get(pluginId)!;
  }

  // -------------------------------------------------------------------------
  // エディタイベント通知
  // -------------------------------------------------------------------------

  /**
   * エディタ変更をすべてのプラグインに通知する（100ms デバウンス付き）。
   */
  notifyEditorChange(payload: EditorChangePayload): void {
    for (const [pluginId, iframe] of this.iframes) {
      const existing = this.changeDebounceTimers.get(pluginId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        this.changeDebounceTimers.delete(pluginId);
        const event: PluginEvent = {
          type: 'editor_event',
          eventName: 'editor:onChange',
          payload,
        };
        iframe.contentWindow?.postMessage(event, '*');
      }, EDITOR_CHANGE_DEBOUNCE_MS);

      this.changeDebounceTimers.set(pluginId, timer);
    }
  }

  /**
   * 選択範囲変更をプラグインに通知する（fire-and-forget）。
   */
  notifySelectionChange(payload: SelectionPayload): void {
    for (const [, iframe] of this.iframes) {
      const event: PluginEvent = {
        type: 'editor_event',
        eventName: 'editor:onSelectionChange',
        payload,
      };
      iframe.contentWindow?.postMessage(event, '*');
    }
  }

  getStats(pluginId: string): PluginPerfStats | undefined {
    return this.perfStats.get(pluginId);
  }

  dispose(): void {
    window.removeEventListener('message', this.handleMessage.bind(this));
    for (const pluginId of this.iframes.keys()) {
      this.destroySandbox(pluginId);
    }
    for (const pending of this.pendingCalls.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('PluginBridge disposed'));
    }
    this.pendingCalls.clear();
  }
}

/** シングルトンの PluginBridge */
export const pluginBridge = new PluginBridge();
