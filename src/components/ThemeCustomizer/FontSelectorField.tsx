/**
 * フォントセレクタフィールドコンポーネント。
 *
 * theme-design.md §5.6 に準拠。
 * よく使われるフォント候補 + カスタム入力。
 */

import React from 'react';

const COMMON_FONTS = [
  { value: '', label: 'テーマデフォルト' },
  { value: '"Noto Sans JP", sans-serif', label: 'Noto Sans JP' },
  { value: '"Hiragino Sans", sans-serif', label: 'ヒラギノ角ゴ（macOS）' },
  { value: '"Yu Gothic UI", sans-serif', label: '游ゴシック UI（Windows）' },
  { value: '"Meiryo UI", sans-serif', label: 'メイリオ UI（Windows）' },
  { value: 'Georgia, serif', label: 'Georgia（英語）' },
  { value: '"Courier New", monospace', label: 'Courier New（等幅）' },
];

interface FontSelectorFieldProps {
  label: string;
  cssVariable: string;
  value: string;
  onChange: (cssVar: string, font: string) => void;
}

export function FontSelectorField({ label, cssVariable, value, onChange }: FontSelectorFieldProps) {
  const isCustom = value !== '' && !COMMON_FONTS.some(f => f.value === value);

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs w-32 flex-shrink-0 text-[var(--color-text-muted)]">{label}</span>
      <div className="flex flex-col gap-1 flex-1">
        <select
          value={isCustom ? '__custom__' : value}
          onChange={e => {
            if (e.target.value !== '__custom__') onChange(cssVariable, e.target.value);
          }}
          className="px-1.5 py-0.5 text-xs border border-[var(--color-border)] rounded bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        >
          {COMMON_FONTS.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
          <option value="__custom__">カスタム…</option>
        </select>
        {isCustom && (
          <input
            type="text"
            value={value}
            placeholder='"Font Name", fallback-family'
            onChange={e => onChange(cssVariable, e.target.value)}
            className="px-1.5 py-0.5 text-xs border border-[var(--color-border)] rounded bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        )}
        <span
          className="text-xs truncate text-[var(--color-text-subtle)]"
          style={{ fontFamily: value || 'inherit' }}
        >
          The quick brown fox. 日本語テキスト。
        </span>
      </div>
    </div>
  );
}
