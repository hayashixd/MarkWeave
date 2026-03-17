/**
 * mermaid-sandbox-renderer のユニットテスト
 *
 * jsdom 環境で動作するため:
 * - iframe の DOM 作成・属性検証
 * - postMessage を介した sandbox との通信シミュレーション
 * - タイムアウト・エラー・キャンセルの各パス
 * を検証する。
 *
 * sanitizeMermaidSvg はモックし、呼び出し確認のみ行う。
 * SVG サニタイズ自体は dompurify-config.test.ts で検証済み。
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderMermaidInSandbox, destroyMermaidSandbox } from './mermaid-sandbox-renderer';

// sanitizeMermaidSvg を "sanitized:<svg>" 形式に置き換えてモック
// → サニタイズ関数が呼ばれたこと・元 svg が渡されたことを検証できる
vi.mock('./dompurify-config', () => ({
  sanitizeMermaidSvg: (svg: string) => `sanitized:${svg}`,
}));

// ── ヘルパー ──────────────────────────────────────────────────────────────────

/** 現在 DOM にある mermaid sandbox iframe を取得する */
function getSandboxIframe(): HTMLIFrameElement | null {
  return document.querySelector<HTMLIFrameElement>('iframe[src="/mermaid-sandbox.html"]');
}

/**
 * sandbox iframe から "準備完了" メッセージを発火する。
 * event.source を iframe.contentWindow に設定することで、
 * renderer 内の source チェックを通過させる。
 */
function dispatchSandboxReady(iframeEl: HTMLIFrameElement, error?: string) {
  window.dispatchEvent(
    new MessageEvent('message', {
      source: iframeEl.contentWindow,
      data: {
        type: 'mermaid-sandbox-ready',
        ...(error !== undefined ? { error } : {}),
      },
    }),
  );
}

/**
 * sandbox から mermaid-result を発火する。
 * グローバルメッセージハンドラは source を確認しないため source 設定不要。
 */
function dispatchRenderResult(requestId: string, svg?: string, error?: string) {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        type: 'mermaid-result',
        requestId,
        ...(svg !== undefined ? { svg } : {}),
        ...(error !== undefined ? { error } : {}),
      },
    }),
  );
}

/**
 * setTimeout(resolve, 0) で macrotask 境界を超えることにより、
 * 積まれているすべての microtask を確実にフラッシュする。
 * （fake timers を使う describe ブロックでは使用しないこと）
 */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * fake timers 環境でマイクロタスクをフラッシュするための多段 await。
 * Promise.resolve() は fake timers の影響を受けないため安全に使える。
 */
async function flushMicrotasks() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

/**
 * sandbox を "準備完了" 状態にしてダミー 1 リクエストを完了させるヘルパー。
 * 並行リクエストテスト等で "warm up" のために使う。
 * 戻り値の spy は warmup 後に mockClear() 済み。
 */
async function warmUpSandbox(): Promise<{
  iframe: HTMLIFrameElement;
  spy: ReturnType<typeof vi.spyOn>;
}> {
  const p = renderMermaidInSandbox('warmup');
  const iframe = getSandboxIframe()!;
  // postMessage をスパイしてから ready を発火
  const spy = vi.spyOn(
    iframe.contentWindow as Window & typeof globalThis,
    'postMessage',
  );
  dispatchSandboxReady(iframe);
  await tick();
  const firstId = (spy.mock.calls[0]?.[0] as { requestId: string } | undefined)?.requestId;
  if (firstId) dispatchRenderResult(firstId, '<svg/>');
  await p;
  spy.mockClear();
  return { iframe, spy };
}

// ── テスト ──────────────────────────────────────────────────────────────────

describe('mermaid-sandbox-renderer', () => {
  afterEach(() => {
    destroyMermaidSandbox();
    vi.restoreAllMocks();
  });

  // ── iframe 作成 ────────────────────────────────────────────────────────────
  describe('iframe の初期化', () => {
    it('renderMermaidInSandbox を呼ぶと iframe が DOM に追加される', () => {
      renderMermaidInSandbox('graph TD; A-->B').catch(() => {});
      expect(getSandboxIframe()).not.toBeNull();
    });

    it('iframe に sandbox="allow-scripts" 属性が設定される', () => {
      renderMermaidInSandbox('graph TD; A-->B').catch(() => {});
      const iframe = getSandboxIframe();
      expect(iframe?.getAttribute('sandbox')).toBe('allow-scripts');
    });

    it('iframe の src が /mermaid-sandbox.html になっている', () => {
      renderMermaidInSandbox('graph TD; A-->B').catch(() => {});
      const iframe = getSandboxIframe();
      expect(iframe?.src).toContain('/mermaid-sandbox.html');
    });

    it('iframe が display:none で非表示になっている', () => {
      renderMermaidInSandbox('graph TD; A-->B').catch(() => {});
      const iframe = getSandboxIframe();
      expect(iframe?.style.display).toBe('none');
    });
  });

  // ── sandbox 初期化 ─────────────────────────────────────────────────────────
  describe('sandbox の準備完了処理', () => {
    it('mermaid-sandbox-ready を受け取ると render postMessage が sandbox に送られる', async () => {
      const renderPromise = renderMermaidInSandbox('graph TD; A-->B');
      const iframe = getSandboxIframe()!;
      const spy = vi.spyOn(
        iframe.contentWindow as Window & typeof globalThis,
        'postMessage',
      );
      dispatchSandboxReady(iframe);
      await tick();

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'render', definition: 'graph TD; A-->B' }),
        '*',
      );
      // cleanup
      const id = (spy.mock.calls[0]?.[0] as { requestId: string }).requestId;
      dispatchRenderResult(id, '<svg/>');
      await renderPromise;
    });

    it('sandbox-ready に error フィールドがある場合、初期化が拒否される', async () => {
      const renderPromise = renderMermaidInSandbox('graph TD; A-->B');
      const iframe = getSandboxIframe()!;
      dispatchSandboxReady(iframe, 'Mermaid ライブラリの読み込みに失敗しました');

      await expect(renderPromise).rejects.toThrow(
        'Mermaid ライブラリの読み込みに失敗しました',
      );
    });

    it('source が iframe.contentWindow でないメッセージは無視される', async () => {
      const renderPromise = renderMermaidInSandbox('graph TD; A-->B');
      const iframe = getSandboxIframe()!;
      const spy = vi.spyOn(
        iframe.contentWindow as Window & typeof globalThis,
        'postMessage',
      );

      // 親ウィンドウを source とした偽の ready（攻撃者を想定）
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window,
          data: { type: 'mermaid-sandbox-ready' },
        }),
      );
      await tick();
      // render postMessage はまだ送られていないはず
      expect(spy).not.toHaveBeenCalled();

      // 正当な ready で後始末
      dispatchSandboxReady(iframe);
      await tick();
      const id = (spy.mock.calls[0]?.[0] as { requestId: string }).requestId;
      dispatchRenderResult(id, '<svg/>');
      await renderPromise;
    });

    it('2 回目の呼び出しで既存 sandbox が再利用され iframe は増えない', async () => {
      // 1 回目
      const p1 = renderMermaidInSandbox('graph TD; A-->B');
      const iframe = getSandboxIframe()!;
      const spy = vi.spyOn(
        iframe.contentWindow as Window & typeof globalThis,
        'postMessage',
      );
      dispatchSandboxReady(iframe);
      await tick();
      const id1 = (spy.mock.calls[0]?.[0] as { requestId: string }).requestId;
      dispatchRenderResult(id1, '<svg/>');
      await p1;

      // 2 回目: iframe 数が増えていないことを確認
      const p2 = renderMermaidInSandbox('graph LR; B-->C');
      await tick();
      expect(
        document.querySelectorAll('iframe[src="/mermaid-sandbox.html"]'),
      ).toHaveLength(1);
      const id2 = (spy.mock.calls[1]?.[0] as { requestId: string }).requestId;
      dispatchRenderResult(id2, '<svg/>');
      await p2;
    });
  });

  // ── レンダリング ──────────────────────────────────────────────────────────
  describe('renderMermaidInSandbox', () => {
    it('mermaid-result の svg を sanitizeMermaidSvg 経由で返す', async () => {
      const renderPromise = renderMermaidInSandbox('sequenceDiagram\nA->>B: Hello');
      const iframe = getSandboxIframe()!;
      const spy = vi.spyOn(
        iframe.contentWindow as Window & typeof globalThis,
        'postMessage',
      );
      dispatchSandboxReady(iframe);
      await tick();
      const id = (spy.mock.calls[0]?.[0] as { requestId: string }).requestId;
      dispatchRenderResult(id, '<svg><rect/></svg>');

      const result = await renderPromise;
      // mock により "sanitized:" プレフィックスが付く → sanitizeMermaidSvg が呼ばれた
      expect(result).toBe('sanitized:<svg><rect/></svg>');
    });

    it('mermaid-result の error フィールドで reject する', async () => {
      const renderPromise = renderMermaidInSandbox('invalid syntax @@@@');
      const iframe = getSandboxIframe()!;
      const spy = vi.spyOn(
        iframe.contentWindow as Window & typeof globalThis,
        'postMessage',
      );
      dispatchSandboxReady(iframe);
      await tick();
      const id = (spy.mock.calls[0]?.[0] as { requestId: string }).requestId;
      dispatchRenderResult(id, undefined, 'Parse error: unexpected token');

      await expect(renderPromise).rejects.toThrow('Parse error: unexpected token');
    });

    it('requestId が一致しない mermaid-result は無視される', async () => {
      const renderPromise = renderMermaidInSandbox('graph TD; A-->B');
      const iframe = getSandboxIframe()!;
      const spy = vi.spyOn(
        iframe.contentWindow as Window & typeof globalThis,
        'postMessage',
      );
      dispatchSandboxReady(iframe);
      await tick();
      const id = (spy.mock.calls[0]?.[0] as { requestId: string }).requestId;

      // 別の requestId で送る（無視されるはず）
      dispatchRenderResult('wrong-request-id', '<svg>wrong</svg>');

      // 正しい requestId で送る
      dispatchRenderResult(id, '<svg>correct</svg>');
      const result = await renderPromise;
      expect(result).toBe('sanitized:<svg>correct</svg>');
    });

    it('mermaid-result 以外の type は無視される', async () => {
      const renderPromise = renderMermaidInSandbox('graph TD; A-->B');
      const iframe = getSandboxIframe()!;
      const spy = vi.spyOn(
        iframe.contentWindow as Window & typeof globalThis,
        'postMessage',
      );
      dispatchSandboxReady(iframe);
      await tick();
      const id = (spy.mock.calls[0]?.[0] as { requestId: string }).requestId;

      // 無関係なメッセージを複数送る
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'other-event', requestId: id } }));
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'mermaid-sandbox-ready' } }));

      // 正しいメッセージで完了
      dispatchRenderResult(id, '<svg/>');
      await expect(renderPromise).resolves.toBe('sanitized:<svg/>');
    });

    it('3 つの並行リクエストが requestId で独立して管理される', async () => {
      const { spy } = await warmUpSandbox();

      const p1 = renderMermaidInSandbox('graph TD; A-->B');
      const p2 = renderMermaidInSandbox('graph LR; C-->D');
      const p3 = renderMermaidInSandbox('sequenceDiagram\nX->>Y: Hi');
      await tick();

      expect(spy).toHaveBeenCalledTimes(3);
      const ids = spy.mock.calls.map(
        (c) => (c[0] as { requestId: string }).requestId,
      );

      // 逆順に返す
      dispatchRenderResult(ids[2]!, '<svg>3</svg>');
      dispatchRenderResult(ids[0]!, '<svg>1</svg>');
      dispatchRenderResult(ids[1]!, '<svg>2</svg>');

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
      expect(r1).toBe('sanitized:<svg>1</svg>');
      expect(r2).toBe('sanitized:<svg>2</svg>');
      expect(r3).toBe('sanitized:<svg>3</svg>');
    });
  });

  // ── destroyMermaidSandbox ─────────────────────────────────────────────────
  describe('destroyMermaidSandbox', () => {
    it('iframe が DOM から削除される', () => {
      renderMermaidInSandbox('graph TD; A-->B').catch(() => {});
      expect(getSandboxIframe()).not.toBeNull();
      destroyMermaidSandbox();
      expect(getSandboxIframe()).toBeNull();
    });

    it('保留中のリクエストが "Mermaid sandbox が破棄されました" で reject される', async () => {
      const p = renderMermaidInSandbox('graph TD; A-->B');
      const iframe = getSandboxIframe()!;
      const spy = vi.spyOn(
        iframe.contentWindow as Window & typeof globalThis,
        'postMessage',
      );
      dispatchSandboxReady(iframe);
      await tick();
      // render postMessage は送られたが結果はまだ返っていない
      expect(spy).toHaveBeenCalled();

      destroyMermaidSandbox();
      await expect(p).rejects.toThrow('Mermaid sandbox が破棄されました');
    });

    it('複数の保留リクエストがすべて reject される', async () => {
      // sandbox を ready にしてから複数リクエストを保留中にする
      const p1 = renderMermaidInSandbox('graph TD; A-->B');
      const p2 = renderMermaidInSandbox('graph LR; C-->D');
      const iframe = getSandboxIframe()!;
      dispatchSandboxReady(iframe);
      await tick(); // p1, p2 が pendingRequests に追加される

      destroyMermaidSandbox();
      await Promise.all([
        expect(p1).rejects.toThrow('Mermaid sandbox が破棄されました'),
        expect(p2).rejects.toThrow('Mermaid sandbox が破棄されました'),
      ]);
    });

    it('destroy 後に呼ぶと新しい iframe が作られる', async () => {
      renderMermaidInSandbox('graph TD; A-->B').catch(() => {});
      const firstIframe = getSandboxIframe();
      destroyMermaidSandbox();
      expect(getSandboxIframe()).toBeNull();

      renderMermaidInSandbox('graph TD; C-->D').catch(() => {});
      const secondIframe = getSandboxIframe();
      expect(secondIframe).not.toBeNull();
      expect(secondIframe).not.toBe(firstIframe);
    });

    it('sandbox なしで destroy を呼んでもエラーにならない（冪等）', () => {
      expect(() => destroyMermaidSandbox()).not.toThrow();
      expect(() => destroyMermaidSandbox()).not.toThrow();
    });
  });

  // ── タイムアウト処理 ──────────────────────────────────────────────────────
  describe('タイムアウト処理', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('10 秒以内に sandbox-ready が来ない場合、初期化タイムアウトで reject される', async () => {
      const renderPromise = renderMermaidInSandbox('graph TD; A-->B');
      vi.advanceTimersByTime(10_001);
      await expect(renderPromise).rejects.toThrow(
        'Mermaid sandbox の初期化がタイムアウトしました',
      );
    });

    it('初期化タイムアウト後は readyPromise がリセットされ再試行可能', async () => {
      const p1 = renderMermaidInSandbox('graph TD; A-->B');
      const firstIframe = getSandboxIframe();
      vi.advanceTimersByTime(10_001);
      await p1.catch(() => {});

      // タイムアウト後は iframe が破棄され新しいものが作られるはず
      const p2 = renderMermaidInSandbox('graph TD; C-->D');
      const secondIframe = getSandboxIframe();
      expect(secondIframe).not.toBe(firstIframe);
      // cleanup
      vi.advanceTimersByTime(10_001);
      await p2.catch(() => {});
    });

    it('sandbox 準備完了後に 10 秒以内に result が来ない場合、レンダリングタイムアウトで reject される', async () => {
      const renderPromise = renderMermaidInSandbox('graph TD; A-->B');
      const iframe = getSandboxIframe()!;
      dispatchSandboxReady(iframe);
      // マイクロタスクをフラッシュして pendingRequests にリクエストを登録させる
      await flushMicrotasks();
      // レンダリングタイムアウトを発火
      vi.advanceTimersByTime(10_001);
      await expect(renderPromise).rejects.toThrow('Mermaid レンダリングタイムアウト');
    });

    it('レンダリングタイムアウト後は対象 requestId が pendingRequests から削除される（後続の同 ID メッセージは無視）', async () => {
      const p1 = renderMermaidInSandbox('graph TD; A-->B');
      const iframe = getSandboxIframe()!;
      const spy = vi.spyOn(
        iframe.contentWindow as Window & typeof globalThis,
        'postMessage',
      );
      dispatchSandboxReady(iframe);
      await flushMicrotasks();
      const timedOutId = (spy.mock.calls[0]?.[0] as { requestId: string }).requestId;

      vi.advanceTimersByTime(10_001);
      await p1.catch(() => {});

      // タイムアウト後に同 requestId の result を送っても何も起きない（エラーにならない）
      expect(() => dispatchRenderResult(timedOutId, '<svg/>')).not.toThrow();
    });
  });
});
