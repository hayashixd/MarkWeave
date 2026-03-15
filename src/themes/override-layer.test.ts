import { describe, it, expect, beforeEach } from 'vitest';
import { applyOverrideVars, readCurrentOverrideVars } from './override-layer';

describe('override-layer', () => {
  beforeEach(() => {
    // Clean up the style element if it exists
    const el = document.getElementById('custom-theme-vars');
    if (el) el.remove();
  });

  describe('applyOverrideVars', () => {
    it('creates style element with CSS variables', () => {
      applyOverrideVars({ '--bg-color': '#fff', '--text-color': '#000' });
      const el = document.getElementById('custom-theme-vars');
      expect(el).not.toBeNull();
      expect(el!.textContent).toContain('--bg-color: #fff');
      expect(el!.textContent).toContain('--text-color: #000');
    });

    it('wraps variables in :root block', () => {
      applyOverrideVars({ '--test': 'red' });
      const el = document.getElementById('custom-theme-vars');
      expect(el!.textContent).toContain(':root');
    });

    it('clears content for empty vars', () => {
      applyOverrideVars({ '--test': 'red' });
      applyOverrideVars({});
      const el = document.getElementById('custom-theme-vars');
      expect(el!.textContent).toBe('');
    });

    it('reuses existing style element', () => {
      applyOverrideVars({ '--a': '1' });
      applyOverrideVars({ '--b': '2' });
      const elements = document.querySelectorAll('#custom-theme-vars');
      expect(elements).toHaveLength(1);
      expect(elements[0]!.textContent).toContain('--b');
      expect(elements[0]!.textContent).not.toContain('--a');
    });
  });

  describe('readCurrentOverrideVars', () => {
    it('returns empty object when no style element', () => {
      expect(readCurrentOverrideVars()).toEqual({});
    });

    it('reads back applied vars', () => {
      applyOverrideVars({ '--bg-color': '#fff', '--text-color': '#000' });
      const vars = readCurrentOverrideVars();
      expect(vars['--bg-color']).toBe('#fff');
      expect(vars['--text-color']).toBe('#000');
    });

    it('returns empty for cleared vars', () => {
      applyOverrideVars({ '--test': 'red' });
      applyOverrideVars({});
      expect(readCurrentOverrideVars()).toEqual({});
    });

    it('roundtrips correctly', () => {
      const original = { '--font-size': '16px', '--line-height': '1.6' };
      applyOverrideVars(original);
      expect(readCurrentOverrideVars()).toEqual(original);
    });
  });
});
