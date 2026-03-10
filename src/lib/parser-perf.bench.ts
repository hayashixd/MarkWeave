/**
 * パーサーパフォーマンスベンチマーク
 *
 * performance-design.md §8.5 に準拠。
 * Vitest の bench API を使用してパーサーのリグレッションを検出する。
 *
 * 実行: npx vitest bench src/lib/parser-perf.bench.ts
 */

import { bench, describe } from 'vitest';
import { markdownToTipTap } from './markdown-to-tiptap';
import { tiptapToMarkdown } from './tiptap-to-markdown';
import { IncrementalSerializer } from './incremental-serialize';

// --- テストフィクスチャ生成 ---

function generateMarkdown(lineCount: number): string {
  const blocks: string[] = [];

  for (let i = 0; i < lineCount; i++) {
    const blockType = i % 10;
    switch (blockType) {
      case 0:
        blocks.push(`## 見出し ${i}`);
        break;
      case 1:
      case 2:
      case 3:
        blocks.push(
          `これはテスト段落 ${i} です。**太字テキスト** と *斜体テキスト* を含みます。` +
            `[リンク](https://example.com) もあります。`,
        );
        break;
      case 4:
        blocks.push(`- リスト項目 ${i}\n- リスト項目 ${i + 1}\n- リスト項目 ${i + 2}`);
        break;
      case 5:
        blocks.push('```typescript\nconst x = 1;\nconsole.log(x);\n```');
        break;
      case 6:
        blocks.push(`> 引用ブロック ${i}\n> 二行目の引用`);
        break;
      case 7:
        blocks.push(`1. 番号付きリスト ${i}\n2. 番号付きリスト ${i + 1}`);
        break;
      case 8:
        blocks.push('| ヘッダ1 | ヘッダ2 |\n| --- | --- |\n| セル1 | セル2 |');
        break;
      case 9:
        blocks.push('---');
        break;
    }
  }

  return blocks.join('\n\n') + '\n';
}

const FIXTURE_100 = generateMarkdown(100);
const FIXTURE_500 = generateMarkdown(500);
const FIXTURE_1000 = generateMarkdown(1000);

// --- ベンチマーク ---

describe('markdownToTipTap', () => {
  bench('100 blocks', () => {
    markdownToTipTap(FIXTURE_100);
  });

  bench('500 blocks', () => {
    markdownToTipTap(FIXTURE_500);
  });

  bench('1000 blocks', () => {
    markdownToTipTap(FIXTURE_1000);
  });
});

describe('tiptapToMarkdown', () => {
  const DOC_100 = markdownToTipTap(FIXTURE_100);
  const DOC_500 = markdownToTipTap(FIXTURE_500);
  const DOC_1000 = markdownToTipTap(FIXTURE_1000);

  bench('100 blocks', () => {
    tiptapToMarkdown(DOC_100);
  });

  bench('500 blocks', () => {
    tiptapToMarkdown(DOC_500);
  });

  bench('1000 blocks', () => {
    tiptapToMarkdown(DOC_1000);
  });
});

describe('IncrementalSerializer (cache hit)', () => {
  const DOC_500 = markdownToTipTap(FIXTURE_500);
  const serializer = new IncrementalSerializer();
  // Prime the cache
  serializer.serialize(DOC_500);

  bench('500 blocks (all cached)', () => {
    serializer.serialize(DOC_500);
  });
});

describe('roundtrip', () => {
  bench('100 blocks (md → tiptap → md)', () => {
    const doc = markdownToTipTap(FIXTURE_100);
    tiptapToMarkdown(doc);
  });

  bench('500 blocks (md → tiptap → md)', () => {
    const doc = markdownToTipTap(FIXTURE_500);
    tiptapToMarkdown(doc);
  });
});
