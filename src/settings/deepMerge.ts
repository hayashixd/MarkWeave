/**
 * ネストされたオブジェクトを再帰的にマージする。
 *
 * - source の値が undefined なら target の値を保持
 * - 両方がプレーンオブジェクトなら再帰マージ
 * - それ以外は source の値で上書き
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<{ [K in keyof T]: unknown }>,
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (sourceVal === undefined) {
      continue;
    }

    if (
      isPlainObject(targetVal) &&
      isPlainObject(sourceVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      ) as T[keyof T];
    } else {
      result[key] = sourceVal as T[keyof T];
    }
  }

  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
