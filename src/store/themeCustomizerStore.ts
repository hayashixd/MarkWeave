/**
 * テーマカスタマイザーストア (Zustand)
 *
 * theme-design.md §5.8 に準拠。
 * カスタムテーマの CSS 変数オーバーライドを管理し、
 * 即時 DOM 反映 + @tauri-apps/plugin-store に永続化する。
 */

import { create } from 'zustand';
import { applyOverrideVars } from '../themes/override-layer';

/** plugin-store の load 関数（Tauri 環境でのみ利用可能） */
async function getStore() {
  const { load } = await import('@tauri-apps/plugin-store');
  return load('settings.json');
}

interface ThemeCustomizerStore {
  /** 現在のオーバーライド変数マップ */
  overrideVars: Record<string, string>;
  /** カスタムテーマの表示名 */
  customThemeName: string;
  /** 変数を更新（即時 DOM 反映） */
  setVar: (cssVar: string, value: string) => void;
  /** 変数を削除（ベーステーマの値に戻す） */
  removeVar: (cssVar: string) => void;
  /** 全変数をリセット */
  resetAll: () => void;
  /** settings.json に保存 */
  saveCustomTheme: () => Promise<void>;
  /** settings.json から読み込み（起動時） */
  loadCustomTheme: () => Promise<void>;
}

export const useThemeCustomizerStore = create<ThemeCustomizerStore>((set, get) => ({
  overrideVars: {},
  customThemeName: 'My Theme',

  setVar: (cssVar, value) => {
    const next = { ...get().overrideVars, [cssVar]: value };
    set({ overrideVars: next });
    applyOverrideVars(next);
  },

  removeVar: (cssVar) => {
    const next = { ...get().overrideVars };
    delete next[cssVar];
    set({ overrideVars: next });
    applyOverrideVars(next);
  },

  resetAll: () => {
    set({ overrideVars: {} });
    applyOverrideVars({});
  },

  saveCustomTheme: async () => {
    try {
      const store = await getStore();
      await store.set('customTheme', {
        name: get().customThemeName,
        variables: get().overrideVars,
      });
      await store.save();
    } catch {
      // Tauri 外では永続化をスキップ
    }
  },

  loadCustomTheme: async () => {
    try {
      const store = await getStore();
      const saved = await store.get<{ name: string; variables: Record<string, string> }>('customTheme');
      if (saved?.variables) {
        set({ overrideVars: saved.variables, customThemeName: saved.name ?? 'My Theme' });
        applyOverrideVars(saved.variables);
      }
    } catch {
      // Tauri 外ではスキップ
    }
  },
}));
