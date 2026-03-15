/**
 * ライセンス関連の Tauri invoke ラッパーテスト
 *
 * window.__TAURI_INTERNALS__.invoke をスパイして
 * 各ラッパー関数が正しいコマンド名・引数で呼び出すことを検証する。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activateLicense, getLicenseStatus, removeLicense } from './tauri-commands';

// ---- ヘルパー ----

function mockInvokeSuccess(returnValue: unknown) {
  return vi
    .spyOn(window.__TAURI_INTERNALS__ as { invoke: (...args: unknown[]) => Promise<unknown> }, 'invoke')
    .mockResolvedValue(returnValue);
}

function mockInvokeFailure(errorJson: string) {
  return vi
    .spyOn(window.__TAURI_INTERNALS__ as { invoke: (...args: unknown[]) => Promise<unknown> }, 'invoke')
    .mockRejectedValue(errorJson);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// =========================================================================
// activateLicense
// =========================================================================

describe('activateLicense', () => {
  it('invokes activate_license with the key argument', async () => {
    const spy = mockInvokeSuccess({
      activated: true,
      email: 'buyer@example.com',
      activatedAt: 1_700_000_000,
    });

    await activateLicense('ABCD-1234-EFGH-5678');

    expect(spy).toHaveBeenCalledWith(
      'activate_license',
      { key: 'ABCD-1234-EFGH-5678' },
      undefined,
    );
  });

  it('returns LicenseStatus on success', async () => {
    const expected = {
      activated: true,
      email: 'buyer@example.com',
      activatedAt: 1_700_000_000,
    };
    mockInvokeSuccess(expected);

    const result = await activateLicense('VALID-KEY');
    expect(result.activated).toBe(true);
    expect(result.email).toBe('buyer@example.com');
    expect(result.activatedAt).toBe(1_700_000_000);
  });

  it('throws a translated error when invoke rejects with LicenseInvalid', async () => {
    mockInvokeFailure(JSON.stringify({ kind: 'LicenseInvalid' }));

    await expect(activateLicense('BAD-KEY')).rejects.toThrow('ライセンスキーが無効');
  });

  it('throws a translated error when invoke rejects with Unknown error', async () => {
    mockInvokeFailure(
      JSON.stringify({
        kind: 'Unknown',
        detail: { message: 'That license does not exist for the provided product.' },
      }),
    );

    await expect(activateLicense('BAD-KEY')).rejects.toThrow(
      'That license does not exist',
    );
  });

  it('throws a translated error on network error message', async () => {
    mockInvokeFailure(
      JSON.stringify({
        kind: 'Unknown',
        detail: { message: '接続がタイムアウトしました。インターネット接続を確認してください。' },
      }),
    );

    await expect(activateLicense('KEY')).rejects.toThrow('タイムアウト');
  });
});

// =========================================================================
// getLicenseStatus
// =========================================================================

describe('getLicenseStatus', () => {
  it('returns activated status from invoke result', async () => {
    mockInvokeSuccess({
      activated: true,
      email: 'user@example.com',
      activatedAt: 1_750_000_000,
    });

    const status = await getLicenseStatus();
    expect(status.activated).toBe(true);
    expect(status.email).toBe('user@example.com');
    expect(status.activatedAt).toBe(1_750_000_000);
  });

  it('returns not-activated status when license is absent', async () => {
    mockInvokeSuccess({ activated: false, email: null, activatedAt: null });

    const status = await getLicenseStatus();
    expect(status.activated).toBe(false);
    expect(status.email).toBeNull();
    expect(status.activatedAt).toBeNull();
  });

  it('returns not-activated status gracefully when invoke throws', async () => {
    // getLicenseStatus はエラーを握りつぶして未認証を返す
    vi.spyOn(
      window.__TAURI_INTERNALS__ as { invoke: (...args: unknown[]) => Promise<unknown> },
      'invoke',
    ).mockRejectedValue(new Error('something went wrong'));

    const status = await getLicenseStatus();
    expect(status.activated).toBe(false);
    expect(status.email).toBeNull();
  });

  it('invokes get_license_status command with no extra args', async () => {
    const spy = mockInvokeSuccess({ activated: false, email: null, activatedAt: null });

    await getLicenseStatus();

    expect(spy).toHaveBeenCalledWith('get_license_status', {}, undefined);
  });
});

// =========================================================================
// removeLicense
// =========================================================================

describe('removeLicense', () => {
  it('invokes remove_license command', async () => {
    const spy = mockInvokeSuccess(null);

    await removeLicense();

    expect(spy).toHaveBeenCalledWith('remove_license', {}, undefined);
  });

  it('resolves without return value on success', async () => {
    mockInvokeSuccess(null);
    await expect(removeLicense()).resolves.toBeUndefined();
  });

  it('throws translated error when invoke rejects', async () => {
    mockInvokeFailure(
      JSON.stringify({ kind: 'Unknown', detail: { message: 'permission denied' } }),
    );

    await expect(removeLicense()).rejects.toThrow('permission denied');
  });
});
