/**
 * 設定マイグレーション関数。
 *
 * user-settings-design.md §7 に準拠。
 * 本格的な段階的マイグレーションは「設定マイグレーション関数」タスクで実装。
 * 現時点では不足キーをデフォルト値で補完するのみ。
 */

import type { AppSettings } from './types';
import { DEFAULT_SETTINGS } from './defaults';
import { deepMerge } from './deepMerge';

/** 古い設定オブジェクトを最新バージョンに変換する */
export function migrateSettings(raw: unknown): AppSettings {
  if (typeof raw !== 'object' || raw === null) {
    return DEFAULT_SETTINGS;
  }

  const partial = raw as Partial<AppSettings>;
  const version = partial.version ?? 0;

  // v0 → v1: aiCopy セクションが存在しない旧バージョン対応
  if (version < 1) {
    return {
      ...DEFAULT_SETTINGS,
      appearance: { ...DEFAULT_SETTINGS.appearance, ...partial.appearance },
      editor: { ...DEFAULT_SETTINGS.editor, ...partial.editor },
      markdown: { ...DEFAULT_SETTINGS.markdown, ...partial.markdown },
      file: { ...DEFAULT_SETTINGS.file, ...partial.file },
      aiCopy: DEFAULT_SETTINGS.aiCopy,
      version: 1,
    };
  }

  // 最新バージョン: 不足キーをデフォルトで補完
  return deepMerge(
    DEFAULT_SETTINGS as unknown as Record<string, unknown>,
    partial as unknown as Record<string, unknown>,
  ) as unknown as AppSettings;
}
