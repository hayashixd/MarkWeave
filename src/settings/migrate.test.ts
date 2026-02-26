import { describe, it, expect } from 'vitest';
import { migrateSettings } from './migrate';
import { DEFAULT_SETTINGS } from './defaults';

describe('migrateSettings', () => {
  it('null を受け取るとデフォルト値を返す', () => {
    expect(migrateSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('undefined を受け取るとデフォルト値を返す', () => {
    expect(migrateSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('プリミティブ値を受け取るとデフォルト値を返す', () => {
    expect(migrateSettings('string')).toEqual(DEFAULT_SETTINGS);
    expect(migrateSettings(42)).toEqual(DEFAULT_SETTINGS);
  });

  it('v0 の設定を v1 にマイグレーションする', () => {
    const v0 = {
      appearance: { theme: 'dark' as const },
      editor: { autoFormat: false },
    };
    const result = migrateSettings(v0);
    expect(result.version).toBe(1);
    expect(result.appearance.theme).toBe('dark');
    expect(result.editor.autoFormat).toBe(false);
    // aiCopy はデフォルト値が使われる
    expect(result.aiCopy).toEqual(DEFAULT_SETTINGS.aiCopy);
  });

  it('v1 の設定で不足キーをデフォルトで補完する', () => {
    const v1 = {
      version: 1,
      appearance: { theme: 'dark' as const },
    };
    const result = migrateSettings(v1);
    expect(result.version).toBe(1);
    expect(result.appearance.theme).toBe('dark');
    // 不足キーはデフォルト値
    expect(result.editor).toEqual(DEFAULT_SETTINGS.editor);
  });

  it('完全な v1 設定をそのまま返す', () => {
    const result = migrateSettings(DEFAULT_SETTINGS);
    expect(result).toEqual(DEFAULT_SETTINGS);
  });
});
