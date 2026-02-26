/**
 * 画像保存設定の型定義とデフォルト値。
 *
 * image-design.md §1 に準拠。
 */

export type ImageSaveMode =
  | 'same-dir'
  | 'subfolder'
  | 'custom-relative'
  | 'custom-absolute';

export type FilenameStrategy =
  | 'uuid'
  | 'timestamp'
  | 'original'
  | 'timestamp-original';

export interface ImageStorageSettings {
  saveMode: ImageSaveMode;
  subfolderName: string;
  customPath: string;
  filenameStrategy: FilenameStrategy;
  deduplicateByHash: boolean;
  autoResize: boolean;
  maxWidth: number;
  maxHeight: number;
  jpegQuality: number;
  preservePng: boolean;
  convertToWebP: boolean;
}

export const DEFAULT_IMAGE_SETTINGS: ImageStorageSettings = {
  saveMode: 'subfolder',
  subfolderName: 'assets',
  customPath: '',
  filenameStrategy: 'timestamp-original',
  deduplicateByHash: true,
  autoResize: false,
  maxWidth: 1920,
  maxHeight: 1080,
  jpegQuality: 0.85,
  preservePng: true,
  convertToWebP: false,
};
