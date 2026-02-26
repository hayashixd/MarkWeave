import { describe, it, expect } from 'vitest';
import { translateError } from './error-translator';

describe('translateError', () => {
  it('FileNotFound を日本語に翻訳する', () => {
    const err = { kind: 'FileNotFound', detail: { path: '/test.md' } };
    expect(translateError(err)).toContain('ファイルが見つかりません');
    expect(translateError(err)).toContain('/test.md');
  });

  it('PermissionDenied を翻訳する', () => {
    const err = { kind: 'PermissionDenied', detail: { path: '/secret.md' } };
    expect(translateError(err)).toContain('アクセス権');
  });

  it('DiskFull を翻訳する', () => {
    const err = { kind: 'DiskFull' };
    expect(translateError(err)).toContain('ディスク');
  });

  it('FileLocked を翻訳する', () => {
    const err = { kind: 'FileLocked', detail: { path: '/locked.md' } };
    expect(translateError(err)).toContain('別のアプリ');
  });

  it('InvalidPath を翻訳する', () => {
    const err = { kind: 'InvalidPath', detail: { path: ':::bad' } };
    expect(translateError(err)).toContain('無効なファイルパス');
  });

  it('Unknown エラーを汎用メッセージに翻訳する', () => {
    const err = { kind: 'Unknown', detail: { message: 'internal error' } };
    expect(translateError(err)).toContain('予期しないエラー');
  });

  it('Error オブジェクトをフォールバックメッセージに変換する', () => {
    expect(translateError(new Error('boom'))).toContain('予期しないエラー');
  });

  it('文字列をそのまま返す', () => {
    expect(translateError('some error')).toBe('some error');
  });

  it('null を文字列化する', () => {
    expect(translateError(null)).toBe('null');
  });
});
