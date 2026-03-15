import { describe, it, expect } from 'vitest';
import { translateError } from './tauri-commands';

describe('translateError', () => {
  it('translates FileNotFound error', () => {
    const err = JSON.stringify({
      kind: 'FileNotFound',
      detail: { path: '/path/to/file.md' },
    });
    expect(translateError(err)).toBe('ファイルが見つかりません: /path/to/file.md');
  });

  it('translates PermissionDenied error', () => {
    const err = JSON.stringify({
      kind: 'PermissionDenied',
      detail: { path: '/protected/file.md' },
    });
    expect(translateError(err)).toBe('アクセス権がありません: /protected/file.md');
  });

  it('translates DiskFull error', () => {
    const err = JSON.stringify({ kind: 'DiskFull' });
    expect(translateError(err)).toBe('ディスク容量が不足しています');
  });

  it('translates WriteFailed error', () => {
    const err = JSON.stringify({
      kind: 'WriteFailed',
      detail: { path: '/path/to/file.md', reason: 'disk busy' },
    });
    expect(translateError(err)).toBe('ファイルの保存に失敗しました: /path/to/file.md');
  });

  it('falls back for unknown error kind', () => {
    const err = JSON.stringify({ kind: 'SomethingNew' });
    expect(translateError(err)).toBe('予期しないエラーが発生しました');
  });

  it('handles plain string error', () => {
    expect(translateError('something went wrong')).toBe('something went wrong');
  });

  it('handles Error instance', () => {
    expect(translateError(new Error('test error'))).toBe('test error');
  });

  it('handles non-string, non-Error input', () => {
    expect(translateError(42)).toBe('予期しないエラーが発生しました');
  });

  it('translates LicenseInvalid error', () => {
    const err = JSON.stringify({ kind: 'LicenseInvalid' });
    expect(translateError(err)).toContain('ライセンスキーが無効');
  });

  it('translates LicenseNotFound error', () => {
    const err = JSON.stringify({ kind: 'LicenseNotFound' });
    expect(translateError(err)).toContain('ライセンスが見つかりません');
  });
});
