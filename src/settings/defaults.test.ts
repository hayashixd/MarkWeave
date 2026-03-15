import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, CURRENT_SETTINGS_VERSION } from './defaults';
import { DEFAULT_IMAGE_SETTINGS } from '../file/imageStorage';
import type { AppSettings } from './types';

describe('DEFAULT_SETTINGS', () => {
  it('バージョンが CURRENT_SETTINGS_VERSION と一致する', () => {
    expect(DEFAULT_SETTINGS.version).toBe(CURRENT_SETTINGS_VERSION);
    expect(DEFAULT_SETTINGS.version).toBe(1);
  });

  it('全カテゴリが存在する', () => {
    expect(DEFAULT_SETTINGS).toHaveProperty('appearance');
    expect(DEFAULT_SETTINGS).toHaveProperty('editor');
    expect(DEFAULT_SETTINGS).toHaveProperty('markdown');
    expect(DEFAULT_SETTINGS).toHaveProperty('file');
    expect(DEFAULT_SETTINGS).toHaveProperty('aiCopy');
  });

  describe('appearance', () => {
    it('テーマがsystemである', () => {
      expect(DEFAULT_SETTINGS.appearance.theme).toBe('system');
    });

    it('言語がautoである', () => {
      expect(DEFAULT_SETTINGS.appearance.language).toBe('auto');
    });

    it('エディタフォントサイズが16pxである', () => {
      expect(DEFAULT_SETTINGS.appearance.editorFontSize).toBe(16);
    });

    it('エディタ行間が1.7である', () => {
      expect(DEFAULT_SETTINGS.appearance.editorLineHeight).toBe(1.7);
    });

    it('UIフォントサイズが14pxである', () => {
      expect(DEFAULT_SETTINGS.appearance.uiFontSize).toBe(14);
    });

    it('フォントファミリーが空文字（テーマデフォルト）である', () => {
      expect(DEFAULT_SETTINGS.appearance.editorFontFamily).toBe('');
      expect(DEFAULT_SETTINGS.appearance.codeBlockFontFamily).toBe('');
    });
  });

  describe('editor', () => {
    it('オートフォーマットが有効である', () => {
      expect(DEFAULT_SETTINGS.editor.autoFormat).toBe(true);
    });

    it('スマートクォーテーションが無効である', () => {
      expect(DEFAULT_SETTINGS.editor.smartQuotes).toBe(false);
    });

    it('タブ幅が2である', () => {
      expect(DEFAULT_SETTINGS.editor.sourceTabSize).toBe(2);
    });

    it('スマートペーストがautoである', () => {
      expect(DEFAULT_SETTINGS.editor.smartPasteMode).toBe('auto');
    });
  });

  describe('markdown', () => {
    it('全拡張がデフォルトで有効である', () => {
      expect(DEFAULT_SETTINGS.markdown.enableMath).toBe(true);
      expect(DEFAULT_SETTINGS.markdown.enableMermaid).toBe(true);
      expect(DEFAULT_SETTINGS.markdown.enableHighlight).toBe(true);
      expect(DEFAULT_SETTINGS.markdown.enableSuperscript).toBe(true);
      expect(DEFAULT_SETTINGS.markdown.enableSubscript).toBe(true);
      expect(DEFAULT_SETTINGS.markdown.enableTaskList).toBe(true);
      expect(DEFAULT_SETTINGS.markdown.enableFrontMatter).toBe(true);
      expect(DEFAULT_SETTINGS.markdown.enableGfmStrikethrough).toBe(true);
    });
  });

  describe('file', () => {
    it('自動保存間隔が2000msである', () => {
      expect(DEFAULT_SETTINGS.file.autoSaveDelay).toBe(2000);
    });

    it('バックアップがデフォルトで無効である', () => {
      expect(DEFAULT_SETTINGS.file.createBackup).toBe(false);
    });

    it('セッション復元が有効である', () => {
      expect(DEFAULT_SETTINGS.file.restoreSession).toBe(true);
    });

    it('画像設定がDEFAULT_IMAGE_SETTINGSと一致する', () => {
      expect(DEFAULT_SETTINGS.file.imageSettings).toEqual(DEFAULT_IMAGE_SETTINGS);
    });
  });

  describe('aiCopy', () => {
    it('基本的な正規化が有効である', () => {
      expect(DEFAULT_SETTINGS.aiCopy.normalizeHeadings).toBe(true);
      expect(DEFAULT_SETTINGS.aiCopy.annotateCodeBlocks).toBe(true);
      expect(DEFAULT_SETTINGS.aiCopy.normalizeListMarkers).toBe(true);
      expect(DEFAULT_SETTINGS.aiCopy.trimWhitespace).toBe(true);
      expect(DEFAULT_SETTINGS.aiCopy.normalizeCodeFences).toBe(true);
    });

    it('高度な機能がデフォルトで無効である', () => {
      expect(DEFAULT_SETTINGS.aiCopy.annotateLinks).toBe(false);
      expect(DEFAULT_SETTINGS.aiCopy.analyzePromptStructure).toBe(false);
    });
  });

  it('AppSettings型に準拠する（コンパイル時チェック）', () => {
    const settings: AppSettings = DEFAULT_SETTINGS;
    expect(settings).toBeDefined();
  });
});
