/**
 * パフォーマンス計測ユーティリティ
 *
 * performance-design.md §8 に準拠。
 * 各計測ポイントで console.log にタイミングを出力する。
 * 開発ビルドでのみ有用（プロダクションビルドでは console が抑制される想定）。
 */

/**
 * ファイルロード時間の計測 (§8.2)
 *
 * @param label - 計測ラベル（例: "File read", "Parse"）
 * @param fn - 計測対象の非同期関数
 * @returns 関数の戻り値
 */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const t0 = performance.now();
  const result = await fn();
  const t1 = performance.now();
  console.log(`[Perf] ${label}: ${(t1 - t0).toFixed(1)}ms`);
  return result;
}

/**
 * 同期処理の計測
 *
 * @param label - 計測ラベル
 * @param fn - 計測対象の同期関数
 * @returns 関数の戻り値
 */
export function measureSync<T>(label: string, fn: () => T): T {
  const t0 = performance.now();
  const result = fn();
  const t1 = performance.now();
  console.log(`[Perf] ${label}: ${(t1 - t0).toFixed(1)}ms`);
  return result;
}
