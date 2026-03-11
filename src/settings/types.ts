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
  /** 執筆目標文字数 (0 = 無効). ステータスバーにカウンターと進捗バーを表示 */
  writingGoal: number;
  /** アンビエントサウンド種別 ('off' | 'white' | 'brown' | 'rain' | 'cafe') */
  ambientSound: 'off' | 'white' | 'brown' | 'rain' | 'cafe';
  /** アンビエントサウンド音量 (0.0–1.0) */
  ambientVolume: number;
  /** タイプライター打鍵音フィードバックの有効/無効 */
  typewriterSound: boolean;
  /** タイプライター打鍵音のスタイル */
  typewriterStyle: 'mechanical' | 'soft' | 'typewriter';
  /** タイプライター打鍵音の音量 (0.0–1.0) */
  typewriterVolume: number;
  /** ポモドーロタイマーの有効/無効 */
  pomodoroEnabled: boolean;
  /** ポモドーロ集中時間（分） */
  pomodoroWorkMinutes: number;
  /** ポモドーロ休憩時間（分） */
  pomodoroBreakMinutes: number;
  /** ワードスプリントの有効/無効 */
  wordSprintEnabled: boolean;
  /** ワードスプリント制限時間（分） */
  wordSprintDurationMinutes: number;
  /** ワードスプリント目標文字数 */
  wordSprintTargetWords: number;
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

export interface SlashCommandSettings {
  /** スラッシュコマンド機能の有効/無効 */
  enabled: boolean;
  /** AIテンプレートコマンドをスラッシュコマンドメニューに含めるか */
  showAiTemplates: boolean;
}

/** 外部ツール・エクスポート設定（export-interop-design.md §9.2） */
export interface ExportSettings {
  /** Pandoc の実行パス（空文字列 = 自動検出） */
  pandocPath: string;
}

/** Git 統合設定（git-integration-design.md §9） */
export interface GitSettings {
  /** Git 統合の有効/無効 */
  enabled: boolean;
  /** ファイルツリーのバッジ表示 */
  showFileTreeBadges: boolean;
  /** ガターの差分インジケーター */
  showGutterIndicators: boolean;
  /** ステータスバーのブランチ表示 */
  showStatusBarBranch: boolean;
  /** 自動更新間隔（秒、0 で無効） */
  autoPollInterval: number;
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
  slashCommands: SlashCommandSettings;
  export: ExportSettings;
  git: GitSettings;
}

/** ネストされたオブジェクトの部分更新用ユーティリティ型 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
