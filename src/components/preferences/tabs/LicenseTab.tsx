/**
 * ライセンスタブ（設定ダイアログ内）
 *
 * - 未認証: Gumroad ライセンスキーの入力フォームを表示
 * - 認証済み: ライセンス情報（メール・認証日）と削除ボタンを表示
 */

import { useState, useEffect } from 'react';
import {
  getLicenseStatus,
  activateLicense,
  removeLicense,
  type LicenseStatus,
} from '../../../lib/tauri-commands';
import { useTranslation } from '../../../i18n';

export function LicenseTab() {
  const { t } = useTranslation('settings');
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLicenseStatus().then(setStatus);
  }, []);

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await activateLicense(key.trim());
      setStatus(result);
      setKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    if (!confirm(t('license.removeConfirm'))) return;
    setLoading(true);
    try {
      await removeLicense();
      setStatus({ activated: false, email: null, activatedAt: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function formatDate(epochSecs: number): string {
    return new Date(epochSecs * 1000).toLocaleDateString();
  }

  if (status === null) {
    return <div className="text-sm text-gray-500">{t('common:loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-800">{t('license.title')}</h2>

      {status.activated ? (
        // 認証済み表示
        <div className="space-y-3">
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3">
            <p className="text-sm font-medium text-green-800">{t('license.activated')}</p>
            {status.email && (
              <p className="text-xs text-green-700 mt-1">{status.email}</p>
            )}
            {status.activatedAt && (
              <p className="text-xs text-green-600 mt-0.5">
                {t('license.activatedAt')}: {formatDate(status.activatedAt)}
              </p>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleRemove}
            disabled={loading}
            className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-50"
          >
            {t('license.remove')}
          </button>
        </div>
      ) : (
        // 未認証: 入力フォーム
        <form onSubmit={handleActivate} className="space-y-3">
          <p className="text-xs text-gray-500">{t('license.description')}</p>

          <label className="block text-xs text-gray-700">
            {t('license.keyLabel')}
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
              required
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm font-mono tracking-wider focus:border-blue-500 focus:outline-none"
            />
          </label>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !key.trim()}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('license.activating') : t('license.activate')}
          </button>

          <p className="text-xs text-gray-400">
            {t('license.buyLink')}{' '}
            <a
              href="https://xdhyskh.gumroad.com/l/qwctrq"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-gray-600"
            >
              Gumroad
            </a>
          </p>
        </form>
      )}
    </div>
  );
}
