/**
 * split-view.ts
 *
 * HTML編集のスプリットモード（ソースコード / プレビュー 並列表示）を管理するモジュール。
 */

export interface SplitViewState {
  /** 分割比率（左ペイン幅の割合 0〜1） */
  splitRatio: number;
  /** 同期スクロールを有効にするか */
  syncScroll: boolean;
}

const defaultState: SplitViewState = {
  splitRatio: 0.5,
  syncScroll: true,
};

/**
 * スプリットビューを初期化する。
 *
 * @param container  - スプリットビューを配置するコンテナ要素
 * @param state      - 初期状態
 * @returns スプリットビューのクリーンアップ関数
 *
 * @example
 * const cleanup = initSplitView(document.getElementById('split-container'));
 * // ...
 * cleanup(); // コンポーネントアンマウント時に呼ぶ
 */
export function initSplitView(
  container: HTMLElement,
  state: Partial<SplitViewState> = {}
): () => void {
  const _state = { ...defaultState, ...state };
  // TODO:
  // 1. 左ペイン（CodeMirror HTMLソース）を初期化
  // 2. 右ペイン（プレビュー iframe or div）を初期化
  // 3. ドラッグリサイズハンドルを設置
  // 4. 同期スクロールのイベントリスナーを設定
  void container;
  return () => {
    // TODO: クリーンアップ（イベントリスナー解除等）
  };
}

/**
 * ソースコードが変更されたときにプレビューを更新する。
 *
 * @param previewContainer - プレビューを表示するDOM要素
 * @param html             - 最新のHTML文字列
 */
export function updatePreview(
  previewContainer: HTMLElement,
  html: string
): void {
  // TODO: sanitize(html) してプレビューに反映
  // セキュリティ: DOMPurify 等で XSS を防ぐ
  void previewContainer;
  void html;
  throw new Error('updatePreview: not implemented yet');
}
