/**
 * アプリ設定のデフォルト値。
 *
 * user-settings-design.md §6 に準拠。
 */

import type { AppSettings } from './types';
import { DEFAULT_IMAGE_SETTINGS } from '../file/imageStorage';

export const CURRENT_SETTINGS_VERSION = 1;

export const DEFAULT_SETTINGS: AppSettings = {
  version: CURRENT_SETTINGS_VERSION,
  appearance: {
    theme: 'system',
    language: 'auto',
    editorFontFamily: '',
    editorFontSize: 16,
    editorLineHeight: 1.7,
    uiFontSize: 14,
    codeBlockFontFamily: '',
    codeBlockFontSize: 14,
    paragraphSpacing: 10,
  },
  editor: {
    autoFormat: true,
    smartQuotes: false,
    sourceTabSize: 2,
    smartPasteMode: 'auto',
    showLineNumbers: false,
    wordWrap: true,
    highlightCurrentLine: true,
    indentStyle: 'spaces',
  },
  markdown: {
    enableMath: true,
    enableMermaid: true,
    enableHighlight: true,
    enableSuperscript: true,
    enableSubscript: true,
    enableTaskList: true,
    enableFrontMatter: true,
    enableGfmStrikethrough: true,
  },
  file: {
    autoSaveDelay: 2000,
    createBackup: false,
    defaultSaveDir: '',
    imageSettings: DEFAULT_IMAGE_SETTINGS,
    restoreSession: true,
    lineEnding: 'preserve',
  },
  aiCopy: {
    normalizeHeadings: true,
    annotateCodeBlocks: true,
    normalizeListMarkers: true,
    trimWhitespace: true,
    annotateLinks: false,
    normalizeCodeFences: true,
    analyzePromptStructure: false,
  },
};
