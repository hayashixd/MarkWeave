/**
 * タブ単位のプラットフォームプロファイルオーバーライドストア
 *
 * Front Matter の自動検出（detectPlatform）を上書きして、
 * ユーザーが明示的に Generic / Zenn / Qiita を指定できるようにする。
 *
 * - 永続化なし（タブを閉じたらリセット）
 * - tabStore.removeTab と連動したクリーンアップは AppShell で行う
 */

import { create } from 'zustand';
import type { Platform } from '../lib/platform-detector';

interface TabProfileState {
  /** tabId → Platform のオーバーライドマップ */
  overrides: Record<string, Platform>;
  /** オーバーライドを設定する */
  setOverride: (tabId: string, platform: Platform) => void;
  /** オーバーライドを解除する（自動検出に戻す） */
  clearOverride: (tabId: string) => void;
}

export const useTabProfileStore = create<TabProfileState>((set) => ({
  overrides: {},

  setOverride: (tabId, platform) => {
    set((state) => ({
      overrides: { ...state.overrides, [tabId]: platform },
    }));
  },

  clearOverride: (tabId) => {
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [tabId]: _removed, ...rest } = state.overrides;
      return { overrides: rest };
    });
  },
}));
