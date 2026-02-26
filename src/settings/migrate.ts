/**
 * 設定マイグレーション関数。
 *
 * user-settings-design.md §7 に準拠。
 *
 * 運用ルール:
 * - 設定を追加するとき: DEFAULT_SETTINGS にデフォルト値を追加し、
 *   旧バージョン用の補完を migrateSettings に記述
 * - 設定を削除するとき: 余分なキーは deepMerge で無視される
 * - 設定の型が変わるとき: version をインクリメントし、型変換ロジックを追加
 */

import type { AppSettings } from './types';
import { DEFAULT_SETTINGS, CURRENT_SETTINGS_VERSION } from './defaults';
import { deepMerge } from './deepMerge';

/** 古い設定オブジェクトを最新バージョンに変換する */
export function migrateSettings(raw: unknown): AppSettings {
  if (typeof raw !== 'object' || raw === null) {
    return DEFAULT_SETTINGS;
  }

  const partial = raw as Partial<AppSettings>;
  let version = partial.version ?? 0;

  // v0 → v1: aiCopy セクションが存在しない旧バージョン対応
  if (version < 1) {
    const migrated = {
      ...DEFAULT_SETTINGS,
      appearance: { ...DEFAULT_SETTINGS.appearance, ...partial.appearance },
      editor: { ...DEFAULT_SETTINGS.editor, ...partial.editor },
      markdown: { ...DEFAULT_SETTINGS.markdown, ...partial.markdown },
      file: { ...DEFAULT_SETTINGS.file, ...partial.file },
      aiCopy: DEFAULT_SETTINGS.aiCopy,
      version: 1,
    };
    version = 1;

    // 最新バージョンならここで返す
    if (version >= CURRENT_SETTINGS_VERSION) {
      return migrated;
    }
  }

  // 将来のマイグレーション: v1 → v2 等はここに追加
  // if (version < 2) { ... version = 2; }

  // 最新バージョン: 不足キーをデフォルトで補完
  return deepMerge(
    DEFAULT_SETTINGS as unknown as Record<string, unknown>,
    partial as unknown as Record<string, unknown>,
  ) as unknown as AppSettings;
}
