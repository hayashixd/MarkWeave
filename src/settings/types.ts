/**
 * アプリ設定の型定義。
 *
 * user-settings-design.md §3 に準拠。
 */

import type { ImageStorageSettings } from '../file/imageStorage';
import type { AppTheme } from '../themes/theme-manager';

export interface AppearanceSettings {
  theme: AppTheme;
  /** UI 表示言語。'auto' は OS ロケールに自動追従（詳細: i18n-design.md） */
  language: 'auto' | 'ja' | 'en';
  editorFontFamily: string;
  editorFontSize: number;
  editorLineHeight: number;
  uiFontSize: number;
  codeBlockFontFamily: string;
  codeBlockFontSize: number;
  paragraphSpacing: number;
}

export interface EditorSettings {
  autoFormat: boolean;
  smartQuotes: boolean;
  sourceTabSize: number;
  smartPasteMode: 'auto' | 'ask' | 'never';
  showLineNumbers: boolean;
  wordWrap: boolean;
  highlightCurrentLine: boolean;
  /** インデントスタイル: スペース or タブ */
  indentStyle: 'spaces' | 'tabs';
  /** フォーカスモード: カーソル外のブロックを薄く表示して集中執筆を支援 */
  focusMode: boolean;
  /** タイプライターモード: カーソル行を常に画面中央に保つ */
  typewriterMode: boolean;
  /** Zen モード: UI を完全に隠してフルスクリーン執筆 */
  zenMode: boolean;
}

export interface MarkdownSettings {
  enableMath: boolean;
  enableMermaid: boolean;
  enableHighlight: boolean;
  enableSuperscript: boolean;
  enableSubscript: boolean;
  enableTaskList: boolean;
  enableFrontMatter: boolean;
  enableGfmStrikethrough: boolean;
}

export interface FileSettings {
  autoSaveDelay: number;
  createBackup: boolean;
  defaultSaveDir: string;
  imageSettings: ImageStorageSettings;
  restoreSession: boolean;
  /** 改行コード保存設定: preserve=読み込み時の改行を維持, lf/crlf/os=指定の改行で保存 */
  lineEnding: 'preserve' | 'lf' | 'crlf' | 'os';
}

export interface AiCopySettings {
  normalizeHeadings: boolean;
  annotateCodeBlocks: boolean;
  normalizeListMarkers: boolean;
  trimWhitespace: boolean;
  annotateLinks: boolean;
  normalizeCodeFences: boolean;
  analyzePromptStructure: boolean;
}

/** アプリ設定の全体型 */
export interface AppSettings {
  /** 設定ファイルのバージョン。マイグレーションに使用 */
  version: number;
  appearance: AppearanceSettings;
  editor: EditorSettings;
  markdown: MarkdownSettings;
  file: FileSettings;
  aiCopy: AiCopySettings;
}

/** ネストされたオブジェクトの部分更新用ユーティリティ型 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
