import { describe, it, expect } from 'vitest';
import { lintMarkdown } from './markdown-lint';

describe('markdown-lint', () => {
  // =========================================================================
  // Clean documents
  // =========================================================================
  it('returns no issues for well-formed markdown', () => {
    const md = `# Title

## Section

Some paragraph text.

- item 1
- item 2

\`\`\`javascript
const x = 1;
\`\`\`
`;
    const result = lintMarkdown(md);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it('returns zero counts for empty text', () => {
    const result = lintMarkdown('');
    expect(result.issues).toHaveLength(0);
  });

  // =========================================================================
  // MD001: Heading level skip
  // =========================================================================
  describe('MD001 – heading level skip', () => {
    it('detects H1 → H3 skip', () => {
      const result = lintMarkdown('# Title\n\n### Subsection');
      const md001 = result.issues.filter((i) => i.ruleId === 'MD001');
      expect(md001.length).toBe(1);
      expect(md001[0]!.severity).toBe('warning');
    });

    it('does not flag sequential headings', () => {
      const result = lintMarkdown('# Title\n\n## Section\n\n### Subsection');
      const md001 = result.issues.filter((i) => i.ruleId === 'MD001');
      expect(md001).toHaveLength(0);
    });

    it('detects H2 → H4 skip', () => {
      const result = lintMarkdown('## Section\n\n#### Deep');
      expect(result.issues.some((i) => i.ruleId === 'MD001')).toBe(true);
    });

    it('allows H1 → H2 → H4 (only flags H2→H4)', () => {
      const result = lintMarkdown('# Title\n\n## Section\n\n#### Deep');
      const md001 = result.issues.filter((i) => i.ruleId === 'MD001');
      expect(md001).toHaveLength(1);
    });
  });

  // =========================================================================
  // MD003: Heading style consistency
  // =========================================================================
  describe('MD003 – heading style consistency', () => {
    it('flags mixed ATX and Setext headings', () => {
      const md = '# ATX Heading\n\nSetext Heading\n===\n';
      const result = lintMarkdown(md);
      expect(result.issues.some((i) => i.ruleId === 'MD003')).toBe(true);
    });

    it('does not flag pure ATX', () => {
      const md = '# Title\n\n## Section\n';
      const result = lintMarkdown(md);
      expect(result.issues.some((i) => i.ruleId === 'MD003')).toBe(false);
    });
  });

  // =========================================================================
  // MD009: Trailing whitespace
  // =========================================================================
  describe('MD009 – trailing whitespace', () => {
    it('detects single trailing space', () => {
      const md = 'hello \nworld';
      const result = lintMarkdown(md);
      expect(result.issues.some((i) => i.ruleId === 'MD009')).toBe(true);
    });

    it('allows 2-space hard break', () => {
      const md = 'hello  \nworld';
      const result = lintMarkdown(md);
      const md009 = result.issues.filter((i) => i.ruleId === 'MD009');
      expect(md009).toHaveLength(0);
    });

    it('flags 3+ trailing spaces', () => {
      const md = 'hello   \nworld';
      const result = lintMarkdown(md);
      expect(result.issues.some((i) => i.ruleId === 'MD009')).toBe(true);
    });

    it('ignores trailing whitespace in code blocks', () => {
      const md = '```\nhello   \n```';
      const result = lintMarkdown(md);
      const md009 = result.issues.filter((i) => i.ruleId === 'MD009');
      expect(md009).toHaveLength(0);
    });
  });

  // =========================================================================
  // MD012: Consecutive blank lines
  // =========================================================================
  describe('MD012 – consecutive blank lines', () => {
    it('flags 3+ consecutive blank lines', () => {
      const md = 'a\n\n\n\nb';
      const result = lintMarkdown(md);
      expect(result.issues.some((i) => i.ruleId === 'MD012')).toBe(true);
    });

    it('allows 2 consecutive blank lines', () => {
      const md = 'a\n\n\nb';
      const result = lintMarkdown(md);
      const md012 = result.issues.filter((i) => i.ruleId === 'MD012');
      expect(md012).toHaveLength(0);
    });

    it('reports multiple occurrences', () => {
      const md = 'a\n\n\n\n\nb'; // 4 blank lines
      const result = lintMarkdown(md);
      const md012 = result.issues.filter((i) => i.ruleId === 'MD012');
      expect(md012.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // MD032: List marker consistency
  // =========================================================================
  describe('MD032 – list marker consistency', () => {
    it('flags mixed list markers', () => {
      const md = '- item\n* item\n+ item';
      const result = lintMarkdown(md);
      expect(result.issues.some((i) => i.ruleId === 'MD032')).toBe(true);
    });

    it('does not flag consistent markers', () => {
      const md = '- item 1\n- item 2\n- item 3';
      const result = lintMarkdown(md);
      expect(result.issues.some((i) => i.ruleId === 'MD032')).toBe(false);
    });

    it('ignores list markers in code blocks', () => {
      const md = '- outside\n```\n* in code\n```';
      const result = lintMarkdown(md);
      const md032 = result.issues.filter((i) => i.ruleId === 'MD032');
      expect(md032).toHaveLength(0);
    });
  });

  // =========================================================================
  // MD040: Fenced code block language
  // =========================================================================
  describe('MD040 – fenced code block language', () => {
    it('flags code blocks without language', () => {
      const md = '```\nconst x = 1;\n```';
      const result = lintMarkdown(md);
      expect(result.issues.some((i) => i.ruleId === 'MD040')).toBe(true);
    });

    it('does not flag code blocks with language', () => {
      const md = '```javascript\nconst x = 1;\n```';
      const result = lintMarkdown(md);
      expect(result.issues.some((i) => i.ruleId === 'MD040')).toBe(false);
    });
  });

  // =========================================================================
  // LINK001: Broken internal links
  // =========================================================================
  describe('LINK001 – broken internal links', () => {
    it('flags broken anchor links', () => {
      const md = '# Title\n\n[link](#nonexistent)';
      const result = lintMarkdown(md);
      expect(result.issues.some((i) => i.ruleId === 'LINK001')).toBe(true);
    });

    it('does not flag valid anchor links', () => {
      const md = '# My Section\n\n[link](#my-section)';
      const result = lintMarkdown(md);
      const link001 = result.issues.filter((i) => i.ruleId === 'LINK001');
      expect(link001).toHaveLength(0);
    });
  });

  // =========================================================================
  // IMG001: Missing image alt text
  // =========================================================================
  describe('IMG001 – missing image alt text', () => {
    it('flags images without alt text', () => {
      const md = '![](image.png)';
      const result = lintMarkdown(md);
      expect(result.issues.some((i) => i.ruleId === 'IMG001')).toBe(true);
    });

    it('does not flag images with alt text', () => {
      const md = '![description](image.png)';
      const result = lintMarkdown(md);
      expect(result.issues.some((i) => i.ruleId === 'IMG001')).toBe(false);
    });
  });

  // =========================================================================
  // Result aggregation
  // =========================================================================
  describe('result aggregation', () => {
    it('issues are sorted by line number', () => {
      const md = '![](img.png)\n\n\n\n\n\n# Title\n\n### Skip';
      const result = lintMarkdown(md);
      for (let i = 1; i < result.issues.length; i++) {
        expect(result.issues[i]!.line).toBeGreaterThanOrEqual(result.issues[i - 1]!.line);
      }
    });

    it('counts match issue array', () => {
      const md = '# Title\n\n### Skip\n\n![](img.png)\n\n- a\n* b';
      const result = lintMarkdown(md);
      expect(result.errorCount).toBe(result.issues.filter((i) => i.severity === 'error').length);
      expect(result.warningCount).toBe(result.issues.filter((i) => i.severity === 'warning').length);
      expect(result.infoCount).toBe(result.issues.filter((i) => i.severity === 'info').length);
    });
  });
});
