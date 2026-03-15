/**
 * プラグイン管理パネル（設定ダイアログ内のプラグインタブ）
 *
 * plugin-api-design.md §9.3 に準拠。
 * - インストール済みプラグイン一覧（有効/無効/エラー状態）
 * - プラグインの有効化・無効化・アンインストール
 * - プラグイン設定フォーム（右ペイン）
 * - ローカルフォルダからのプラグインインストール
 */

import { useState, useCallback } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import type { InstalledPlugin, PluginManifest } from '../../plugins/plugin-api';
import { PluginSettingsForm } from './PluginSettingsForm';
import { PermissionDialog } from './PermissionDialog';
import { pluginManager } from '../../plugins/plugin-manager';
import { usePluginSettingsStore } from '../../plugins/plugin-settings-store';

const STATUS_ICONS: Record<string, string> = {
  active:      '✅',
  inactive:    '⏸',
  error:       '🔴',
  'safe-mode': '🔒',
};

const STATUS_LABELS: Record<string, string> = {
  active:      '有効',
  inactive:    '無効',
  error:       'エラー',
  'safe-mode': 'セーフモード',
};

export function PluginManagerPanel() {
  const [plugins, setPlugins] = useState<InstalledPlugin[]>(
    () => pluginManager.getInstalled(),
  );
  const [selected, setSelected] = useState<InstalledPlugin | null>(null);
  const [pendingManifest, setPendingManifest] = useState<PluginManifest | null>(null);
  const [pendingPath, setPendingPath] = useState<string>('');
  const [installing, setInstalling] = useState(false);

  const settingsStore = usePluginSettingsStore();

  const refreshPlugins = useCallback(() => {
    setPlugins(pluginManager.getInstalled());
  }, []);

  // ------------------------------------------------------------------
  // プラグインインストール（ローカルフォルダ選択）
  // ------------------------------------------------------------------

  const handleInstall = useCallback(async () => {
    try {
      const folderPath = await openDialog({ directory: true, multiple: false });
      if (!folderPath || typeof folderPath !== 'string') return;

      setInstalling(true);
      // Rust バックエンドでマニフェストを読み込む
      const manifest = await invoke<PluginManifest>('plugin_load_manifest', {
        folderPath,
      });

      setPendingManifest(manifest);
      setPendingPath(folderPath);
    } catch (err) {
      alert(`プラグインの読み込みに失敗しました: ${err}`);
    } finally {
      setInstalling(false);
    }
  }, []);

  const handleApprove = useCallback(async () => {
    if (!pendingManifest || !pendingPath) return;
    try {
      await invoke('plugin_install', {
        folderPath: pendingPath,
        manifest: pendingManifest,
      });
      setPendingManifest(null);
      setPendingPath('');
      refreshPlugins();
    } catch (err) {
      alert(`インストールに失敗しました: ${err}`);
    }
  }, [pendingManifest, pendingPath, refreshPlugins]);

  const handleDeny = useCallback(() => {
    setPendingManifest(null);
    setPendingPath('');
  }, []);

  // ------------------------------------------------------------------
  // 有効化・無効化・アンインストール
  // ------------------------------------------------------------------

  const handleToggle = useCallback(
    async (plugin: InstalledPlugin) => {
      try {
        if (plugin.status === 'active') {
          await pluginManager.deactivatePlugin(plugin.manifest.id);
        } else {
          // 動的インポートで Plugin モジュールを読み込んで activate
          // Phase 7 ではローカルパスからの動的ロードを想定
          await invoke('plugin_set_enabled', {
            pluginId: plugin.manifest.id,
            enabled: !plugin.enabled,
          });
        }
        refreshPlugins();
      } catch (err) {
        alert(`操作に失敗しました: ${err}`);
      }
    },
    [refreshPlugins],
  );

  const handleUninstall = useCallback(
    async (plugin: InstalledPlugin) => {
      if (!confirm(`「${plugin.manifest.name}」をアンインストールしますか？`)) return;
      try {
        await pluginManager.deactivatePlugin(plugin.manifest.id);
        await invoke('plugin_uninstall', { pluginId: plugin.manifest.id });
        refreshPlugins();
        if (selected?.manifest.id === plugin.manifest.id) setSelected(null);
      } catch (err) {
        alert(`アンインストールに失敗しました: ${err}`);
      }
    },
    [selected, refreshPlugins],
  );

  // ------------------------------------------------------------------
  // 設定値変更
  // ------------------------------------------------------------------

  const handleSettingChange = useCallback(
    (key: string, value: unknown) => {
      if (!selected) return;
      settingsStore.setPluginSetting(selected.manifest.id, key, value);
    },
    [selected, settingsStore],
  );

  // ------------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------------

  return (
    <div className="flex h-full min-h-[320px]">
      {/* 権限確認ダイアログ */}
      {pendingManifest && (
        <PermissionDialog
          manifest={pendingManifest}
          onApprove={handleApprove}
          onDeny={handleDeny}
        />
      )}

      {/* 左ペイン: インストール済み一覧 */}
      <div className="w-48 flex-shrink-0 border-r border-gray-200 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {plugins.length === 0 ? (
            <p className="p-3 text-xs text-gray-400">インストール済みのプラグインはありません。</p>
          ) : (
            plugins.map((plugin) => (
              <button
                key={plugin.manifest.id}
                type="button"
                onClick={() => setSelected(plugin)}
                className={`w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-gray-50 ${
                  selected?.manifest.id === plugin.manifest.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm leading-none">{STATUS_ICONS[plugin.status] ?? '•'}</span>
                  <span className="text-sm font-medium text-gray-800 truncate flex-1">
                    {plugin.manifest.name}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5 ml-5">v{plugin.manifest.version}</div>
              </button>
            ))
          )}
        </div>

        {/* + プラグインを追加 */}
        <div className="p-2 border-t border-gray-200">
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing}
            className="w-full text-left text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400 py-1"
          >
            {installing ? '読み込み中...' : '+ プラグインを追加'}
          </button>
        </div>
      </div>

      {/* 右ペイン: 選択中プラグインの詳細・設定 */}
      <div className="flex-1 overflow-y-auto p-4">
        {selected ? (
          <PluginDetail
            plugin={selected}
            settingsValues={settingsStore.getPluginSettings(selected.manifest.id)}
            onSettingChange={handleSettingChange}
            onToggle={() => handleToggle(selected)}
            onUninstall={() => handleUninstall(selected)}
          />
        ) : (
          <p className="text-sm text-gray-400">左のリストからプラグインを選択してください。</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// プラグイン詳細ビュー
// ---------------------------------------------------------------------------

interface PluginDetailProps {
  plugin: InstalledPlugin;
  settingsValues: Record<string, unknown>;
  onSettingChange: (key: string, value: unknown) => void;
  onToggle: () => void;
  onUninstall: () => void;
}

function PluginDetail({
  plugin,
  settingsValues,
  onSettingChange,
  onToggle,
  onUninstall,
}: PluginDetailProps) {
  const isActive = plugin.status === 'active';
  const isSafeMode = plugin.status === 'safe-mode';

  return (
    <div>
      {/* プラグイン情報 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-base font-semibold text-gray-900">{plugin.manifest.name}</h3>
          <span className="text-xs text-gray-400">
            {STATUS_ICONS[plugin.status]} {STATUS_LABELS[plugin.status]}
          </span>
        </div>
        <p className="text-xs text-gray-400">
          v{plugin.manifest.version} · {plugin.manifest.id}
        </p>
        {plugin.manifest.author && (
          <p className="text-xs text-gray-500 mt-0.5">作者: {plugin.manifest.author}</p>
        )}
        {plugin.manifest.description && (
          <p className="text-sm text-gray-600 mt-2">{plugin.manifest.description}</p>
        )}
        {plugin.errorMessage && (
          <div className="mt-2 px-2 py-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            エラー: {plugin.errorMessage}
          </div>
        )}
        {isSafeMode && (
          <div className="mt-2 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500">
            🔒 セーフモードのため自動無効化されています。通常モードで再起動すると有効になります。
          </div>
        )}
      </div>

      {/* 設定フォーム */}
      {plugin.manifest.settings && plugin.manifest.settings.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">設定</h4>
          <PluginSettingsForm
            pluginId={plugin.manifest.id}
            declarations={plugin.manifest.settings}
            values={settingsValues}
            onChange={onSettingChange}
          />
        </div>
      )}

      {/* 操作ボタン */}
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        {!isSafeMode && (
          <button
            type="button"
            onClick={onToggle}
            className={`px-3 py-1.5 text-sm rounded border ${
              isActive
                ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                : 'border-blue-300 text-blue-700 hover:bg-blue-50'
            }`}
          >
            {isActive ? '無効にする' : '有効にする'}
          </button>
        )}
        <button
          type="button"
          onClick={onUninstall}
          className="px-3 py-1.5 text-sm rounded border border-red-300 text-red-600 hover:bg-red-50"
        >
          アンインストール
        </button>
      </div>
    </div>
  );
}
