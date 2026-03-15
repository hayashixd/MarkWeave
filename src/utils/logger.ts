/**
 * フロントエンド用ログユーティリティ。
 *
 * error-handling-design.md §3.3 に準拠。
 *
 * - Tauri 環境: @tauri-apps/plugin-log でファイルに記録
 * - ブラウザ/テスト環境: console に出力（フォールバック）
 * - 開発環境: console にも出力
 */

type LogFn = (message: string) => Promise<void>;

let pluginDebug: LogFn | null = null;
let pluginInfo: LogFn | null = null;
let pluginWarn: LogFn | null = null;
let pluginError: LogFn | null = null;
let pluginChecked = false;

// Tauri 環境では plugin-log を動的 import
async function ensurePlugin(): Promise<boolean> {
  if (pluginInfo) return true;
  if (pluginChecked) return false;
  pluginChecked = true;
  try {
    // Tauri 環境でなければ window.__TAURI_INTERNALS__ が存在しない
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      return false;
    }
    const mod = await import('@tauri-apps/plugin-log');
    pluginDebug = mod.debug;
    pluginInfo = mod.info;
    pluginWarn = mod.warn;
    pluginError = mod.error;
    return true;
  } catch {
    return false;
  }
}

function formatArgs(args: unknown[]): string {
  if (args.length === 0) return '';
  try {
    return ' ' + args.map((a) => JSON.stringify(a)).join(' ');
  } catch {
    return ' [unstringifiable]';
  }
}

/** plugin-log への書き込みを試み、失敗は黙って無視する */
function safePluginCall(fn: LogFn | null, message: string): void {
  if (!fn) return;
  fn(message).catch(() => {
    // Tauri 外では呼び出し失敗するが無視
  });
}

export const logger = {
  debug: (msg: string, ...args: unknown[]) => {
    const full = msg + formatArgs(args);
    ensurePlugin().then((ok) => {
      if (ok) safePluginCall(pluginDebug, full);
    });
    if (import.meta.env.DEV) console.debug(msg, ...args);
  },

  info: (msg: string, ...args: unknown[]) => {
    const full = msg + formatArgs(args);
    ensurePlugin().then((ok) => {
      if (ok) safePluginCall(pluginInfo, full);
    });
    if (import.meta.env.DEV) console.info(msg, ...args);
  },

  warn: (msg: string, ...args: unknown[]) => {
    const full = msg + formatArgs(args);
    ensurePlugin().then((ok) => {
      if (ok) safePluginCall(pluginWarn, full);
    });
    if (import.meta.env.DEV) console.warn(msg, ...args);
  },

  error: (msg: string, err?: unknown) => {
    const errorStr =
      err instanceof Error ? err.stack ?? err.message : err !== undefined ? String(err) : '';
    const full = errorStr ? `${msg}\n${errorStr}` : msg;
    ensurePlugin().then((ok) => {
      if (ok) safePluginCall(pluginError, full);
    });
    if (import.meta.env.DEV) console.error(msg, err);
  },
};
