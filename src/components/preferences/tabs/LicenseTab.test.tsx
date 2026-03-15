/**
 * LicenseTab コンポーネントテスト
 *
 * tauri-commands モジュールをモック化して
 * UIの各状態・操作を検証する。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { LicenseTab } from './LicenseTab';
import * as tauriCommands from '../../../lib/tauri-commands';

// ---- i18n モック（翻訳キーをそのまま返す） ----
vi.mock('../../../i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// ---- tauri-commands モック ----
vi.mock('../../../lib/tauri-commands', () => ({
  getLicenseStatus: vi.fn(),
  activateLicense: vi.fn(),
  removeLicense: vi.fn(),
}));

const mockGetLicenseStatus = vi.mocked(tauriCommands.getLicenseStatus);
const mockActivateLicense = vi.mocked(tauriCommands.activateLicense);
const mockRemoveLicense = vi.mocked(tauriCommands.removeLicense);

// ---- ヘルパー ----

const NOT_ACTIVATED = { activated: false, email: null, activatedAt: null };
const ACTIVATED = {
  activated: true,
  email: 'buyer@example.com',
  activatedAt: 1_700_000_000,
};

beforeEach(() => {
  vi.clearAllMocks();
  // デフォルト: 未認証
  mockGetLicenseStatus.mockResolvedValue(NOT_ACTIVATED);
  // confirm ダイアログをデフォルトで承認
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

// =========================================================================
// 初期ロード
// =========================================================================

describe('初期ロード', () => {
  it('マウント時に getLicenseStatus を呼ぶ', async () => {
    render(<LicenseTab />);
    await waitFor(() => {
      expect(mockGetLicenseStatus).toHaveBeenCalledTimes(1);
    });
  });

  it('ステータス取得中はローディング表示', () => {
    // resolve を保留したまま render
    let resolve!: (v: tauriCommands.LicenseStatus) => void;
    mockGetLicenseStatus.mockReturnValue(
      new Promise<tauriCommands.LicenseStatus>((r) => {
        resolve = r;
      }),
    );

    render(<LicenseTab />);
    expect(screen.getByText('common:loading')).toBeInTheDocument();

    // クリーンアップのため解決
    act(() => {
      resolve(NOT_ACTIVATED);
    });
  });
});

// =========================================================================
// 未認証状態
// =========================================================================

describe('未認証状態', () => {
  it('ライセンスキー入力フィールドを表示する', async () => {
    render(<LicenseTab />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX')).toBeInTheDocument();
    });
  });

  it('キーが空のときは認証ボタンが無効', async () => {
    render(<LicenseTab />);
    await waitFor(() => {
      const button = screen.getByRole('button', { name: 'license.activate' });
      expect(button).toBeDisabled();
    });
  });

  it('キーを入力すると認証ボタンが有効になる', async () => {
    render(<LicenseTab />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX');
    fireEvent.change(input, { target: { value: 'ABCD-1234-EFGH-5678' } });

    expect(screen.getByRole('button', { name: 'license.activate' })).not.toBeDisabled();
  });

  it('Gumroad への購入リンクを表示する', async () => {
    render(<LicenseTab />);
    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'Gumroad' });
      expect(link).toHaveAttribute('href', 'https://xdhyskh.gumroad.com/l/qwctrq');
    });
  });
});

// =========================================================================
// 認証フォーム送信
// =========================================================================

describe('認証フォーム送信', () => {
  it('成功時に認証済み状態を表示する', async () => {
    mockActivateLicense.mockResolvedValue(ACTIVATED);

    render(<LicenseTab />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX');
    fireEvent.change(input, { target: { value: 'ABCD-1234-EFGH-5678' } });
    fireEvent.click(screen.getByRole('button', { name: 'license.activate' }));

    await waitFor(() => {
      expect(screen.getByText('license.activated')).toBeInTheDocument();
    });
  });

  it('成功時に購入者のメールアドレスを表示する', async () => {
    mockActivateLicense.mockResolvedValue(ACTIVATED);

    render(<LicenseTab />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
      ).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
      { target: { value: 'VALID-KEY' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'license.activate' }));

    await waitFor(() => {
      expect(screen.getByText('buyer@example.com')).toBeInTheDocument();
    });
  });

  it('送信中はボタンテキストが「認証中...」に変わる', async () => {
    let resolveActivate!: (v: tauriCommands.LicenseStatus) => void;
    mockActivateLicense.mockReturnValue(
      new Promise<tauriCommands.LicenseStatus>((r) => {
        resolveActivate = r;
      }),
    );

    render(<LicenseTab />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
      ).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
      { target: { value: 'KEY' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'license.activate' }));

    expect(screen.getByRole('button', { name: 'license.activating' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'license.activating' })).toBeDisabled();

    act(() => {
      resolveActivate(ACTIVATED);
    });
  });

  it('成功後に入力フィールドがクリアされる', async () => {
    mockActivateLicense.mockResolvedValue(ACTIVATED);

    render(<LicenseTab />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX');
    fireEvent.change(input, { target: { value: 'SOME-KEY' } });
    fireEvent.click(screen.getByRole('button', { name: 'license.activate' }));

    // 認証後はフォームが非表示になるので、input は消えている
    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
      ).not.toBeInTheDocument();
    });
  });

  it('activateLicense を正しい引数でコールする', async () => {
    mockActivateLicense.mockResolvedValue(ACTIVATED);

    render(<LicenseTab />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
      ).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
      { target: { value: '  MY-LICENSE-KEY  ' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'license.activate' }));

    await waitFor(() => {
      // trim して渡す
      expect(mockActivateLicense).toHaveBeenCalledWith('MY-LICENSE-KEY');
    });
  });
});

// =========================================================================
// 認証失敗
// =========================================================================

describe('認証失敗', () => {
  it('エラーメッセージを表示する', async () => {
    mockActivateLicense.mockRejectedValue(
      new Error('ライセンスキーが無効です。メールアドレスとキーを確認してください。'),
    );

    render(<LicenseTab />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
      ).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
      { target: { value: 'BAD-KEY' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'license.activate' }));

    await waitFor(() => {
      expect(screen.getByText(/ライセンスキーが無効/)).toBeInTheDocument();
    });
  });

  it('エラー後もフォームが表示され続ける', async () => {
    mockActivateLicense.mockRejectedValue(new Error('invalid'));

    render(<LicenseTab />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
      ).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
      { target: { value: 'BAD' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'license.activate' }));

    await waitFor(() => {
      expect(screen.getByText('invalid')).toBeInTheDocument();
    });

    // フォームはまだ表示されている
    expect(
      screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
    ).toBeInTheDocument();
  });

  it('返金済みエラーを表示する', async () => {
    mockActivateLicense.mockRejectedValue(
      new Error('このライセンスは返金または異議申し立て済みのため使用できません。'),
    );

    render(<LicenseTab />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
      ).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
      { target: { value: 'REFUNDED-KEY' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'license.activate' }));

    await waitFor(() => {
      expect(screen.getByText(/返金/)).toBeInTheDocument();
    });
  });
});

// =========================================================================
// 認証済み状態
// =========================================================================

describe('認証済み状態', () => {
  beforeEach(() => {
    mockGetLicenseStatus.mockResolvedValue(ACTIVATED);
  });

  it('認証済みバッジを表示する', async () => {
    render(<LicenseTab />);
    await waitFor(() => {
      expect(screen.getByText('license.activated')).toBeInTheDocument();
    });
  });

  it('購入者のメールアドレスを表示する', async () => {
    render(<LicenseTab />);
    await waitFor(() => {
      expect(screen.getByText('buyer@example.com')).toBeInTheDocument();
    });
  });

  it('認証日を表示する', async () => {
    render(<LicenseTab />);
    await waitFor(() => {
      // "license.activatedAt: 2023/11/15" のような形式で同一要素内に含まれる
      expect(screen.getByText(/license\.activatedAt/)).toBeInTheDocument();
    });
  });

  it('ライセンス削除ボタンを表示する', async () => {
    render(<LicenseTab />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'license.remove' })).toBeInTheDocument();
    });
  });

  it('ライセンスキー入力フォームは表示されない', async () => {
    render(<LicenseTab />);
    await waitFor(() => {
      expect(screen.getByText('license.activated')).toBeInTheDocument();
    });
    expect(
      screen.queryByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
    ).not.toBeInTheDocument();
  });
});

// =========================================================================
// ライセンス削除
// =========================================================================

describe('ライセンス削除', () => {
  beforeEach(() => {
    mockGetLicenseStatus.mockResolvedValue(ACTIVATED);
  });

  it('削除確認ダイアログを表示する', async () => {
    mockRemoveLicense.mockResolvedValue();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<LicenseTab />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'license.remove' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'license.remove' }));

    expect(confirmSpy).toHaveBeenCalledWith('license.removeConfirm');
  });

  it('確認後に removeLicense を呼ぶ', async () => {
    mockRemoveLicense.mockResolvedValue();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<LicenseTab />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'license.remove' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'license.remove' }));

    await waitFor(() => {
      expect(mockRemoveLicense).toHaveBeenCalledTimes(1);
    });
  });

  it('キャンセル時は removeLicense を呼ばない', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<LicenseTab />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'license.remove' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'license.remove' }));

    expect(mockRemoveLicense).not.toHaveBeenCalled();
  });

  it('削除成功後に未認証状態へ遷移する', async () => {
    mockRemoveLicense.mockResolvedValue();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<LicenseTab />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'license.remove' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'license.remove' }));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'),
      ).toBeInTheDocument();
    });
  });

  it('削除失敗時はエラーを表示して認証済み状態を維持する', async () => {
    mockRemoveLicense.mockRejectedValue(new Error('削除に失敗しました'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<LicenseTab />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'license.remove' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'license.remove' }));

    await waitFor(() => {
      expect(screen.getByText('削除に失敗しました')).toBeInTheDocument();
    });

    // 認証済み表示はまだ残っている
    expect(screen.getByText('license.activated')).toBeInTheDocument();
  });
});
