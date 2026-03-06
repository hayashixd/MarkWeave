/**
 * カラーピッカーフィールドコンポーネント。
 *
 * theme-design.md §5.5 に準拠。
 * カラースウォッチ + hex テキスト入力 + ネイティブカラーピッカー。
 */

import { useState } from 'react';

interface ColorPickerFieldProps {
  label: string;
  cssVariable: string;
  value: string;
  onChange: (cssVar: string, color: string) => void;
}

function isValidColor(s: string): boolean {
  return /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/.test(s);
}

export function ColorPickerField({ label, cssVariable, value, onChange }: ColorPickerFieldProps) {
  const [draft, setDraft] = useState(value);

  const handleDraftChange = (newDraft: string) => {
    setDraft(newDraft);
    if (isValidColor(newDraft)) {
      onChange(cssVariable, newDraft);
    }
  };

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs w-32 flex-shrink-0 text-[var(--color-text-muted)]">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="w-6 h-6 rounded border border-[var(--color-border)] flex-shrink-0 cursor-pointer"
          style={{ backgroundColor: value }}
          aria-label={`${label}: ${value}`}
        />
        <input
          type="text"
          value={draft}
          maxLength={9}
          onChange={e => handleDraftChange(e.target.value)}
          onBlur={() => { if (!isValidColor(draft)) setDraft(value); }}
          className="w-20 px-1.5 py-0.5 text-xs font-mono border border-[var(--color-border)] rounded bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        />
        <input
          type="color"
          value={value.length === 7 ? value : '#000000'}
          onChange={e => { setDraft(e.target.value); onChange(cssVariable, e.target.value); }}
          className="w-6 h-6 p-0 border-0 cursor-pointer bg-transparent"
          aria-label="カラーピッカーを開く"
        />
      </div>
    </div>
  );
}
