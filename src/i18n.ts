/**
 * i18n 初期化/翻訳ユーティリティ
 *
 * i18n-design.md §4 に準拠。
 * Phase 1: 日本語のみ。英語辞書は空枠として配置。
 */
import { useCallback } from 'react';

import jaCommon from './locales/ja/common.json';
import jaSettings from './locales/ja/settings.json';
import jaEditor from './locales/ja/editor.json';
import jaMenu from './locales/ja/menu.json';
import jaErrors from './locales/ja/errors.json';

type Namespace = 'common' | 'settings' | 'editor' | 'menu' | 'errors';

interface TranslationNode {
  [key: string]: string | string[] | TranslationNode;
}

type TranslationTree = TranslationNode;

const resources: Record<Namespace, TranslationTree> = {
  common: jaCommon as TranslationTree,
  settings: jaSettings as TranslationTree,
  editor: jaEditor as TranslationTree,
  menu: jaMenu as TranslationTree,
  errors: jaErrors as TranslationTree,
};

const DEFAULT_NAMESPACE: Namespace = 'common';

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

  const ns = (nsCandidate in resources ? nsCandidate : DEFAULT_NAMESPACE) as Namespace;
  return { ns, key: keyCandidate };
}

function interpolate(text: string, values?: Record<string, unknown>): string {
  if (!values) return text;
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, token: string) => {
    const replacement = values[token];
    return replacement === undefined || replacement === null ? '' : String(replacement);
  });
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
  const { ns, key } = parseKey(rawKey);
  const found = resolveValue(resources[ns], key);

  if (Array.isArray(found)) {
    return options?.returnObjects ? found : found.join(', ');
  }

  if (typeof found === 'string') {
    return interpolate(found, options);
  }

  return rawKey;
}

export function useTranslation(namespaces?: Namespace | Namespace[]) {
  const namespace = Array.isArray(namespaces)
    ? namespaces[0] ?? DEFAULT_NAMESPACE
    : namespaces ?? DEFAULT_NAMESPACE;

  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      t(key.includes(':') ? key : `${namespace}:${key}`, options) as string,
    [namespace],
  );

  return { t: translate };
}

const i18next = {
  t,
};

export default i18next;
