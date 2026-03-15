/**
 * パストラバーサル対策ユーティリティ（security-design.md §3.4 準拠）
 *
 * Tauri の plugin-fs はスコープ外のパスへのアクセスをブロックするが、
 * TypeScript 側でも検証して多層防御とする。
 */

import { resolve } from '@tauri-apps/api/path';

/**
 * 指定されたパスが許可されたベースディレクトリ内に収まっているか検証する。
 * パストラバーサル（../../etc/passwd 等）を防ぐ。
 *
 * @param targetPath 検証対象のパス
 * @param baseDir 許可されたベースディレクトリ
 * @returns ベースディレクトリ内に収まっている場合 true
 */
export async function isPathWithinBase(
  targetPath: string,
  baseDir: string,
): Promise<boolean> {
  const normalizedTarget = await resolve(targetPath);
  const normalizedBase = await resolve(baseDir);

  // ベースディレクトリ自体、またはその配下であることを確認
  // セパレータを付与して部分一致（/app vs /application）を防ぐ
  const baseWithSep = normalizedBase.endsWith('/') || normalizedBase.endsWith('\\')
    ? normalizedBase
    : normalizedBase + '/';

  return normalizedTarget === normalizedBase || normalizedTarget.startsWith(baseWithSep);
}

/**
 * パスに危険なパターンが含まれていないか簡易チェックする。
 * resolve/normalize の前段フィルタとして使用する。
 *
 * @param path 検証対象のパス
 * @returns 危険なパターンが含まれている場合 true
 */
export function containsTraversalPattern(path: string): boolean {
  // null バイト（C 言語由来のパス切り詰め攻撃）
  if (path.includes('\0')) return true;

  // 正規化前の相対パス上昇（../ or ..\）
  const normalized = path.replace(/\\/g, '/');
  if (normalized.includes('../') || normalized.endsWith('..')) return true;

  return false;
}
