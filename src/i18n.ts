/**
 * i18n 初期化/翻訳ユーティリティ
 *
 * i18n-design.md §4 に準拠。
 * 日本語・英語の両リソースをロードし、設定に応じて切り替える。
 * useTranslation フックは settingsStore の language 設定を購読するため、
 * 設定変更時に自動的に再レンダリングされる。
 */
import { useCallback } from 'react';
import { useSettingsStore } from './store/settingsStore';

import jaCommon from './locales/ja/common.json';
import jaSettings from './locales/ja/settings.json';
import jaEditor from './locales/ja/editor.json';
import jaMenu from './locales/ja/menu.json';
import jaErrors from './locales/ja/errors.json';

import enCommon from './locales/en/common.json';
import enSettings from './locales/en/settings.json';
import enEditor from './locales/en/editor.json';
import enMenu from './locales/en/menu.json';
import enErrors from './locales/en/errors.json';

type Namespace = 'common' | 'settings' | 'editor' | 'menu' | 'errors';
type SupportedLang = 'ja' | 'en';

interface TranslationNode {
  [key: string]: string | string[] | TranslationNode;
}

type TranslationTree = TranslationNode;

const resources: Record<SupportedLang, Record<Namespace, TranslationTree>> = {
  ja: {
    common: jaCommon as TranslationTree,
    settings: jaSettings as TranslationTree,
    editor: jaEditor as TranslationTree,
    menu: jaMenu as TranslationTree,
    errors: jaErrors as TranslationTree,
  },
  en: {
    common: enCommon as TranslationTree,
    settings: enSettings as TranslationTree,
    editor: enEditor as TranslationTree,
    menu: enMenu as TranslationTree,
    errors: enErrors as TranslationTree,
  },
};

const DEFAULT_NAMESPACE: Namespace = 'common';

/** グローバル言語（React 外から t() を呼ぶ場合に使用） */
let globalLang: SupportedLang = 'ja';

/** React 外（Rust IPC ハンドラ等）でグローバル言語を設定する */
export function setGlobalLanguage(lang: SupportedLang): void {
  globalLang = lang;
}

function resolveValue(tree: TranslationTree, keyPath: string): string | string[] | undefined {
  const segments = keyPath.split('.');
  let current: string | string[] | TranslationTree = tree;

  for (const segment of segments) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return undefined;
    }

    const next: string | string[] | TranslationTree | undefined = current[segment];
    if (next === undefined) {
      return undefined;
    }
    current = next;
  }

  if (typeof current === 'string' || Array.isArray(current)) {
    return current;
  }

  return undefined;
}

function parseKey(rawKey: string, namespace?: Namespace): { ns: Namespace; key: string } {
  const [nsCandidate, keyCandidate] = rawKey.includes(':')
    ? (rawKey.split(':', 2) as [string, string])
    : [namespace ?? DEFAULT_NAMESPACE, rawKey];

  const ns = (nsCandidate in resources.ja ? nsCandidate : DEFAULT_NAMESPACE) as Namespace;
  return { ns, key: keyCandidate };
}

function interpolate(text: string, values?: Record<string, unknown>): string {
  if (!values) return text;
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, token: string) => {
    const replacement = values[token];
    return replacement === undefined || replacement === null ? '' : String(replacement);
  });
}

export function tWithLang(
  lang: SupportedLang,
  rawKey: string,
  options?: { returnObjects?: boolean } & Record<string, unknown>,
): string | string[] {
  const { ns, key } = parseKey(rawKey);
  // 指定言語で解決し、見つからなければ ja にフォールバック
  const found =
    resolveValue(resources[lang][ns], key) ?? resolveValue(resources['ja'][ns], key);

  if (Array.isArray(found)) {
    return options?.returnObjects ? found : found.join(', ');
  }

  if (typeof found === 'string') {
    return interpolate(found, options);
  }

  return rawKey;
}

function t(
  rawKey: string,
  options?: { returnObjects?: false } & Record<string, unknown>,
): string;
function t(rawKey: string, options: { returnObjects: true } & Record<string, unknown>): string[];
function t(
  rawKey: string,
  options?: { returnObjects?: boolean } & Record<string, unknown>,
): string | string[] {
  return tWithLang(globalLang, rawKey, options);
}

export function useTranslation(namespaces?: Namespace | Namespace[]) {
  const namespace = Array.isArray(namespaces)
    ? namespaces[0] ?? DEFAULT_NAMESPACE
    : namespaces ?? DEFAULT_NAMESPACE;

  // settingsStore を購読して language 変更時に再レンダリングを起こす
  const language = useSettingsStore((s) => s.settings.appearance.language);
  const lang: SupportedLang = language === 'en' ? 'en' : 'ja';

  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      tWithLang(lang, key.includes(':') ? key : `${namespace}:${key}`, options) as string,
    [namespace, lang],
  );

  return { t: translate };
}

const i18next = {
  t,
};

export default i18next;
