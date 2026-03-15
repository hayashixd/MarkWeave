/**
 * デモ GIF 撮影: AI 向けに清書してコピー機能
 *
 * 伝えたいこと:
 *   「見出し階層の飛び・リスト記号のバラつきを、1クリックで自動修正してコピーできる」
 *
 * ビフォー/アフターの流れ:
 *   Frame 1: H1 → H3（H2 スキップ）が含まれるエディタ（Before）
 *   Frame 2: 差分プレビューモーダル — ### → ## の修正が赤/緑で見える
 *   Frame 3: 「コピー済み ✓ (1件修正)」— 清書完了
 *
 * ※ コードブロック（``` InputRule）は TipTap の重い処理を引き起こすため使用しない。
 *
 * 出力: doc-public/demo-gifs/ai-copy.gif
 */
import { test, expect } from '@playwright/test';
import { GifRecorder } from '../helpers/gif';

const OUTPUT_PATH = 'doc-public/demo-gifs/ai-copy.gif';

test.describe('デモ GIF 撮影: AI 向けに清書してコピー機能', () => {
  test.setTimeout(120_000);

  test('ai-copy', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const recorder = new GifRecorder({
      width: 1280,
      height: 720,
      defaultDelay: 1000,
      quality: 8,
    });

    // ── アプリ起動 ────────────────────────────────────────
    await page.goto('/');
    await expect(page.locator('.editor-container')).toBeVisible();

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // ── コンテンツ入力 ────────────────────────────────────
    // H1 タイトル
    await page.keyboard.type('# TypeScript Handbook');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('A practical guide for writing type-safe code.');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    // H3 を直接入力（H2 をスキップ → 見出し階層ジャンプ）
    // normalizeHeadings が ### → ## に修正する
    await page.keyboard.type('### Type Inference');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Let TypeScript infer types whenever possible.');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    // リスト（- で統一）
    await page.keyboard.type('- Use const for better inference');
    await page.keyboard.press('Enter');
    await page.keyboard.type('- Avoid explicit any type');
    await page.keyboard.press('Enter');
    await page.keyboard.type('- Prefer unknown over any');
    await page.waitForTimeout(400);

    // ── Frame 1: Before — H1→H3 の見出しジャンプがあるエディタ ──
    await page.keyboard.press('Control+Home');
    await page.waitForTimeout(300);
    await recorder.addFrame(page, 2000);

    // ── AI向けに清書してコピー ボタンをクリック → 差分プレビューが開く ──
    const aiCopyBtn = page.locator('.ai-copy-button').first();
    const btnVisible = await aiCopyBtn.isVisible().catch(() => false);

    if (btnVisible) {
      await aiCopyBtn.click();
      // 差分プレビューモーダルが開くのを待つ
      await page.waitForSelector('.fixed.inset-0', { timeout: 10_000 }).catch(() => null);
      await page.waitForTimeout(600);

      // ── Frame 2: 差分プレビュー — ### → ## の修正が赤/緑で見える ──
      await recorder.addFrame(page, 3000);

      // 「この設定でコピー」ボタンをクリック
      const copyBtn = page.locator('button').filter({ hasText: 'この設定でコピー' }).first();
      const copyBtnVisible = await copyBtn.isVisible().catch(() => false);

      if (copyBtnVisible) {
        await copyBtn.click();
        await page.waitForTimeout(700);

        // ── Frame 3: 「コピー済み ✓ (1件修正)」が表示 ──
        await recorder.addFrame(page, 2500);
      } else {
        await recorder.addFrame(page, 1500);
      }
    } else {
      await recorder.addFrame(page, 1000);
      await recorder.addFrame(page, 1000);
      await recorder.addFrame(page, 1000);
    }

    // ── GIF を保存 ────────────────────────────────────────
    await recorder.save(OUTPUT_PATH);
  });
});
