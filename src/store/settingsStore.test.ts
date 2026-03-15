import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settingsStore';
import { DEFAULT_SETTINGS } from '../settings/defaults';

describe('settingsStore', () => {
  beforeEach(() => {
    // ストアをリセット
    useSettingsStore.setState({
      settings: DEFAULT_SETTINGS,
      loaded: false,
    });
  });

  it('初期状態で DEFAULT_SETTINGS が設定されている', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('初期状態で loaded が false', () => {
    const { loaded } = useSettingsStore.getState();
    expect(loaded).toBe(false);
  });

  it('loadSettings が Tauri 外ではデフォルト値で起動する', async () => {
    await useSettingsStore.getState().loadSettings();

    const { settings, loaded } = useSettingsStore.getState();
    expect(loaded).toBe(true);
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('updateSettings で部分更新できる', async () => {
    await useSettingsStore.getState().loadSettings();

    await useSettingsStore.getState().updateSettings({
      appearance: { theme: 'dark' },
    });

    const { settings } = useSettingsStore.getState();
    expect(settings.appearance.theme).toBe('dark');
    // 他の値は保持される
    expect(settings.appearance.editorFontSize).toBe(16);
    expect(settings.editor.autoFormat).toBe(true);
  });

  it('updateSettings で深くネストされた値を更新できる', async () => {
    await useSettingsStore.getState().loadSettings();

    await useSettingsStore.getState().updateSettings({
      editor: { sourceTabSize: 4 },
    });

    const { settings } = useSettingsStore.getState();
    expect(settings.editor.sourceTabSize).toBe(4);
    expect(settings.editor.autoFormat).toBe(true);
  });

  it('resetSettings でデフォルトに戻せる', async () => {
    await useSettingsStore.getState().loadSettings();
    await useSettingsStore.getState().updateSettings({
      appearance: { theme: 'dark' },
    });

    await useSettingsStore.getState().resetSettings();

    const { settings } = useSettingsStore.getState();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
});
