/**
 * ユーザー設定ストア (Zustand)
 *
 * user-settings-design.md に準拠。
 */

import { create } from 'zustand';

export type EditorMode = 'typora' | 'wysiwyg' | 'source' | 'split';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  editorMode: EditorMode;
  theme: ThemeMode;
  fontSize: number;
  autoSave: boolean;
  autoSaveIntervalMs: number;
  locale: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  editorMode: 'typora',
  theme: 'system',
  fontSize: 16,
  autoSave: true,
  autoSaveIntervalMs: 1000,
  locale: 'ja',
};

interface SettingsStore {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: { ...DEFAULT_SETTINGS },

  updateSettings: (partial) => {
    set((state) => ({
      settings: { ...state.settings, ...partial },
    }));
  },

  resetSettings: () => {
    set({ settings: { ...DEFAULT_SETTINGS } });
  },
}));
