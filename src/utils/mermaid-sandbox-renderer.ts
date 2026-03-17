/**
 * Mermaid sandbox iframe レンダラー（security-design.md §4.1.2 準拠）
 *
 * 主 WebView で mermaid.render() を直接実行する代わりに、
 * sandbox iframe 内で Mermaid を実行し、生成された SVG を
 * DOMPurify でサニタイズしてから返す。
 *
 * これにより、主 WebView の CSP（script-src 'self'）を汚染せず、
 * Mermaid が使用する unsafe-eval を隔離環境に閉じ込める。
 */

import { sanitizeMermaidSvg } from './dompurify-config';

const RENDER_TIMEOUT_MS = 10_000;

let requestIdCounter = 0;

interface PendingRequest {
  resolve: (svg: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingRequests = new Map<string, PendingRequest>();
let sandboxIframe: HTMLIFrameElement | null = null;
let sandboxReady = false;
let readyPromise: Promise<void> | null = null;

function ensureSandbox(): Promise<void> {
  if (sandboxReady && sandboxIframe?.parentElement) {
    return Promise.resolve();
  }

  if (readyPromise) return readyPromise;

  readyPromise = new Promise<void>((resolve, reject) => {
    // 既存の iframe を破棄
    if (sandboxIframe) {
      sandboxIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.src = '/mermaid-sandbox.html';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    sandboxIframe = iframe;

    const timeout = setTimeout(() => {
      iframe.remove();
      sandboxIframe = null;
      readyPromise = null;
      reject(new Error('Mermaid sandbox の初期化がタイムアウトしました'));
    }, RENDER_TIMEOUT_MS);

    const onReady = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      if (event.data?.type !== 'mermaid-sandbox-ready') return;

      clearTimeout(timeout);
      window.removeEventListener('message', onReady);

      if (event.data.error) {
        iframe.remove();
        sandboxIframe = null;
        readyPromise = null;
        reject(new Error(event.data.error));
        return;
      }

      sandboxReady = true;
      resolve();
    };

    window.addEventListener('message', onReady);
  });

  return readyPromise;
}

// グローバルメッセージハンドラ（結果受信用）
window.addEventListener('message', (event) => {
  if (event.data?.type !== 'mermaid-result') return;

  const requestId = event.data.requestId as string;
  const pending = pendingRequests.get(requestId);
  if (!pending) return;

  clearTimeout(pending.timer);
  pendingRequests.delete(requestId);

  if (event.data.error) {
    pending.reject(new Error(event.data.error));
  } else {
    // DOMPurify でサニタイズしてから返す
    const safeSvg = sanitizeMermaidSvg(event.data.svg);
    pending.resolve(safeSvg);
  }
});

/**
 * Mermaid ダイアグラムを sandbox iframe 経由でレンダリングする。
 *
 * @param definition Mermaid 記法の定義文字列
 * @returns サニタイズ済み SVG 文字列
 */
export async function renderMermaidInSandbox(definition: string): Promise<string> {
  await ensureSandbox();

  if (!sandboxIframe?.contentWindow) {
    throw new Error('Mermaid sandbox iframe が利用できません');
  }

  const requestId = String(++requestIdCounter);

  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Mermaid レンダリングタイムアウト'));
    }, RENDER_TIMEOUT_MS);

    pendingRequests.set(requestId, { resolve, reject, timer });

    sandboxIframe!.contentWindow!.postMessage(
      { type: 'render', definition, requestId },
      '*',
    );
  });
}

/**
 * sandbox iframe を破棄してリソースを解放する。
 */
export function destroyMermaidSandbox(): void {
  if (sandboxIframe) {
    sandboxIframe.remove();
    sandboxIframe = null;
  }
  sandboxReady = false;
  readyPromise = null;

  // 保留中のリクエストをすべてキャンセル
  for (const [, pending] of pendingRequests) {
    clearTimeout(pending.timer);
    pending.reject(new Error('Mermaid sandbox が破棄されました'));
  }
  pendingRequests.clear();
}
