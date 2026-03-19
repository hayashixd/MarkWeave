/**
 * タブごとのプラットフォーム検出結果キャッシュ
 *
 * TipTapEditor が effectivePlatform を算出するたびに更新する。
 * TabBar はこのストアを購読してバッジを表示する。
 * content を含む tabStore を TabBar が直接購読するとキーストロークごとに
 * 再レンダリングが発生するため、このキャッシュストアを中間層として使う。
 */

import { create } from 'zustand';
import type { Platform } from '../lib/platform-detector';

interface TabPlatformCacheState {
  /** tabId → Platform のキャッシュ */
  platforms: Record<string, Platform>;
  /** キャッシュを更新する */
  setPlatform: (tabId: string, platform: Platform) => void;
  /** タブクローズ時にキャッシュを削除する */
  clearPlatform: (tabId: string) => void;
}

export const useTabPlatformCacheStore = create<TabPlatformCacheState>((set) => ({
  platforms: {},

  setPlatform: (tabId, platform) => {
    set((state) => {
      if (state.platforms[tabId] === platform) return state; // 変化なし → 更新不要
      return { platforms: { ...state.platforms, [tabId]: platform } };
    });
  },

  clearPlatform: (tabId) => {
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [tabId]: _removed, ...rest } = state.platforms;
      return { platforms: rest };
    });
  },
}));
