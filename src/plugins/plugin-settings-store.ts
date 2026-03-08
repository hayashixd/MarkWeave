/**
 * プラグイン設定ストア
 *
 * plugin-api-design.md §9.4 に準拠。
 * プラグイン設定は settings.json の plugins.settings セクションに保存する。
 */

import { create } from 'zustand';

interface PluginSettingsStore {
  /** pluginId → 設定値マップ */
  settings: Record<string, Record<string, unknown>>;

  /** ストアの初期化（plugin-store から読み込み）*/
  load: () => Promise<void>;

  /** プラグイン設定値を取得 */
  getPluginSettings: (pluginId: string) => Record<string, unknown>;

  /** プラグイン設定値を変更して永続化 */
  setPluginSetting: (pluginId: string, key: string, value: unknown) => Promise<void>;
}

async function getStore() {
  const { load } = await import('@tauri-apps/plugin-store');
  return load('settings.json');
}

export const usePluginSettingsStore = create<PluginSettingsStore>((set, get) => ({
  settings: {},

  load: async () => {
    try {
      const store = await getStore();
      const saved = await store.get<Record<string, Record<string, unknown>>>('plugins.settings');
      if (saved) {
        set({ settings: saved });
      }
    } catch {
      // Tauri 外（テスト・ブラウザ）ではスキップ
    }
  },

  getPluginSettings: (pluginId) => get().settings[pluginId] ?? {},

  setPluginSetting: async (pluginId, key, value) => {
    const next = {
      ...get().settings,
      [pluginId]: { ...get().settings[pluginId], [key]: value },
    };
    set({ settings: next });
    try {
      const store = await getStore();
      await store.set('plugins.settings', next);
      await store.save();
    } catch {
      // Tauri 外ではスキップ
    }
  },
}));
