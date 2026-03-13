import { describe, it, expect } from 'vitest';
import { containsTraversalPattern } from './path-validator';

// Note: isPathWithinBase requires Tauri's resolve API which is mocked,
// so we test the synchronous containsTraversalPattern thoroughly.

describe('path-validator', () => {
  describe('containsTraversalPattern', () => {
    it('detects ../ traversal', () => {
      expect(containsTraversalPattern('../etc/passwd')).toBe(true);
    });

    it('detects ../ in middle of path', () => {
      expect(containsTraversalPattern('/home/user/../etc/passwd')).toBe(true);
    });

    it('detects backslash traversal', () => {
      expect(containsTraversalPattern('..\\windows\\system32')).toBe(true);
    });

    it('detects null byte attack', () => {
      expect(containsTraversalPattern('/home/user\0.txt')).toBe(true);
    });

    it('detects path ending with ..', () => {
      expect(containsTraversalPattern('/home/user/..')).toBe(true);
    });

    it('allows normal absolute paths', () => {
      expect(containsTraversalPattern('/home/user/documents/file.md')).toBe(false);
    });

    it('allows relative paths without traversal', () => {
      expect(containsTraversalPattern('documents/file.md')).toBe(false);
    });

    it('allows paths with dots in filenames', () => {
      expect(containsTraversalPattern('/home/user/file.backup.md')).toBe(false);
    });

    it('allows paths with single dots', () => {
      expect(containsTraversalPattern('/home/user/./file.md')).toBe(false);
    });

    it('detects multiple traversals', () => {
      expect(containsTraversalPattern('../../etc/shadow')).toBe(true);
    });

    it('handles empty string', () => {
      expect(containsTraversalPattern('')).toBe(false);
    });

    it('handles Windows-style paths with mixed slashes', () => {
      expect(containsTraversalPattern('C:\\Users\\..\\Admin')).toBe(true);
    });
  });
});
