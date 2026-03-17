#!/usr/bin/env node
/**
 * manual-refresh.mjs
 *
 * マニュアル用スクリーンショット・GIF を一括再撮影し、HTML を再生成するスクリプト。
 *
 * 実行: pnpm manual:refresh
 *
 * ステップ:
 *   1. e2e/manual-capture/ を全実行 → docs/manual-screenshots/ 以下を上書き
 *   2. e2e/demo-capture/   を全実行 → doc-public/demo-gifs/    以下を上書き
 *   3. docs/generate-manual.cjs    → doc-public/manuals/user-manual-full.html 再生成
 *   4. docs/generate-use-cases.cjs → doc-public/use-cases.html 再生成
 *
 * オプション:
 *   --skip-screenshots   ステップ1をスキップ
 *   --skip-gifs          ステップ2をスキップ
 *   --skip-generate      ステップ3・4をスキップ
 *   --continue-on-error  Playwright が失敗しても生成ステップまで続行
 */

import { execSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const { values: opts } = parseArgs({
  options: {
    'skip-screenshots':  { type: 'boolean', default: false },
    'skip-gifs':         { type: 'boolean', default: false },
    'skip-generate':     { type: 'boolean', default: false },
    'continue-on-error': { type: 'boolean', default: false },
  },
  strict: false,
});

const failures = [];

function run(label, cmd) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶ ${label}`);
  console.log(`  ${cmd}`);
  console.log('─'.repeat(60));
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✓ ${label}`);
  } catch {
    failures.push(label);
    const msg = `✗ FAILED: ${label}`;
    console.error(msg);
    if (!opts['continue-on-error']) {
      console.error('\nAborted. Use --continue-on-error to proceed past failures.');
      process.exit(1);
    }
  }
}

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║         MarkWeave マニュアル 一括リフレッシュ            ║');
console.log('╚══════════════════════════════════════════════════════════╝');

// ── Step 1: スクリーンショット再撮影 ────────────────────────────────
if (!opts['skip-screenshots']) {
  run(
    'スクリーンショット再撮影 (e2e/manual-capture/)',
    'pnpm playwright test --project=manual-capture',
  );
} else {
  console.log('\n⏭ スクリーンショット撮影をスキップ (--skip-screenshots)');
}

// ── Step 2: GIF 再撮影 ───────────────────────────────────────────────
if (!opts['skip-gifs']) {
  run(
    'デモ GIF 再撮影 (e2e/demo-capture/)',
    'pnpm playwright test --project=demo-chromium',
  );
} else {
  console.log('\n⏭ GIF 撮影をスキップ (--skip-gifs)');
}

// ── Step 3 & 4: HTML 再生成 ─────────────────────────────────────────
if (!opts['skip-generate']) {
  run(
    'マニュアル HTML 再生成',
    'node docs/generate-manual.cjs',
  );
  run(
    '活用事例 HTML 再生成',
    'node docs/generate-use-cases.cjs',
  );
} else {
  console.log('\n⏭ HTML 生成をスキップ (--skip-generate)');
}

// ── 最終結果 ────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
if (failures.length === 0) {
  console.log('✅ マニュアルリフレッシュ完了');
} else {
  console.error(`❌ ${failures.length} ステップが失敗しました:`);
  for (const f of failures) console.error(`   - ${f}`);
  process.exit(1);
}
