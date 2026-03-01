/**
 * split-view.ts
 *
 * Phase 5: スプリットビューの設定型定義。
 *
 * 実際のスプリットビューは React コンポーネント
 * (src/components/editor/HtmlSplitView.tsx) として実装されている。
 * このモジュールは型定義のみ提供する。
 */

export interface SplitViewState {
  /** 分割比率（左ペイン幅の割合 0〜1） */
  splitRatio: number;
  /** 同期スクロールを有効にするか */
  syncScroll: boolean;
}

export const defaultSplitViewState: SplitViewState = {
  splitRatio: 0.5,
  syncScroll: true,
};
