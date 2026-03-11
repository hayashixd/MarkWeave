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
    focusMode: false,
    typewriterMode: false,
    zenMode: false,
    writingGoal: 0,
    ambientSound: 'off',
    ambientVolume: 0.4,
    typewriterSound: false,
    typewriterStyle: 'mechanical',
    typewriterVolume: 0.3,
    pomodoroEnabled: false,
    pomodoroWorkMinutes: 25,
    pomodoroBreakMinutes: 5,
    wordSprintEnabled: false,
    wordSprintDurationMinutes: 15,
    wordSprintTargetWords: 500,
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
  slashCommands: {
    enabled: true,
    showAiTemplates: true,
  },
  export: {
    pandocPath: '',
  },
  git: {
    enabled: true,
    showFileTreeBadges: true,
    showGutterIndicators: true,
    showStatusBarBranch: true,
    autoPollInterval: 30,
  },
};
