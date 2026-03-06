/**
 * テーマカスタマイザー全体コンポーネント。
 *
 * theme-design.md §5.9 に準拠。
 * カスタマイズ対象の CSS 変数グループごとに
 * カラーピッカー・フォントセレクタを表示する。
 */

import { useThemeCustomizerStore } from '../../store/themeCustomizerStore';
import { ColorPickerField } from './ColorPickerField';
import { FontSelectorField } from './FontSelectorField';

/** カスタマイズ対象のカラー変数 */
const COLOR_VARS = [
  { label: '背景色', cssVar: '--color-bg' },
  { label: 'テキスト色', cssVar: '--color-text' },
  { label: 'アクセントカラー', cssVar: '--color-accent' },
  { label: 'ボーダー色', cssVar: '--color-border' },
  { label: 'コードブロック背景', cssVar: '--preview-code-bg' },
  { label: '引用ボーダー', cssVar: '--preview-blockquote-border' },
];

/** カスタマイズ対象のフォント変数 */
const FONT_VARS = [
  { label: '本文フォント', cssVar: '--font-sans' },
  { label: 'コードフォント', cssVar: '--font-mono' },
];

function getComputedVar(cssVar: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
}

export function ThemeCustomizer() {
  const { overrideVars, setVar, resetAll, saveCustomTheme, customThemeName } =
    useThemeCustomizerStore();

  return (
    <div className="space-y-4 mt-4 p-4 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)]">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 px-2 py-1 text-sm border border-[var(--color-border)] rounded bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          value={customThemeName}
          onChange={e => useThemeCustomizerStore.setState({ customThemeName: e.target.value })}
          placeholder="テーマ名"
        />
        <button
          type="button"
          onClick={resetAll}
          className="px-3 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]"
        >
          リセット
        </button>
        <button
          type="button"
          onClick={saveCustomTheme}
          className="px-3 py-1 text-xs bg-[var(--color-accent)] text-white rounded hover:opacity-90"
        >
          保存
        </button>
      </div>

      <section>
        <h4 className="text-xs font-semibold mb-1 text-[var(--color-text-muted)] uppercase tracking-wider">カラー</h4>
        {COLOR_VARS.map(({ label, cssVar }) => (
          <ColorPickerField
            key={cssVar}
            label={label}
            cssVariable={cssVar}
            value={overrideVars[cssVar] ?? getComputedVar(cssVar) ?? '#000000'}
            onChange={setVar}
          />
        ))}
      </section>

      <section>
        <h4 className="text-xs font-semibold mb-1 text-[var(--color-text-muted)] uppercase tracking-wider">フォント</h4>
        {FONT_VARS.map(({ label, cssVar }) => (
          <FontSelectorField
            key={cssVar}
            label={label}
            cssVariable={cssVar}
            value={overrideVars[cssVar] ?? ''}
            onChange={setVar}
          />
        ))}
      </section>

      <section>
        <h4 className="text-xs font-semibold mb-1 text-[var(--color-text-muted)] uppercase tracking-wider">プレビュー</h4>
        <div className="p-4 rounded border border-[var(--color-border)] bg-[var(--color-bg)]">
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--preview-heading-color, var(--color-text))' }}>
            見出し1
          </h2>
          <p className="text-sm mb-2" style={{ color: 'var(--color-text)' }}>
            本文テキスト。<strong>太字</strong>と<em>斜体</em>を含む。
          </p>
          <code
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: 'var(--preview-inline-code-bg)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--preview-code-text, var(--color-text))',
            }}
          >
            インラインコード
          </code>
          <blockquote
            className="mt-2 pl-3 text-sm italic"
            style={{
              borderLeft: '3px solid var(--preview-blockquote-border)',
              color: 'var(--preview-blockquote-text)',
            }}
          >
            引用ブロックのサンプルテキスト。
          </blockquote>
        </div>
      </section>
    </div>
  );
}
