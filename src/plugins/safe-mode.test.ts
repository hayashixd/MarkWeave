import { describe, it, expect } from 'vitest';
import { shouldSkipPlugin } from './safe-mode';

describe('safe-mode', () => {
  describe('shouldSkipPlugin', () => {
    it('returns false when safe mode is inactive', () => {
      expect(shouldSkipPlugin('my-plugin', false)).toBe(false);
    });

    it('returns true for third-party plugins in safe mode', () => {
      expect(shouldSkipPlugin('my-plugin', true)).toBe(true);
    });

    it('returns false for builtin plugins in safe mode', () => {
      expect(shouldSkipPlugin('builtin.core-extension', true)).toBe(false);
    });

    it('returns true for custom- prefix in safe mode', () => {
      expect(shouldSkipPlugin('custom-theme', true)).toBe(true);
    });

    it('returns false for builtin. prefix in safe mode', () => {
      expect(shouldSkipPlugin('builtin.syntax', true)).toBe(false);
    });

    it('handles empty plugin id in safe mode', () => {
      expect(shouldSkipPlugin('', true)).toBe(true);
    });
  });
});
