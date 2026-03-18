/**
 * AI 設定タブ（設定ダイアログ内）
 *
 * BYOK（Bring Your Own Key）方式。
 * - プロバイダ切替（Anthropic / OpenAI）
 * - API キー入力・保存・削除
 * - 接続テストボタン
 * - 環境変数から読んでいる場合はソースを表示
 */

import { useState, useEffect } from 'react';
import {
  getAiProviderConfig,
  setAiApiKey,
  testAiApiKey,
  type AiProviderConfig,
} from '../../../lib/tauri-commands';
import { useTranslation } from '../../../i18n';

const PROVIDER_ENV_VARS: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
};

const PROVIDER_KEY_LINKS: Record<string, string> = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
};

export function AiTab() {
  const { t } = useTranslation('settings');

  const [configs, setConfigs] = useState<AiProviderConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('anthropic');
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    getAiProviderConfig().then(setConfigs);
  }, []);

  const currentConfig = configs.find((c) => c.provider === selectedProvider);

  function clearMessage() {
    setMessage(null);
  }

  async function handleSave() {
    if (!keyInput.trim()) return;
    clearMessage();
    setSaving(true);
    try {
      await setAiApiKey(selectedProvider, keyInput.trim());
      setKeyInput('');
      setShowKey(false);
      setMessage({ type: 'ok', text: t('ai.saveOk') });
      // 設定状態を再取得
      const updated = await getAiProviderConfig();
      setConfigs(updated);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!keyInput.trim()) return;
    clearMessage();
    setTesting(true);
    try {
      await testAiApiKey(selectedProvider, keyInput.trim());
      setMessage({ type: 'ok', text: t('ai.testOk') });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  }

  async function handleClear() {
    if (!confirm(t('ai.clearConfirm'))) return;
    clearMessage();
    setSaving(true);
    try {
      await setAiApiKey(selectedProvider, '');
      setMessage({ type: 'ok', text: t('ai.saveOk') });
      const updated = await getAiProviderConfig();
      setConfigs(updated);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">{t('ai.title')}</h2>
        <p className="mt-1 text-xs text-gray-500">{t('ai.description')}</p>
      </div>

      {/* プロバイダ選択 */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t('ai.provider')}
        </label>
        <div className="flex gap-2">
          {configs.map((c) => (
            <button
              key={c.provider}
              type="button"
              onClick={() => {
                setSelectedProvider(c.provider);
                setKeyInput('');
                setShowKey(false);
                clearMessage();
              }}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                selectedProvider === c.provider
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {c.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}
            </button>
          ))}
        </div>
      </div>

      {/* 設定状態バッジ */}
      {currentConfig && (
        <div
          className={`rounded-md px-3 py-2 text-xs ${
            currentConfig.has_key
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-gray-50 border border-gray-200 text-gray-600'
          }`}
        >
          {currentConfig.key_source === 'store' && t('ai.statusStore')}
          {currentConfig.key_source === 'env' &&
            t('ai.statusEnv')}
          {currentConfig.key_source === 'none' && t('ai.statusNone')}
        </div>
      )}

      {/* 環境変数から読み込んでいる場合の説明 */}
      {currentConfig?.key_source === 'env' && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          {t('ai.envReadOnly', { var: PROVIDER_ENV_VARS[selectedProvider] ?? '' })}
        </p>
      )}

      {/* API キー入力 */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t('ai.apiKey')}
        </label>
        <div className="flex gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={keyInput}
            onChange={(e) => {
              setKeyInput(e.target.value);
              clearMessage();
            }}
            placeholder={t('ai.apiKeyPlaceholder')}
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs font-mono focus:border-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="px-2 py-1.5 rounded border border-gray-300 text-xs text-gray-500 hover:bg-gray-50"
            aria-label={showKey ? '非表示' : '表示'}
          >
            {showKey ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleTest}
          disabled={testing || saving || !keyInput.trim()}
          className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {testing ? t('ai.testing') : t('ai.test')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || testing || !keyInput.trim()}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? t('ai.saving') : t('ai.save')}
        </button>
        {currentConfig?.key_source === 'store' && (
          <button
            type="button"
            onClick={handleClear}
            disabled={saving || testing}
            className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {t('ai.clearKey')}
          </button>
        )}
      </div>

      {/* 結果メッセージ */}
      {message && (
        <p
          className={`text-xs rounded px-3 py-2 ${
            message.type === 'ok'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </p>
      )}

      {/* キー取得リンク */}
      <p className="text-xs text-gray-400">
        <a
          href={PROVIDER_KEY_LINKS[selectedProvider]}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-gray-600"
        >
          {selectedProvider === 'anthropic'
            ? t('ai.getKeyAnthropic')
            : t('ai.getKeyOpenAI')}
        </a>
      </p>
    </div>
  );
}
