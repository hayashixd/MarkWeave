import { describe, it, expect } from 'vitest';
import { buildPrompt } from './prompt-builder';
import { BUILTIN_TEMPLATES } from './templates/builtin';
import type { PromptBuildContext, ReferenceFile } from './types';

// ── ヘルパー ──────────────────────────────────────────────────────────────────

const proofread = BUILTIN_TEMPLATES.find((t) => t.id === 'builtin-proofread')!;

function baseCtx(overrides: Partial<PromptBuildContext> = {}): PromptBuildContext {
  return {
    template: proofread,
    document: 'ドキュメント本文',
    references: [],
    activeConstraints: proofread.constraints.map(() => false),
    ...overrides,
  };
}

function makeRef(name: string, content: string): ReferenceFile {
  return { path: `/refs/${name}`, name, content, estimatedTokens: 10 };
}

// ── system プロンプト ──────────────────────────────────────────────────────────

describe('buildPrompt – system', () => {
  it('persona がシステムプロンプトの先頭に含まれる', () => {
    const { system } = buildPrompt(baseCtx());
    expect(system).toContain(proofread.persona);
  });

  it('参考資料なしのとき reference タグが含まれない', () => {
    const { system } = buildPrompt(baseCtx({ references: [] }));
    expect(system).not.toContain('<reference');
    expect(system).not.toContain('参考資料');
  });

  it('参考資料があるとき reference タグと内容が含まれる', () => {
    const refs = [makeRef('guide.md', '参考内容')];
    const { system } = buildPrompt(baseCtx({ references: refs }));
    expect(system).toContain('<reference name="guide.md">');
    expect(system).toContain('参考内容');
    expect(system).toContain('</reference>');
  });

  it('参考資料が複数あるとき全て含まれる', () => {
    const refs = [makeRef('a.md', 'コンテンツA'), makeRef('b.md', 'コンテンツB')];
    const { system } = buildPrompt(baseCtx({ references: refs }));
    expect(system).toContain('<reference name="a.md">');
    expect(system).toContain('<reference name="b.md">');
  });

  it('有効化した制約だけが ## 制約 セクションに含まれる', () => {
    const constraints = [true, false, true, false];
    const { system } = buildPrompt(baseCtx({ activeConstraints: constraints }));
    expect(system).toContain(`- ${proofread.constraints[0]!.text}`);
    expect(system).not.toContain(`- ${proofread.constraints[1]!.text}`);
    expect(system).toContain(`- ${proofread.constraints[2]!.text}`);
    expect(system).not.toContain(`- ${proofread.constraints[3]!.text}`);
  });

  it('全制約が無効なとき ## 制約 セクションが生成されない', () => {
    const { system } = buildPrompt(
      baseCtx({ activeConstraints: proofread.constraints.map(() => false) }),
    );
    expect(system).not.toContain('## 制約');
  });

  it('outputFormat が ## 出力形式 セクションとして含まれる', () => {
    const { system } = buildPrompt(baseCtx());
    expect(system).toContain('## 出力形式');
    expect(system).toContain(proofread.outputFormat);
  });
});

// ── user プロンプト ────────────────────────────────────────────────────────────

describe('buildPrompt – user', () => {
  it('document が <document> タグに含まれる', () => {
    const { user } = buildPrompt(baseCtx({ document: 'テスト本文' }));
    expect(user).toContain('<document>\nテスト本文\n</document>');
  });

  it('selection があるとき <selection> タグが含まれる', () => {
    const { user } = buildPrompt(baseCtx({ selection: '選択テキスト' }));
    expect(user).toContain('<selection>\n選択テキスト\n</selection>');
  });

  it('selection がないとき <selection> タグが含まれない', () => {
    const { user } = buildPrompt(baseCtx({ selection: undefined }));
    expect(user).not.toContain('<selection>');
  });

  it('selection が空文字のとき <selection> タグが含まれない', () => {
    // 空文字は falsy なので selection タグを出力しない
    const { user } = buildPrompt(baseCtx({ selection: '' }));
    expect(user).not.toContain('<selection>');
  });

  it('template.task が <instruction> タグに含まれる', () => {
    const { user } = buildPrompt(baseCtx());
    expect(user).toContain('<instruction>');
    expect(user).toContain(proofread.task);
  });

  it('userInstruction があるとき "追加の指示:" が含まれる', () => {
    const { user } = buildPrompt(baseCtx({ userInstruction: '簡潔にして' }));
    expect(user).toContain('追加の指示: 簡潔にして');
  });

  it('userInstruction がないとき "追加の指示:" が含まれない', () => {
    const { user } = buildPrompt(baseCtx({ userInstruction: undefined }));
    expect(user).not.toContain('追加の指示:');
  });

  it('userInstruction が空白のみのとき "追加の指示:" が含まれない', () => {
    const { user } = buildPrompt(baseCtx({ userInstruction: '   ' }));
    expect(user).not.toContain('追加の指示:');
  });

  it('userInstruction の前後の空白がトリムされる', () => {
    const { user } = buildPrompt(baseCtx({ userInstruction: '  指示  ' }));
    expect(user).toContain('追加の指示: 指示');
    expect(user).not.toContain('追加の指示:   指示  ');
  });
});

// ── estimatedInputTokens ──────────────────────────────────────────────────────

describe('buildPrompt – estimatedInputTokens', () => {
  it('正の整数を返す', () => {
    const { estimatedInputTokens } = buildPrompt(baseCtx());
    expect(estimatedInputTokens).toBeGreaterThan(0);
    expect(Number.isInteger(estimatedInputTokens)).toBe(true);
  });

  it('参考資料を追加するとトークン数が増加する', () => {
    const without = buildPrompt(baseCtx({ references: [] }));
    const with1Ref = buildPrompt(
      baseCtx({ references: [makeRef('ref.md', 'あいうえお'.repeat(100))] }),
    );
    expect(with1Ref.estimatedInputTokens).toBeGreaterThan(without.estimatedInputTokens);
  });

  it('長いドキュメントはトークン数が大きくなる', () => {
    const short = buildPrompt(baseCtx({ document: 'short' }));
    const long = buildPrompt(baseCtx({ document: 'long'.repeat(1000) }));
    expect(long.estimatedInputTokens).toBeGreaterThan(short.estimatedInputTokens);
  });
});
