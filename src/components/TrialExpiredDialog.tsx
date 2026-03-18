/**
 * 試用期間終了ダイアログ
 *
 * 30日間の無料試用期間が終了した場合に起動時に表示される。
 * バックドロップクリック・Escape キーでは閉じられない（ライセンス認証または終了のみ）。
 */

import { useState, useEffect, useCallback } from 'react';
import { activateLicense, type LicenseStatus } from '../lib/tauri-commands';
import { STORE_URL } from '../constants/urls';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTranslation } from '../i18n';

interface TrialExpiredDialogProps {
  onActivated: (status: LicenseStatus) => void;
}

export function TrialExpiredDialog({ onActivated }: TrialExpiredDialogProps) {
  const { t } = useTranslation('settings');
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape キーを無効化（ブロッキングダイアログ）
  const blockEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', blockEscape, true);
    return () => window.removeEventListener('keydown', blockEscape, true);
  }, [blockEscape]);

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await activateLicense(key.trim());
      onActivated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleQuit() {
    await getCurrentWindow().close();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-lg shadow-2xl w-[480px] max-w-[90vw] p-6 space-y-5">
        {/* ヘッダー */}
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-gray-900">
            {t('trial.expiredTitle')}
          </h2>
          <p className="text-sm text-gray-500">
            {t('trial.expiredDescription')}
          </p>
        </div>

        {/* ライセンス入力フォーム */}
        <form onSubmit={handleActivate} className="space-y-3">
          <label className="block text-xs text-gray-700">
            {t('license.keyLabel')}
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
              required
              autoFocus
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
            className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('license.activating') : t('license.activate')}
          </button>
        </form>

        {/* 購入リンク */}
        <p className="text-xs text-gray-400">
          {t('license.buyLink')}{' '}
          <a
            href={STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-gray-600"
          >
            Gumroad
          </a>
        </p>

        {/* 終了ボタン */}
        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={handleQuit}
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
          >
            {t('trial.quit')}
          </button>
        </div>
      </div>
    </div>
  );
}
