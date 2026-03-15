/**
 * ユーザー設定ストア (Zustand + @tauri-apps/plugin-store)
 *
 * user-settings-design.md §4.2 に準拠。
 *
 * - loadSettings(): plugin-store から読み込み、マイグレーション済み設定を反映
 * - updateSettings(): DeepPartial で部分更新 → 即時反映 → plugin-store に永続化
 * - resetSettings(): デフォルト値にリセット → 永続化
 */

import { create } from 'zustand';
import type { AppSettings, DeepPartial } from '../settings/types';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import { migrateSettings } from '../settings/migrate';
import { deepMerge } from '../settings/deepMerge';

/** plugin-store の load 関数（Tauri 環境でのみ利用可能） */
async function getStore() {
  const { load } = await import('@tauri-apps/plugin-store');
  return load('settings.json');
}

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;

  /** plugin-store から設定を読み込む */
  loadSettings: () => Promise<void>;

  /** 設定を部分更新して永続化する */
  updateSettings: (partial: DeepPartial<AppSettings>) => Promise<void>;

  /** 設定をデフォルトにリセットして永続化する */
  resetSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  loadSettings: async () => {
    try {
      const store = await getStore();
      const raw = await store.get<AppSettings>('settings');
      const settings = raw ? migrateSettings(raw) : DEFAULT_SETTINGS;
      set({ settings, loaded: true });
    } catch {
      // Tauri 外（テスト・ブラウザ開発）ではデフォルト値で起動
      set({ settings: DEFAULT_SETTINGS, loaded: true });
    }
  },

  updateSettings: async (partial) => {
    const next = deepMerge(
      get().settings as unknown as Record<string, unknown>,
      partial as unknown as Record<string, unknown>,
    ) as unknown as AppSettings;
    set({ settings: next });

    try {
      const store = await getStore();
      await store.set('settings', next);
      await store.save();
    } catch {
      // Tauri 外では永続化をスキップ
    }
  },

  resetSettings: async () => {
    set({ settings: DEFAULT_SETTINGS });

    try {
      const store = await getStore();
      await store.set('settings', DEFAULT_SETTINGS);
      await store.save();
    } catch {
      // Tauri 外では永続化をスキップ
    }
  },
}));
