import { describe, it, expect } from 'vitest';
import {
  buildMarkdownWithFrontMatter,
  convertZennBodyToQiita,
  convertZennToQiitaMarkdown,
  validateBeforeCopy,
} from './platform-copy';

describe('buildMarkdownWithFrontMatter', () => {
  it('YAML と本文を --- で結合する', () => {
    const yaml = 'title: "Test"\npublished: false';
    const body = '# Hello\n\nWorld';
    const result = buildMarkdownWithFrontMatter(yaml, body);
    expect(result).toBe('---\ntitle: "Test"\npublished: false\n---\n\n# Hello\n\nWorld');
  });

  it('YAML が空文字列のときは本文のみを返す', () => {
    expect(buildMarkdownWithFrontMatter('', 'body')).toBe('body');
  });

  it('YAML が空白のみのときは本文のみを返す', () => {
    expect(buildMarkdownWithFrontMatter('   ', 'body')).toBe('body');
  });
});

describe('convertZennBodyToQiita', () => {
  it(':::message ブロックの記法を除去して内容を保持する', () => {
    const body = ':::message\nこれは注意書きです。\n:::\n';
    const result = convertZennBodyToQiita(body);
    expect(result).toContain('これは注意書きです。');
    expect(result).not.toContain(':::message');
    expect(result).not.toContain(':::');
  });

  it(':::message alert ブロックの記法を除去して内容を保持する', () => {
    const body = ':::message alert\n警告メッセージ\n:::\n';
    const result = convertZennBodyToQiita(body);
    expect(result).toContain('警告メッセージ');
    expect(result).not.toContain(':::message alert');
    expect(result).not.toContain(':::');
  });

  it(':::details ブロックの記法を除去して内容を保持する', () => {
    const body = ':::details 詳細を見る\n詳細な内容\n:::\n';
    const result = convertZennBodyToQiita(body);
    expect(result).toContain('詳細な内容');
    expect(result).not.toContain(':::details');
    expect(result).not.toContain(':::');
  });

  it('@[youtube] 埋め込みを除去する', () => {
    const body = '前のパラグラフ\n@[youtube](dQw4w9WgXcQ)\n後のパラグラフ\n';
    const result = convertZennBodyToQiita(body);
    expect(result).not.toContain('@[youtube]');
    expect(result).toContain('前のパラグラフ');
    expect(result).toContain('後のパラグラフ');
  });

  it('@[tweet] 埋め込みを除去する', () => {
    const body = '@[tweet](https://twitter.com/user/status/123)\n';
    const result = convertZennBodyToQiita(body);
    expect(result).not.toContain('@[tweet]');
  });

  it('@[speakerdeck] 埋め込みを除去する', () => {
    const body = '@[speakerdeck](abc123)\n';
    const result = convertZennBodyToQiita(body);
    expect(result).not.toContain('@[speakerdeck]');
  });

  it('@[codesandbox] 埋め込みを除去する', () => {
    const body = '@[codesandbox](https://codesandbox.io/embed/abc)\n';
    const result = convertZennBodyToQiita(body);
    expect(result).not.toContain('@[codesandbox]');
  });

  it('複数の Zenn 固有記法を同時に変換する', () => {
    const body =
      '# タイトル\n\n:::message\n注意\n:::\n\n@[youtube](abc)\n\n本文\n';
    const result = convertZennBodyToQiita(body);
    expect(result).toContain('# タイトル');
    expect(result).toContain('注意');
    expect(result).toContain('本文');
    expect(result).not.toContain(':::message');
    expect(result).not.toContain('@[youtube]');
  });

  it('Zenn 固有記法がない場合は変更しない', () => {
    const body = '# タイトル\n\nParagraph.\n\n```typescript\nconst x = 1;\n```\n';
    expect(convertZennBodyToQiita(body)).toBe(body);
  });

  it('Mermaid コードブロックを HTML コメントに置換する', () => {
    const body = '前の段落\n\n```mermaid\ngraph TD;\n  A-->B;\n```\n\n後の段落\n';
    const result = convertZennBodyToQiita(body);
    expect(result).not.toContain('```mermaid');
    expect(result).toContain('<!-- [Mermaid図: Qiitaでは非対応のため変換時に省略] -->');
    expect(result).toContain('前の段落');
    expect(result).toContain('後の段落');
  });

  it('複数の Mermaid ブロックを個別に置換する', () => {
    const body = '```mermaid\ngraph TD; A-->B\n```\n\n```mermaid\nsequenceDiagram\n```\n';
    const result = convertZennBodyToQiita(body);
    expect(result).not.toContain('```mermaid');
    const commentCount = (result.match(/<!-- \[Mermaid図/g) ?? []).length;
    expect(commentCount).toBe(2);
  });

  it('通常のコードブロックは変更しない', () => {
    const body = '```typescript\nconst x = 1;\n```\n';
    expect(convertZennBodyToQiita(body)).toBe(body);
  });

  it('複数行の :::message 本文を正しく保持する', () => {
    const body = ':::message\n1行目\n2行目\n3行目\n:::\n';
    const result = convertZennBodyToQiita(body);
    expect(result).toContain('1行目');
    expect(result).toContain('2行目');
    expect(result).toContain('3行目');
    expect(result).not.toContain(':::message');
  });
});

describe('convertZennToQiitaMarkdown', () => {
  it('topics を tags に変換する', () => {
    const yaml =
      'title: "テスト記事"\nemoji: "📝"\ntype: "tech"\ntopics: ["typescript", "react"]\npublished: false';
    const body = '# Hello';
    const result = convertZennToQiitaMarkdown(yaml, body);
    expect(result).toContain('title: "テスト記事"');
    expect(result).toContain('- name: typescript');
    expect(result).toContain('- name: react');
    expect(result).not.toContain('topics:');
    expect(result).not.toContain('emoji:');
  });

  it('本文の Zenn 固有記法も変換する', () => {
    const yaml =
      'title: "記事"\nemoji: "📝"\ntype: "tech"\ntopics: []\npublished: false';
    const body = ':::message\n注意\n:::\n\n本文\n';
    const result = convertZennToQiitaMarkdown(yaml, body);
    expect(result).toContain('注意');
    expect(result).not.toContain(':::message');
  });

  it('完全な Markdown（Front Matter + 本文）を返す', () => {
    const yaml =
      'title: "テスト"\nemoji: "🔧"\ntype: "tech"\ntopics: ["node"]\npublished: false';
    const body = '本文です。';
    const result = convertZennToQiitaMarkdown(yaml, body);
    expect(result.startsWith('---\n')).toBe(true);
    expect(result).toContain('---\n\n本文です。');
  });

  it('topics が 5 件を超える場合は最初の 5 件のみ使用する', () => {
    const yaml =
      'title: "test"\nemoji: "📝"\ntype: "tech"\ntopics: ["a","b","c","d","e","f"]\npublished: false';
    const body = '';
    const result = convertZennToQiitaMarkdown(yaml, body);
    const tagMatches = result.match(/- name:/g);
    expect(tagMatches?.length).toBeLessThanOrEqual(5);
  });

  it('Mermaid ブロックを含む本文も変換する', () => {
    const yaml =
      'title: "テスト"\nemoji: "📝"\ntype: "tech"\ntopics: ["a"]\npublished: false';
    const body = '```mermaid\ngraph TD; A-->B\n```\n\n本文\n';
    const result = convertZennToQiitaMarkdown(yaml, body);
    expect(result).not.toContain('```mermaid');
    expect(result).toContain('<!-- [Mermaid図');
    expect(result).toContain('本文');
  });

  it('private フィールドが false で出力される', () => {
    const yaml =
      'title: "公開記事"\nemoji: "📝"\ntype: "tech"\ntopics: []\npublished: true';
    const body = '本文';
    const result = convertZennToQiitaMarkdown(yaml, body);
    expect(result).toContain('private: false');
  });
});

describe('validateBeforeCopy', () => {
  describe('zenn', () => {
    it('タイトルが空のときエラーメッセージを返す', () => {
      const yaml = 'title: ""\nemoji: "📝"\ntype: "tech"\ntopics: ["a"]\npublished: false';
      expect(validateBeforeCopy('zenn', yaml)).toContain('タイトル');
    });

    it('トピックが0件のときエラーメッセージを返す', () => {
      const yaml = 'title: "テスト"\nemoji: "📝"\ntype: "tech"\ntopics: []\npublished: false';
      expect(validateBeforeCopy('zenn', yaml)).toContain('トピック');
    });

    it('タイトルとトピックが揃っているとき null を返す', () => {
      const yaml = 'title: "テスト"\nemoji: "📝"\ntype: "tech"\ntopics: ["a"]\npublished: false';
      expect(validateBeforeCopy('zenn', yaml)).toBeNull();
    });
  });

  describe('qiita', () => {
    it('タイトルが空のときエラーメッセージを返す', () => {
      const yaml = 'title: ""\ntags:\n  - name: TypeScript\nprivate: false';
      expect(validateBeforeCopy('qiita', yaml)).toContain('タイトル');
    });

    it('タグが0件のときエラーメッセージを返す', () => {
      const yaml = 'title: "テスト"\ntags: []\nprivate: false';
      expect(validateBeforeCopy('qiita', yaml)).toContain('タグ');
    });

    it('タイトルとタグが揃っているとき null を返す', () => {
      const yaml = 'title: "テスト"\ntags:\n  - name: TypeScript\nprivate: false';
      expect(validateBeforeCopy('qiita', yaml)).toBeNull();
    });
  });
});
