/**
 * アクセシビリティ: スクリーンリーダー向けアナウンス
 *
 * accessibility-design.md §6.2 に準拠。
 * DOM の aria-live リージョンにテキストを設定することで
 * スクリーンリーダーに状態変化を通知する。
 */

/**
 * polite アナウンス: ユーザーの現在の操作が終わってから読み上げ。
 * 保存完了、ファイルを開いた、タブを閉じた等に使用。
 */
export function announcePolite(message: string): void {
  const region = document.getElementById('aria-live-region');
  if (!region) return;
  // DOM の変更を確実に検知させるため一度クリアしてから設定
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

/**
 * assertive アナウンス: 即座に読み上げ。
 * エラー発生、モード切り替え等の緊急メッセージに使用。
 */
export function announceAssertive(message: string): void {
  const region = document.getElementById('aria-alert-region');
  if (!region) return;
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}
