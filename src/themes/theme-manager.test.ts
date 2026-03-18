/**
 * theme-manager.ts のユニットテスト
 *
 * - isDarkTheme: 純粋関数
 * - BUILTIN_THEMES: 定数の構造検証
 * - ThemeManager: resolveTheme, applyTheme, getCurrentResolvedTheme
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isDarkTheme,
  BUILTIN_THEMES,
  themeManager,
  type AppTheme,
  type ResolvedTheme,
} from './theme-manager';

// ─── isDarkTheme ─────────────────────────────────────────────────────────────

describe('isDarkTheme', () => {
  it.each<[ResolvedTheme, boolean]>([
    ['dark', true],
    ['solarized-dark', true],
    ['light', false],
    ['github', false],
    ['solarized-light', false],
  ])('isDarkTheme(%s) === %s', (theme, expected) => {
    expect(isDarkTheme(theme)).toBe(expected);
  });
});

// ─── BUILTIN_THEMES ──────────────────────────────────────────────────────────

describe('BUILTIN_THEMES', () => {
  it('6種類のテーマが定義されている', () => {
    expect(BUILTIN_THEMES).toHaveLength(6);
  });

  it('各テーマに id, label, description が存在する', () => {
    for (const theme of BUILTIN_THEMES) {
      expect(theme.id).toBeTruthy();
      expect(theme.label).toBeTruthy();
      expect(theme.description).toBeTruthy();
    }
  });

  it('system テーマが含まれている', () => {
    const ids = BUILTIN_THEMES.map((t) => t.id);
    expect(ids).toContain('system');
  });

  it('id の重複がない', () => {
    const ids = BUILTIN_THEMES.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  const expectedIds: AppTheme[] = [
    'light',
    'dark',
    'system',
    'github',
    'solarized-light',
    'solarized-dark',
  ];
  it.each(expectedIds)('テーマ "%s" が定義されている', (id) => {
    expect(BUILTIN_THEMES.find((t) => t.id === id)).toBeDefined();
  });
});

// ─── themeManager.resolveTheme ───────────────────────────────────────────────

describe('themeManager.resolveTheme', () => {
  // setup.ts が window.matchMedia を matches=false でモックしている
  it('system テーマは matchMedia=false のとき light に解決される', () => {
    expect(themeManager.resolveTheme('system')).toBe('light');
  });

  it.each<[AppTheme, ResolvedTheme]>([
    ['light', 'light'],
    ['dark', 'dark'],
    ['github', 'github'],
    ['solarized-light', 'solarized-light'],
    ['solarized-dark', 'solarized-dark'],
  ])('resolveTheme(%s) === %s', (input, expected) => {
    expect(themeManager.resolveTheme(input)).toBe(expected);
  });
});

// ─── themeManager.applyTheme / getCurrentResolvedTheme ──────────────────────

describe('themeManager.applyTheme & getCurrentResolvedTheme', () => {
  beforeEach(() => {
    // 各テストで data-theme をリセット
    document.documentElement.removeAttribute('data-theme');
  });

  it('applyTheme("light") で data-theme="light" が設定される', () => {
    themeManager.applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('applyTheme("dark") で data-theme="dark" が設定される', () => {
    themeManager.applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('applyTheme("github") で data-theme="github" が設定される', () => {
    themeManager.applyTheme('github');
    expect(document.documentElement.getAttribute('data-theme')).toBe('github');
  });

  it('applyTheme("solarized-light") で data-theme="solarized-light" が設定される', () => {
    themeManager.applyTheme('solarized-light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('solarized-light');
  });

  it('applyTheme("solarized-dark") で data-theme="solarized-dark" が設定される', () => {
    themeManager.applyTheme('solarized-dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('solarized-dark');
  });

  it('applyTheme("system") は matchMedia=false のとき data-theme="light" にする', () => {
    themeManager.applyTheme('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('getCurrentResolvedTheme は data-theme 属性を返す', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(themeManager.getCurrentResolvedTheme()).toBe('dark');
  });

  it('data-theme がない場合は light を返す', () => {
    expect(themeManager.getCurrentResolvedTheme()).toBe('light');
  });
});

// ─── themeManager.initialize ────────────────────────────────────────────────

describe('themeManager.initialize', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    themeManager.destroy(); // 監視をクリア
  });

  it('initialize でテーマが DOM に適用される', () => {
    themeManager.initialize('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('initialize("github") で github テーマが適用される', () => {
    themeManager.initialize('github');
    expect(document.documentElement.getAttribute('data-theme')).toBe('github');
  });

  it('initialize("system") でクラッシュしない', () => {
    expect(() => themeManager.initialize('system')).not.toThrow();
  });
});

// ─── themeManager.destroy ───────────────────────────────────────────────────

describe('themeManager.destroy', () => {
  it('destroy を複数回呼んでもクラッシュしない', () => {
    expect(() => {
      themeManager.destroy();
      themeManager.destroy();
    }).not.toThrow();
  });
});
