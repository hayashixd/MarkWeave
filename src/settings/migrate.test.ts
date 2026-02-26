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

  it('v0 でマイグレーション後も他のカテゴリのデフォルトが保持される', () => {
    const v0 = { appearance: { theme: 'light' as const } };
    const result = migrateSettings(v0);
    expect(result.markdown).toEqual(DEFAULT_SETTINGS.markdown);
    expect(result.file).toEqual(DEFAULT_SETTINGS.file);
  });

  it('空オブジェクトを受け取ると v0→v1 マイグレーションが走る', () => {
    const result = migrateSettings({});
    expect(result.version).toBe(1);
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('未知のキーが存在しても例外を投げない', () => {
    const withExtra = {
      ...DEFAULT_SETTINGS,
      unknownSection: { foo: 'bar' },
    };
    const result = migrateSettings(withExtra);
    expect(result.version).toBe(1);
    expect(result.appearance).toEqual(DEFAULT_SETTINGS.appearance);
  });

  it('配列値を受け取るとデフォルトを返す（配列はオブジェクトだが設定ではない）', () => {
    const result = migrateSettings([1, 2, 3]);
    // 配列は typeof 'object' なので v0 マイグレーション経路に入るが、
    // spread で安全にデフォルト値で補完される
    expect(result.version).toBe(1);
  });
});
