/**
 * テーマ切り替えロジック。
 *
 * theme-design.md §4, §6 に準拠。
 * - <html data-theme="..."> 属性を変更するだけでテーマが切り替わる
 * - system モードでは OS のダーク/ライト変更を監視
 * - コードハイライトのテーマも自動切り替え
 */

/** ビルトインテーマ ID */
export type AppTheme =
  | 'light'
  | 'dark'
  | 'system'
  | 'github'
  | 'solarized-light'
  | 'solarized-dark';

/** data-theme に設定される解決済みテーマ（system は light/dark に解決される） */
export type ResolvedTheme =
  | 'light'
  | 'dark'
  | 'github'
  | 'solarized-light'
  | 'solarized-dark';

/** テーマがダーク系かどうかを判定 */
export function isDarkTheme(theme: ResolvedTheme): boolean {
  return theme === 'dark' || theme === 'solarized-dark';
}

/** ビルトインテーマ一覧 */
export const BUILTIN_THEMES: { id: AppTheme; label: string; description: string }[] = [
  { id: 'light', label: 'ライト', description: '白背景・標準配色' },
  { id: 'dark', label: 'ダーク', description: '黒背景・暗配色' },
  { id: 'system', label: 'システム', description: 'OS のダーク/ライト設定に追従' },
  { id: 'github', label: 'GitHub', description: 'GitHub Markdown 配色' },
  { id: 'solarized-light', label: 'Solarized Light', description: 'Solarized 暖色系' },
  { id: 'solarized-dark', label: 'Solarized Dark', description: 'Solarized 暗色系' },
];

class ThemeManager {
  private mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private systemChangeHandler: (() => void) | null = null;

  /**
   * テーマを初期化する。設定値に基づいて DOM にテーマを適用する。
   */
  initialize(theme: AppTheme): void {
    this.applyTheme(theme);

    if (theme === 'system') {
      this.startSystemThemeWatch();
    }
  }

  /**
   * テーマを適用する。
   * 'system' は OS の prefers-color-scheme で light/dark に解決する。
   */
  applyTheme(theme: AppTheme): void {
    // system モード監視の切り替え
    if (theme === 'system') {
      this.startSystemThemeWatch();
    } else {
      this.stopSystemThemeWatch();
    }

    const resolved = this.resolveTheme(theme);
    document.documentElement.setAttribute('data-theme', resolved);

    // Tauri のウィンドウタイトルバーのテーマを合わせる
    this.applyTauriWindowTheme(resolved);
  }

  /**
   * system テーマを解決する。
   */
  resolveTheme(theme: AppTheme): ResolvedTheme {
    if (theme === 'system') {
      return this.mediaQuery.matches ? 'dark' : 'light';
    }
    return theme as ResolvedTheme;
  }

  /**
   * 現在適用中の解決済みテーマを取得する。
   */
  getCurrentResolvedTheme(): ResolvedTheme {
    return (document.documentElement.getAttribute('data-theme') as ResolvedTheme) ?? 'light';
  }

  /**
   * system モード時: OS のダーク/ライト変更を監視する。
   */
  private startSystemThemeWatch(): void {
    if (this.systemChangeHandler) return;

    this.systemChangeHandler = () => {
      const resolved = this.mediaQuery.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', resolved);
      this.applyTauriWindowTheme(resolved);
    };

    this.mediaQuery.addEventListener('change', this.systemChangeHandler);
  }

  /**
   * system モードの監視を停止する。
   */
  private stopSystemThemeWatch(): void {
    if (this.systemChangeHandler) {
      this.mediaQuery.removeEventListener('change', this.systemChangeHandler);
      this.systemChangeHandler = null;
    }
  }

  /**
   * Tauri のウィンドウタイトルバーにテーマを適用する。
   */
  private async applyTauriWindowTheme(resolved: ResolvedTheme): Promise<void> {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.setTheme(isDarkTheme(resolved) ? 'dark' : 'light');
    } catch {
      // Tauri 外（テスト・ブラウザ開発）ではスキップ
    }
  }

  destroy(): void {
    this.stopSystemThemeWatch();
  }
}

export const themeManager = new ThemeManager();
