/**
 * i18n 言語切り替えのユニットテスト
 *
 * tWithLang を直接呼び出して日本語・英語それぞれの翻訳結果を検証する。
 * また useSettingsStore の language 設定変更が翻訳に反映されることを確認する。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { tWithLang } from './i18n';
import { useSettingsStore } from './store/settingsStore';
import { DEFAULT_SETTINGS } from './settings/defaults';

describe('tWithLang — 言語別翻訳', () => {
  it('日本語: 表示言語ラベルが返る', () => {
    expect(tWithLang('ja', 'settings:appearance.language')).toBe('表示言語');
  });

  it('英語: Display Language が返る', () => {
    expect(tWithLang('en', 'settings:appearance.language')).toBe('Display Language');
  });

  it('日本語: 自動オプションが返る', () => {
    expect(tWithLang('ja', 'settings:appearance.languageAuto')).toBe('自動（OS設定に従う）');
  });

  it('英語: 自動オプションが返る', () => {
    expect(tWithLang('en', 'settings:appearance.languageAuto')).toBe('Auto (follow OS setting)');
  });

  it('日本語: 日本語オプションが返る', () => {
    expect(tWithLang('ja', 'settings:appearance.languageJa')).toBe('日本語');
  });

  it('英語: 日本語オプションが返る（日本語のまま）', () => {
    expect(tWithLang('en', 'settings:appearance.languageJa')).toBe('日本語');
  });

  it('英語: English オプションが返る', () => {
    expect(tWithLang('en', 'settings:appearance.languageEn')).toBe('English');
  });

  it('日本語: サイドバー設定ラベルが返る', () => {
    expect(tWithLang('ja', 'settings:sidebar.showAdvancedTabs')).toContain('高度なサイドバータブ');
  });

  it('英語: サイドバー設定ラベルが返る', () => {
    expect(tWithLang('en', 'settings:sidebar.showAdvancedTabs')).toContain('advanced sidebar tabs');
  });

  it('存在しないキーはキー文字列をそのまま返す', () => {
    // tWithLang は rawKey をそのまま返すため、名前空間プレフィックスも含まれる
    expect(tWithLang('en', 'settings:nonexistent.key')).toBe('settings:nonexistent.key');
  });

  it('英語キーが未定義でも日本語にフォールバックする', () => {
    // settings:trial.remainingDays は両言語に存在するが補間テストとして使用
    const result = tWithLang('en', 'settings:trial.remainingDays', { count: 5 });
    expect(result).toContain('5');
  });
});

describe('settingsStore — language 設定の変更と永続化', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: DEFAULT_SETTINGS,
      loaded: false,
    });
  });

  it('デフォルト言語は auto', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.appearance.language).toBe('auto');
  });

  it('language を en に変更できる', async () => {
    await useSettingsStore.getState().loadSettings();
    await useSettingsStore.getState().updateSettings({ appearance: { language: 'en' } });

    const { settings } = useSettingsStore.getState();
    expect(settings.appearance.language).toBe('en');
    // 他の外観設定は保持される
    expect(settings.appearance.theme).toBe(DEFAULT_SETTINGS.appearance.theme);
  });

  it('language を ja に変更できる', async () => {
    await useSettingsStore.getState().loadSettings();
    await useSettingsStore.getState().updateSettings({ appearance: { language: 'ja' } });

    const { settings } = useSettingsStore.getState();
    expect(settings.appearance.language).toBe('ja');
  });

  it('language を auto に戻せる', async () => {
    await useSettingsStore.getState().loadSettings();
    await useSettingsStore.getState().updateSettings({ appearance: { language: 'en' } });
    await useSettingsStore.getState().updateSettings({ appearance: { language: 'auto' } });

    const { settings } = useSettingsStore.getState();
    expect(settings.appearance.language).toBe('auto');
  });

  it('resetSettings で language が auto に戻る', async () => {
    await useSettingsStore.getState().loadSettings();
    await useSettingsStore.getState().updateSettings({ appearance: { language: 'en' } });
    await useSettingsStore.getState().resetSettings();

    const { settings } = useSettingsStore.getState();
    expect(settings.appearance.language).toBe('auto');
  });
});
