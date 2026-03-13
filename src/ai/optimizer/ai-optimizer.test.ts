import { describe, it, expect } from 'vitest';
import { optimize, buildReport } from './ai-optimizer';

describe('ai-optimizer', () => {
  // =========================================================================
  // optimize
  // =========================================================================
  describe('optimize', () => {
    it('returns original and optimized text', () => {
      const input = '# Title\n\n* item 1\n* item 2';
      const result = optimize(input);
      expect(result.originalText).toBe(input);
      expect(result.optimizedText).toBeDefined();
    });

    it('applies list marker normalization by default', () => {
      const input = '* item 1\n* item 2';
      const result = optimize(input);
      expect(result.optimizedText).toContain('- item 1');
    });

    it('applies whitespace trimming by default', () => {
      const input = 'a\n\n\n\nb';
      const result = optimize(input);
      expect(result.optimizedText).toBe('a\n\nb');
    });

    it('records transform results', () => {
      const input = '* item\n\n\n\n\ntext';
      const result = optimize(input);
      expect(result.transforms.length).toBeGreaterThan(0);
    });

    it('calculates charDiff', () => {
      const input = 'hello';
      const result = optimize(input);
      expect(result.charDiff.before).toBe(input.length);
      expect(result.charDiff.after).toBe(result.optimizedText.length);
    });

    it('respects disabled options', () => {
      const input = '* item';
      const result = optimize(input, { normalizeListMarkers: false });
      expect(result.optimizedText).toBe('* item');
    });

    it('annotateLinks is off by default', () => {
      const input = '[Google](https://google.com)';
      const result = optimize(input);
      // annotateLinks is off, so transforms should not include it
      const linkTransform = result.transforms.find((t) => t.description.includes('URL注記'));
      expect(linkTransform).toBeUndefined();
    });

    it('includes prompt analysis', () => {
      const input = '# 役割\n\nAssistant\n\n# タスク\n\nSummarize';
      const result = optimize(input);
      expect(result.promptAnalysis).toBeDefined();
      expect(result.promptAnalysis.looksLikePrompt).toBe(true);
    });

    it('pipeline applies transforms in correct order', () => {
      // normalizeCodeFences before annotateCodeBlocks
      const input = '~~~\ndef hello():\n    pass\n~~~';
      const result = optimize(input);
      expect(result.optimizedText).toContain('```python');
      expect(result.optimizedText).not.toContain('~~~');
    });
  });

  // =========================================================================
  // buildReport
  // =========================================================================
  describe('buildReport', () => {
    it('shows "already optimized" for no changes', () => {
      const result = optimize('# Title\n\n- item');
      const report = buildReport(result);
      expect(report).toContain('最適化の必要はありません');
    });

    it('lists applied transforms', () => {
      const result = optimize('* item 1\n* item 2');
      const report = buildReport(result);
      expect(report).toContain('リスト記号');
    });

    it('includes character count summary', () => {
      const result = optimize('# Title');
      const report = buildReport(result);
      expect(report).toContain('文字');
    });

    it('warns about missing prompt sections', () => {
      const input = '# 役割\n\n...\n\n# タスク\n\n...';
      const result = optimize(input);
      if (result.promptAnalysis.looksLikePrompt && result.promptAnalysis.missing.length > 0) {
        const report = buildReport(result);
        expect(report).toContain('プロンプト構造');
      }
    });

    it('shows reduction for trimmed whitespace', () => {
      const input = 'a\n\n\n\n\nb\n\n\n\n\nc';
      const result = optimize(input);
      const report = buildReport(result);
      expect(report).toContain('文字削減');
    });
  });
});
