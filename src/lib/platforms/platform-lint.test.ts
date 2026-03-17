import { describe, it, expect } from 'vitest';
import { lintPlatformBody } from './platform-lint';

describe('lintPlatformBody', () => {
  it('generic プラットフォームでは常に空配列を返す', () => {
    const body = ':::message\nHello\n:::\n@[youtube](abc)\n';
    expect(lintPlatformBody(body, 'generic')).toEqual([]);
  });

  it('zenn プラットフォームでは問題なしの本文は空配列を返す', () => {
    const body = '# Title\n\nParagraph with **bold** text.\n\n:::message\nOK\n:::\n';
    expect(lintPlatformBody(body, 'zenn')).toEqual([]);
  });

  describe('qiita プラットフォーム', () => {
    it(':::message ブロックを警告する', () => {
      const issues = lintPlatformBody(':::message\nHello\n:::\n', 'qiita');
      expect(issues).toHaveLength(1);
      expect(issues[0]!.severity).toBe('warning');
      expect(issues[0]!.message).toContain(':::message');
    });

    it(':::message alert ブロックを警告する', () => {
      const issues = lintPlatformBody(':::message alert\nWarning\n:::\n', 'qiita');
      expect(issues).toHaveLength(1);
      expect(issues[0]!.message).toContain(':::message');
    });

    it(':::details ブロックを警告する', () => {
      const issues = lintPlatformBody(':::details タイトル\n内容\n:::\n', 'qiita');
      expect(issues).toHaveLength(1);
      expect(issues[0]!.message).toContain(':::details');
    });

    it('@[youtube] 埋め込みを警告する', () => {
      const issues = lintPlatformBody('@[youtube](dQw4w9WgXcQ)\n', 'qiita');
      expect(issues).toHaveLength(1);
      expect(issues[0]!.message).toContain('@[youtube]');
    });

    it('@[tweet] 埋め込みを警告する', () => {
      const issues = lintPlatformBody('@[tweet](https://twitter.com/user/status/123)\n', 'qiita');
      expect(issues).toHaveLength(1);
      expect(issues[0]!.message).toContain('@[tweet]');
    });

    it('@[speakerdeck] 埋め込みを警告する', () => {
      const issues = lintPlatformBody('@[speakerdeck](abc123)\n', 'qiita');
      expect(issues).toHaveLength(1);
      expect(issues[0]!.message).toContain('@[speakerdeck]');
    });

    it('@[codesandbox] 埋め込みを警告する', () => {
      const issues = lintPlatformBody('@[codesandbox](https://codesandbox.io/embed/abc)\n', 'qiita');
      expect(issues).toHaveLength(1);
      expect(issues[0]!.message).toContain('@[codesandbox]');
    });

    it('Mermaid コードブロックを警告する', () => {
      const issues = lintPlatformBody('```mermaid\ngraph TD;\n```\n', 'qiita');
      expect(issues).toHaveLength(1);
      expect(issues[0]!.message).toContain('Mermaid');
    });

    it('脚注を info として通知する', () => {
      const issues = lintPlatformBody('本文[^1]\n\n[^1]: 説明\n', 'qiita');
      expect(issues.some((i) => i.severity === 'info')).toBe(true);
      expect(issues.some((i) => i.message.includes('脚注'))).toBe(true);
    });

    it('複数の問題を同時に検出する', () => {
      const body = ':::message\nHello\n:::\n\n@[youtube](abc)\n\n```mermaid\ngraph\n```\n';
      const issues = lintPlatformBody(body, 'qiita');
      expect(issues.length).toBeGreaterThanOrEqual(3);
    });

    it('問題のない Qiita 向け本文は空配列を返す', () => {
      const body = '# Title\n\nParagraph.\n\n```typescript\nconst x = 1;\n```\n';
      expect(lintPlatformBody(body, 'qiita')).toEqual([]);
    });

    it('複数の Mermaid ブロックがあっても警告は 1 件だけ返す', () => {
      const body = [
        '```mermaid',
        'graph TD; A-->B',
        '```',
        '',
        '```mermaid',
        'sequenceDiagram',
        'Alice->>Bob: Hi',
        '```',
        '',
      ].join('\n');
      const issues = lintPlatformBody(body, 'qiita');
      const mermaidIssues = issues.filter((i) => i.message.includes('Mermaid'));
      expect(mermaidIssues).toHaveLength(1);
    });

    it('大文字の ```MERMAID は Mermaid 警告の検出対象にならない（大文字小文字区別）', () => {
      // 現在の正規表現 /^```mermaid\b/m は大文字を区別するため MERMAID は非検出
      const body = '```MERMAID\ngraph TD; A-->B\n```\n';
      const issues = lintPlatformBody(body, 'qiita');
      const mermaidIssues = issues.filter((i) => i.message.includes('Mermaid'));
      expect(mermaidIssues).toHaveLength(0);
    });

    it('```mermaid の後ろにスペースが続いても検出される', () => {
      const body = '```mermaid \ngraph TD; A-->B\n```\n';
      const issues = lintPlatformBody(body, 'qiita');
      const mermaidIssues = issues.filter((i) => i.message.includes('Mermaid'));
      expect(mermaidIssues).toHaveLength(1);
    });
  });

  describe('zenn プラットフォーム + Mermaid', () => {
    it('Zenn では Mermaid ブロックがあっても警告なし', () => {
      const body = '```mermaid\ngraph TD;\n  A-->B;\n```\n';
      expect(lintPlatformBody(body, 'zenn')).toEqual([]);
    });

    it('Zenn では複数の Mermaid ブロックがあっても警告なし', () => {
      const body = [
        '```mermaid',
        'graph TD; A-->B',
        '```',
        '',
        '```mermaid',
        'sequenceDiagram',
        'Alice->>Bob: Hi',
        '```',
        '',
      ].join('\n');
      expect(lintPlatformBody(body, 'zenn')).toEqual([]);
    });
  });
});
