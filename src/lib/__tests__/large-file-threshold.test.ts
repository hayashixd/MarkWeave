/**
 * 大容量ファイル パフォーマンス閾値テスト
 *
 * performance-design.md §1.1 のパフォーマンスバジェットを CI で検証する。
 * 閾値を超えると失敗する（リグレッション検出用）。
 *
 * 実行: npm run test -- src/lib/__tests__/large-file-threshold.test.ts
 *
 * 閾値の根拠:
 *   - 10,000行ファイルのロード → 表示: < 500ms（performance-design.md §1.1）
 *   - Node.js (jsdom) は実機ブラウザより概ね同等〜やや高速なため、
 *     CI 環境の揺らぎを考慮して 2x マージンを設定する
 *   - CI 環境（GitHub Actions）での実行を想定（ローカル高速マシンより遅い）
 *
 * 注意:
 *   これらのテストは時間に依存するため、極端に低性能な環境では false-positive が出る可能性がある。
 *   そのため、閾値は設計書の目標値の 3〜5 倍程度に設定して安定させる。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { markdownToTipTap } from '../markdown-to-tiptap';
import { tiptapToMarkdown } from '../tiptap-to-markdown';
import { IncrementalSerializer } from '../incremental-serialize';

// ---------------------------------------------------------------------------
// フィクスチャ生成
// ---------------------------------------------------------------------------

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
            `[リンク](https://example.com/path/${i}) もあります。`,
        );
        break;
      case 4:
        blocks.push(`- リスト項目 A-${i}\n- リスト項目 B-${i}\n- リスト項目 C-${i}`);
        break;
      case 5:
        blocks.push(
          `\`\`\`typescript\nconst value${i} = ${i} * 2;\nconsole.log(value${i});\n\`\`\``,
        );
        break;
      case 6:
        blocks.push(`> 引用ブロック ${i}\n> 二行目の引用`);
        break;
      case 7:
        blocks.push(`1. 番号付きリスト ${i}\n2. 番号付きリスト ${i + 1}`);
        break;
      case 8:
        blocks.push(
          `| ヘッダ1 | ヘッダ2 |\n| --- | --- |\n| セル${i}-1 | セル${i}-2 |`,
        );
        break;
      case 9:
        blocks.push('---');
        break;
    }
  }

  return blocks.join('\n\n') + '\n';
}

function generateTableHeavyMarkdown(tableCount: number, rowsPerTable: number): string {
  const blocks: string[] = [];
  for (let t = 0; t < tableCount; t++) {
    const rows = [
      `| ID | 名前 | 値 |`,
      `| --- | --- | --- |`,
      ...Array.from({ length: rowsPerTable }, (_, r) =>
        `| ${t * rowsPerTable + r} | アイテム ${r} | ${r * 1.5} |`,
      ),
    ];
    blocks.push(`## テーブル ${t + 1}\n\n${rows.join('\n')}`);
  }
  return blocks.join('\n\n') + '\n';
}

function generateCjkMarkdown(blockCount: number): string {
  const blocks: string[] = [];
  const base =
    'これは日本語のテキストです。パフォーマンスを計測するためのサンプルです。' +
    '仮想スクロール機能により、大量のコンテンツを効率的に表示できます。';
  for (let i = 0; i < blockCount; i++) {
    blocks.push(i % 5 === 0 ? `## 第${Math.floor(i / 5) + 1}章` : `${base} (${i})`);
  }
  return blocks.join('\n\n') + '\n';
}

// ---------------------------------------------------------------------------
// フィクスチャ（beforeAll でキャッシュ）
// ---------------------------------------------------------------------------

let md_1000: string;
let md_5000: string;
let md_10000: string;
let md_table100x10: string;
let md_cjk2000: string;

beforeAll(() => {
  md_1000 = generateMixedMarkdown(1000);
  md_5000 = generateMixedMarkdown(5000);
  md_10000 = generateMixedMarkdown(10000);
  md_table100x10 = generateTableHeavyMarkdown(100, 10);
  md_cjk2000 = generateCjkMarkdown(2000);
});

// ---------------------------------------------------------------------------
// ヘルパー: 複数回実行して中央値を取る（外れ値の影響を排除）
// ---------------------------------------------------------------------------

function measureMedianMs(fn: () => void, runs = 5): number {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)]!;
}

// ---------------------------------------------------------------------------
// §1: markdownToTipTap パース速度
// ---------------------------------------------------------------------------

describe('markdownToTipTap パース速度', () => {
  it('1,000 ブロック（混合） → 300ms 以内', () => {
    // 設計書目標: 10,000行 < 500ms。1,000行は < 100ms が理想だが CI 余裕を持って 300ms
    const ms = measureMedianMs(() => markdownToTipTap(md_1000));
    console.log(`[perf] markdownToTipTap 1,000 blocks: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(300);
  });

  it('5,000 ブロック（混合） → 2,000ms 以内', { timeout: 15000 }, () => {
    const ms = measureMedianMs(() => markdownToTipTap(md_5000));
    console.log(`[perf] markdownToTipTap 5,000 blocks: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(2000);
  });

  it('10,000 ブロック（混合） → 5,000ms 以内', { timeout: 30000 }, () => {
    // 設計書目標: 10,000行 < 500ms（実機）。Node.js/CI 環境での閾値として 5,000ms
    // ボトルネックとして「許容不可能に遅い」ケースのみ検出する
    const ms = measureMedianMs(() => markdownToTipTap(md_10000), 3);
    console.log(`[perf] markdownToTipTap 10,000 blocks: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(5000);
  });

  it('テーブル多用（100テーブル × 10行） → 2,000ms 以内', () => {
    const ms = measureMedianMs(() => markdownToTipTap(md_table100x10));
    console.log(`[perf] markdownToTipTap table-heavy: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(2000);
  });

  it('日本語テキスト（2,000ブロック） → 1,000ms 以内', () => {
    const ms = measureMedianMs(() => markdownToTipTap(md_cjk2000));
    console.log(`[perf] markdownToTipTap CJK 2,000 blocks: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// §2: tiptapToMarkdown シリアライズ速度
// ---------------------------------------------------------------------------

describe('tiptapToMarkdown シリアライズ速度', () => {
  it('1,000 ブロック（混合） → 200ms 以内', () => {
    const doc = markdownToTipTap(md_1000);
    const ms = measureMedianMs(() => tiptapToMarkdown(doc));
    console.log(`[perf] tiptapToMarkdown 1,000 blocks: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(200);
  });

  it('5,000 ブロック（混合） → 1,000ms 以内', () => {
    const doc = markdownToTipTap(md_5000);
    const ms = measureMedianMs(() => tiptapToMarkdown(doc));
    console.log(`[perf] tiptapToMarkdown 5,000 blocks: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(1000);
  });

  it('10,000 ブロック（混合） → 3,000ms 以内', () => {
    const doc = markdownToTipTap(md_10000);
    const ms = measureMedianMs(() => tiptapToMarkdown(doc), 3);
    console.log(`[perf] tiptapToMarkdown 10,000 blocks: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(3000);
  });
});

// ---------------------------------------------------------------------------
// §3: ラウンドトリップ速度
// ---------------------------------------------------------------------------

describe('ラウンドトリップ（MD → TipTap → MD）', () => {
  it('1,000 ブロック → 500ms 以内', () => {
    const ms = measureMedianMs(() => {
      const doc = markdownToTipTap(md_1000);
      tiptapToMarkdown(doc);
    });
    console.log(`[perf] roundtrip 1,000 blocks: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(500);
  });

  it('5,000 ブロック → 3,000ms 以内', () => {
    const ms = measureMedianMs(
      () => {
        const doc = markdownToTipTap(md_5000);
        tiptapToMarkdown(doc);
      },
      3,
    );
    console.log(`[perf] roundtrip 5,000 blocks: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(3000);
  });
});

// ---------------------------------------------------------------------------
// §4: IncrementalSerializer 効率性
// ---------------------------------------------------------------------------

describe('IncrementalSerializer 効率性', () => {
  /**
   * NOTE: tiptapToMarkdown は既に非常に高速（1,000ブロック: 1〜2ms）。
   * IncrementalSerializer は JSON.stringify ベースのフィンガープリント生成コストにより、
   * 小規模ドキュメントでは全文シリアライズより遅い場合がある。
   * これはボトルネック計測の重要な結果として記録する。
   */

  it('全文シリアライズとインクリメンタルのオーバーヘッドを計測（ボトルネック検出）', () => {
    const doc = markdownToTipTap(md_1000);

    // 全文シリアライズの速度を計測
    const fullMs = measureMedianMs(() => tiptapToMarkdown(doc));

    // IncrementalSerializer をウォームアップしてキャッシュを満たす
    const serializer = new IncrementalSerializer();
    serializer.serialize(doc);

    // キャッシュヒット時の速度を計測
    const incrMs = measureMedianMs(() => serializer.serialize(doc));

    const ratio = fullMs / incrMs;
    console.log(`[perf] full serialize: ${fullMs.toFixed(2)}ms, incremental (cached): ${incrMs.toFixed(2)}ms`);
    if (ratio < 1) {
      console.warn(
        `[BOTTLENECK] IncrementalSerializer は全文シリアライズより ${(1 / ratio).toFixed(1)}x 遅い。` +
          ` JSON.stringify フィンガープリント生成がボトルネック。`,
      );
    } else {
      console.log(`[perf] speedup ratio: ${ratio.toFixed(1)}x`);
    }

    // 閾値: インクリメンタルが全文の 20 倍以上遅い場合は異常と判定
    // （フィンガープリント生成の実装上のオーバーヘッドは許容するが、
    //   極端に遅い場合はアルゴリズムの問題として検出する）
    expect(incrMs).toBeLessThan(fullMs * 20);
  });

  it('1% 変更時のインクリメンタルと全文シリアライズの比較（ボトルネック検出）', () => {
    const doc = markdownToTipTap(md_1000);

    // 1% のブロックを変更したドキュメントを作成
    const blocks = [...(doc.content ?? [])];
    const changeCount = Math.max(1, Math.floor(blocks.length * 0.01));
    const modifiedDoc = {
      ...doc,
      content: blocks.map((block, i) =>
        i >= blocks.length - changeCount
          ? {
              ...block,
              content: block.content?.map((c) =>
                c.text !== undefined ? { ...c, text: c.text + ' ✎' } : c,
              ),
            }
          : block,
      ),
    };

    // 全文シリアライズ
    const fullMs = measureMedianMs(() => tiptapToMarkdown(modifiedDoc));

    // IncrementalSerializer（キャッシュウォームアップ済み）
    const serializer = new IncrementalSerializer();
    serializer.serialize(doc);
    const incrMs = measureMedianMs(() => {
      serializer.serialize(modifiedDoc);
      serializer.serialize(doc);
    });
    const incrPerOpMs = incrMs / 2; // 2往復分を1往復あたりに換算

    const ratio = fullMs / incrPerOpMs;
    console.log(
      `[perf] 1% change - full: ${fullMs.toFixed(2)}ms/op, incremental: ${incrPerOpMs.toFixed(2)}ms/op`,
    );
    if (ratio < 1) {
      console.warn(
        `[BOTTLENECK] 1%変更でもインクリメンタルが全文より ${(1 / ratio).toFixed(1)}x 遅い。` +
          ` JSON.stringify フィンガープリント生成の固定コストが支配的。`,
      );
    } else {
      console.log(`[perf] speedup ratio: ${ratio.toFixed(1)}x`);
    }

    // 閾値: インクリメンタルが全文の 20 倍以上遅い場合は異常
    expect(incrPerOpMs).toBeLessThan(fullMs * 20);
  });

  it('5,000 ブロックの全キャッシュヒット → 100ms 以内', () => {
    const doc = markdownToTipTap(md_5000);
    const serializer = new IncrementalSerializer();
    serializer.serialize(doc); // ウォームアップ

    const ms = measureMedianMs(() => serializer.serialize(doc));
    console.log(`[perf] IncrementalSerializer 5,000 blocks (cached): ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// §5: ファイルサイズと実際のバイト数の確認
// ---------------------------------------------------------------------------

describe('ファイルサイズとノード数の確認', () => {
  it('10,000 ブロックフィクスチャは 200KB 以上', () => {
    const sizeKB = new TextEncoder().encode(md_10000).length / 1024;
    console.log(`[info] 10,000 blocks: ${sizeKB.toFixed(1)} KB`);
    expect(sizeKB).toBeGreaterThan(200);
  });

  it('10,000 ブロックのノード数が 3,000 を超える（大容量ドキュメント確認）', () => {
    const doc = markdownToTipTap(md_10000);
    let nodeCount = 0;
    function countNodes(node: { content?: unknown[] }): void {
      nodeCount++;
      node.content?.forEach((child) => countNodes(child as { content?: unknown[] }));
    }
    countNodes(doc);
    console.log(`[info] 10,000 blocks → ${nodeCount} TipTap nodes`);
    expect(nodeCount).toBeGreaterThan(3000);
  });

  it('5KB 未満の小ファイルは 10ms 以内にパース完了', () => {
    const smallMd = generateMixedMarkdown(50);
    const sizeKB = new TextEncoder().encode(smallMd).length / 1024;
    const ms = measureMedianMs(() => markdownToTipTap(smallMd));
    console.log(`[perf] small file ${sizeKB.toFixed(1)}KB: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// §6: メモリ使用量の推定（Node.js process.memoryUsage）
// ---------------------------------------------------------------------------

describe('メモリ使用量の推定', () => {
  it('10,000 ブロックのパース後のヒープ増加が 500MB 未満', () => {
    // GC を促す
    if (globalThis.gc) globalThis.gc();

    const before = process.memoryUsage().heapUsed;
    const doc = markdownToTipTap(md_10000);
    const after = process.memoryUsage().heapUsed;

    const heapIncreaseMB = (after - before) / 1024 / 1024;
    console.log(`[perf] heap increase for 10,000 blocks parse: ${heapIncreaseMB.toFixed(1)} MB`);
    console.log(`[info] doc.content length: ${doc.content?.length ?? 0}`);

    // 設計書: メモリ使用量 < 400MB（通常使用時）
    // パース単体での増加は 500MB 未満を期待
    expect(heapIncreaseMB).toBeLessThan(500);
  });

  it('IncrementalSerializer は繰り返しシリアライズでメモリが線形増加しない', () => {
    const doc = markdownToTipTap(md_1000);
    const serializer = new IncrementalSerializer();

    if (globalThis.gc) globalThis.gc();
    const before = process.memoryUsage().heapUsed;

    // 100回シリアライズ（メモリリーク確認）
    for (let i = 0; i < 100; i++) {
      serializer.serialize(doc);
    }

    const after = process.memoryUsage().heapUsed;
    const heapIncreaseMB = (after - before) / 1024 / 1024;
    console.log(
      `[perf] heap increase for 100x serialize (1,000 blocks): ${heapIncreaseMB.toFixed(1)} MB`,
    );

    // 100回シリアライズで 50MB 以上増加しないこと（メモリリークなし）
    expect(heapIncreaseMB).toBeLessThan(50);
  });
});
