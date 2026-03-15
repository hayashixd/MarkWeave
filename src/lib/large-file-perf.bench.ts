/**
 * 大容量ファイルパフォーマンスベンチマーク
 *
 * performance-design.md §1.1, §8.5 に準拠。
 * Vitest の bench API を使用して大規模ドキュメントの各処理段階を計測する。
 *
 * 実行: npx vitest bench src/lib/large-file-perf.bench.ts
 *
 * 計測対象:
 *   - markdownToTipTap: パース速度（3000 / 5000 / 10000 ブロック）
 *   - tiptapToMarkdown: シリアライズ速度（同上）
 *   - ラウンドトリップ: 往復変換速度
 *   - IncrementalSerializer: キャッシュ効率（0% / 1% / 5% 変更）
 *   - コンテンツ種別別: テーブル多用 / コードブロック多用 / 日本語テキスト
 */

import { bench, describe } from 'vitest';
import { markdownToTipTap } from './markdown-to-tiptap';
import { tiptapToMarkdown } from './tiptap-to-markdown';
import { IncrementalSerializer } from './incremental-serialize';

// ---------------------------------------------------------------------------
// フィクスチャ生成ユーティリティ
// ---------------------------------------------------------------------------

/** 混合コンテンツ（見出し・段落・リスト・コードブロック・テーブル・引用） */
function generateMixedMarkdown(blockCount: number): string {
  const blocks: string[] = [];

  for (let i = 0; i < blockCount; i++) {
    const blockType = i % 10;
    switch (blockType) {
      case 0:
        blocks.push(`## セクション ${Math.floor(i / 10) + 1} - 見出し ${i}`);
        break;
      case 1:
      case 2:
      case 3:
        blocks.push(
          `これはテスト段落 ${i} です。**太字テキスト** と *斜体テキスト* を含みます。` +
            `[リンク](https://example.com/path/${i}) もあります。` +
            `インライン\`コード\`や~~取り消し線~~も含まれます。`,
        );
        break;
      case 4:
        blocks.push(
          `- リスト項目 A-${i}\n- リスト項目 B-${i}\n- リスト項目 C-${i}\n  - ネスト項目 ${i}`,
        );
        break;
      case 5:
        blocks.push(
          `\`\`\`typescript\n// コードブロック ${i}\nconst value${i} = ${i} * 2;\nconsole.log(\`result: \${value${i}}\`);\n\`\`\``,
        );
        break;
      case 6:
        blocks.push(`> 引用ブロック ${i}\n> 二行目の引用\n> \n> **強調された引用** テキスト`);
        break;
      case 7:
        blocks.push(
          `1. 番号付きリスト ${i}\n2. 番号付きリスト ${i + 1}\n3. 番号付きリスト ${i + 2}`,
        );
        break;
      case 8:
        blocks.push(
          `| ヘッダ1 | ヘッダ2 | ヘッダ3 |\n| --- | --- | --- |\n| セル${i}-1 | セル${i}-2 | セル${i}-3 |\n| セル${i}-4 | セル${i}-5 | セル${i}-6 |`,
        );
        break;
      case 9:
        blocks.push('---');
        break;
    }
  }

  return blocks.join('\n\n') + '\n';
}

/** テーブル多用コンテンツ（100テーブル × 10行） */
function generateTableHeavyMarkdown(tableCount: number, rowsPerTable: number): string {
  const blocks: string[] = [];

  for (let t = 0; t < tableCount; t++) {
    const headerRow = `| ID | 名前 | 値 | 説明 |`;
    const separator = `| --- | --- | --- | --- |`;
    const rows = [headerRow, separator];
    for (let r = 0; r < rowsPerTable; r++) {
      rows.push(`| ${t * rowsPerTable + r} | アイテム ${r} | ${r * 1.5} | テーブル ${t} の行 ${r} |`);
    }
    blocks.push(`## テーブル ${t + 1}\n\n${rows.join('\n')}`);
  }

  return blocks.join('\n\n') + '\n';
}

/** コードブロック多用コンテンツ */
function generateCodeHeavyMarkdown(blockCount: number): string {
  const blocks: string[] = [];
  const langs = ['typescript', 'rust', 'python', 'javascript', 'go', 'bash'];

  for (let i = 0; i < blockCount; i++) {
    const lang = langs[i % langs.length]!;
    if (i % 3 === 0) {
      blocks.push(`## コード例 ${i}`);
    }
    blocks.push(
      `\`\`\`${lang}\n` +
        `// サンプル ${i}\n` +
        `function process_${i}(input: string): string {\n` +
        `  const result = input.trim().toLowerCase();\n` +
        `  return result.replace(/\\s+/g, '_');\n` +
        `}\n` +
        `\`\`\``,
    );
  }

  return blocks.join('\n\n') + '\n';
}

/** 日本語（CJK）テキスト多用コンテンツ */
function generateCjkMarkdown(blockCount: number): string {
  const blocks: string[] = [];
  const sentences = [
    'これは日本語のテキストです。パフォーマンスを計測するためのサンプルです。',
    '仮想スクロール機能により、大量のコンテンツを効率的に表示できます。',
    'Markdown エディタは WYSIWYG 形式で動作し、直感的な編集が可能です。',
    'テキストのレンダリングには TipTap と ProseMirror を使用しています。',
    '日本語は全角文字が多いため、英語と比べて行あたりの文字数が少なくなります。',
  ];

  for (let i = 0; i < blockCount; i++) {
    if (i % 5 === 0) {
      blocks.push(`## 第${Math.floor(i / 5) + 1}章 - セクション ${i}`);
    } else {
      const sentence = sentences[i % sentences.length]!;
      blocks.push(`${sentence.repeat(3)} [参照](https://example.com/${i})`);
    }
  }

  return blocks.join('\n\n') + '\n';
}

/** 長い段落コンテンツ（1段落あたり200〜300単語） */
function generateLongParagraphMarkdown(paragraphCount: number): string {
  const longText =
    'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
    'Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ' +
    'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. ';
  const blocks: string[] = [];

  for (let i = 0; i < paragraphCount; i++) {
    if (i % 10 === 0) {
      blocks.push(`## Section ${Math.floor(i / 10) + 1}`);
    }
    // 各段落に約300単語のテキストを生成
    blocks.push(longText.repeat(3).trim() + ` (paragraph ${i})`);
  }

  return blocks.join('\n\n') + '\n';
}

// ---------------------------------------------------------------------------
// フィクスチャを事前生成（ベンチ実行前に一度だけ）
// ---------------------------------------------------------------------------

console.log('[bench] フィクスチャを生成中...');
const t0 = Date.now();

const FIXTURE_3000 = generateMixedMarkdown(3000);
const FIXTURE_5000 = generateMixedMarkdown(5000);
const FIXTURE_10000 = generateMixedMarkdown(10000);
const FIXTURE_TABLE_100x10 = generateTableHeavyMarkdown(100, 10);
const FIXTURE_CODE_500 = generateCodeHeavyMarkdown(500);
const FIXTURE_CJK_2000 = generateCjkMarkdown(2000);
const FIXTURE_LONG_PARA_500 = generateLongParagraphMarkdown(500);

// パース済みドキュメント（serializer ベンチ用）
const DOC_3000 = markdownToTipTap(FIXTURE_3000);
const DOC_5000 = markdownToTipTap(FIXTURE_5000);
const DOC_10000 = markdownToTipTap(FIXTURE_10000);
const DOC_TABLE = markdownToTipTap(FIXTURE_TABLE_100x10);
const DOC_CODE = markdownToTipTap(FIXTURE_CODE_500);
const DOC_CJK = markdownToTipTap(FIXTURE_CJK_2000);

console.log(`[bench] フィクスチャ生成完了 (${Date.now() - t0}ms)`);
console.log(`[bench] ファイルサイズ:`);
console.log(`  FIXTURE_3000: ${(FIXTURE_3000.length / 1024).toFixed(1)} KB`);
console.log(`  FIXTURE_5000: ${(FIXTURE_5000.length / 1024).toFixed(1)} KB`);
console.log(`  FIXTURE_10000: ${(FIXTURE_10000.length / 1024).toFixed(1)} KB`);
console.log(`  FIXTURE_TABLE_100x10: ${(FIXTURE_TABLE_100x10.length / 1024).toFixed(1)} KB`);

// ---------------------------------------------------------------------------
// markdownToTipTap ベンチマーク
// ---------------------------------------------------------------------------

describe('markdownToTipTap - 大容量ファイル', () => {
  bench('3,000 ブロック（混合コンテンツ）', () => {
    markdownToTipTap(FIXTURE_3000);
  });

  bench('5,000 ブロック（混合コンテンツ）', () => {
    markdownToTipTap(FIXTURE_5000);
  });

  bench('10,000 ブロック（混合コンテンツ）', () => {
    markdownToTipTap(FIXTURE_10000);
  });
});

describe('markdownToTipTap - コンテンツ種別別', () => {
  bench('テーブル多用（100テーブル × 10行）', () => {
    markdownToTipTap(FIXTURE_TABLE_100x10);
  });

  bench('コードブロック多用（500ブロック）', () => {
    markdownToTipTap(FIXTURE_CODE_500);
  });

  bench('日本語テキスト（2,000ブロック）', () => {
    markdownToTipTap(FIXTURE_CJK_2000);
  });

  bench('長い段落（500段落）', () => {
    markdownToTipTap(FIXTURE_LONG_PARA_500);
  });
});

// ---------------------------------------------------------------------------
// tiptapToMarkdown ベンチマーク
// ---------------------------------------------------------------------------

describe('tiptapToMarkdown - 大容量ファイル', () => {
  bench('3,000 ブロック（混合コンテンツ）', () => {
    tiptapToMarkdown(DOC_3000);
  });

  bench('5,000 ブロック（混合コンテンツ）', () => {
    tiptapToMarkdown(DOC_5000);
  });

  bench('10,000 ブロック（混合コンテンツ）', () => {
    tiptapToMarkdown(DOC_10000);
  });
});

describe('tiptapToMarkdown - コンテンツ種別別', () => {
  bench('テーブル多用（100テーブル × 10行）', () => {
    tiptapToMarkdown(DOC_TABLE);
  });

  bench('コードブロック多用（500ブロック）', () => {
    tiptapToMarkdown(DOC_CODE);
  });

  bench('日本語テキスト（2,000ブロック）', () => {
    tiptapToMarkdown(DOC_CJK);
  });
});

// ---------------------------------------------------------------------------
// ラウンドトリップ（MD → TipTap → MD）
// ---------------------------------------------------------------------------

describe('ラウンドトリップ - 大容量ファイル', () => {
  bench('3,000 ブロック', () => {
    const doc = markdownToTipTap(FIXTURE_3000);
    tiptapToMarkdown(doc);
  });

  bench('5,000 ブロック', () => {
    const doc = markdownToTipTap(FIXTURE_5000);
    tiptapToMarkdown(doc);
  });
});

// ---------------------------------------------------------------------------
// IncrementalSerializer ベンチマーク
// ---------------------------------------------------------------------------

describe('IncrementalSerializer - キャッシュ効率', () => {
  // 全キャッシュヒット（変更なし）
  const serializer_allCached_3000 = new IncrementalSerializer();
  serializer_allCached_3000.serialize(DOC_3000); // ウォームアップ

  bench('3,000 ブロック（全キャッシュヒット）', () => {
    serializer_allCached_3000.serialize(DOC_3000);
  });

  const serializer_allCached_5000 = new IncrementalSerializer();
  serializer_allCached_5000.serialize(DOC_5000);

  bench('5,000 ブロック（全キャッシュヒット）', () => {
    serializer_allCached_5000.serialize(DOC_5000);
  });
});

describe('IncrementalSerializer - 部分変更シミュレーション', () => {
  /**
   * 部分変更シミュレーション:
   * 最後の N% のブロックを変更済みとして新しいドキュメントを作る
   */
  function withLastBlocksModified(doc: typeof DOC_3000, changeRatio: number): typeof DOC_3000 {
    const blocks = [...(doc.content ?? [])];
    const changeCount = Math.max(1, Math.floor(blocks.length * changeRatio));
    const modified = blocks.map((block, i) => {
      if (i >= blocks.length - changeCount) {
        // テキストコンテンツを少し変更（フィンガープリントが変わる）
        return {
          ...block,
          content: block.content?.map((child) =>
            child.text !== undefined ? { ...child, text: child.text + ' ✎' } : child,
          ),
        };
      }
      return block;
    });
    return { ...doc, content: modified };
  }

  const DOC_3000_1pct = withLastBlocksModified(DOC_3000, 0.01);  // 1% 変更（30ブロック）
  const DOC_3000_5pct = withLastBlocksModified(DOC_3000, 0.05);  // 5% 変更（150ブロック）
  const DOC_3000_20pct = withLastBlocksModified(DOC_3000, 0.2);  // 20% 変更（600ブロック）
  const DOC_5000_1pct = withLastBlocksModified(DOC_5000, 0.01);  // 1% 変更（50ブロック）

  // 1% 変更（典型的な1キー入力シナリオ）
  {
    const s = new IncrementalSerializer();
    s.serialize(DOC_3000);
    bench('3,000 ブロック（1% 変更）', () => {
      s.serialize(DOC_3000_1pct);
      s.serialize(DOC_3000); // 交互に変更して毎回キャッシュミスを発生させる
    });
  }

  // 5% 変更
  {
    const s = new IncrementalSerializer();
    s.serialize(DOC_3000);
    bench('3,000 ブロック（5% 変更）', () => {
      s.serialize(DOC_3000_5pct);
      s.serialize(DOC_3000);
    });
  }

  // 20% 変更（大規模編集シナリオ）
  {
    const s = new IncrementalSerializer();
    s.serialize(DOC_3000);
    bench('3,000 ブロック（20% 変更）', () => {
      s.serialize(DOC_3000_20pct);
      s.serialize(DOC_3000);
    });
  }

  // 5,000 ブロック 1% 変更
  {
    const s = new IncrementalSerializer();
    s.serialize(DOC_5000);
    bench('5,000 ブロック（1% 変更）', () => {
      s.serialize(DOC_5000_1pct);
      s.serialize(DOC_5000);
    });
  }
});

// ---------------------------------------------------------------------------
// IncrementalSerializer vs 全文シリアライズ 比較
// ---------------------------------------------------------------------------

describe('IncrementalSerializer vs tiptapToMarkdown 比較', () => {
  const DOC_3000_modified = (() => {
    const blocks = [...(DOC_3000.content ?? [])];
    // 最後の1ブロックだけ変更（最も典型的なケース）
    const last = blocks[blocks.length - 1]!;
    const modified = {
      ...last,
      content: last.content?.map((c) =>
        c.text !== undefined ? { ...c, text: c.text + ' x' } : c,
      ),
    };
    return { ...DOC_3000, content: [...blocks.slice(0, -1), modified] };
  })();

  const serializer = new IncrementalSerializer();
  serializer.serialize(DOC_3000);

  bench('全文シリアライズ（3,000 ブロック）', () => {
    tiptapToMarkdown(DOC_3000_modified);
  });

  bench('インクリメンタル（3,000 ブロック・1ブロック変更）', () => {
    serializer.serialize(DOC_3000_modified);
    serializer.serialize(DOC_3000);
  });
});
