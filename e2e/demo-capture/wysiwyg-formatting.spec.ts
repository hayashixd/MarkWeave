/**
 * デモ GIF 撮影: WYSIWYG リアルタイム整形
 *
 * "Markdown 記法を入力するだけで即座に整形される" を伝えるデモ。
 * 出力: doc-public/demo-gifs/wysiwyg-formatting.gif
 *
 * フレーム構成:
 *   1. 空のエディタ（起動直後）
 *   2. H1 見出しが入力された状態
 *   3. H2 + 本文テキストが追加された状態
 *   4. 箇条書きリストが追加された状態
 *   5. テキスト選択 + 太字ボタンクリック後の状態
 */
import { test, expect } from '@playwright/test';
import { GifRecorder } from '../helpers/gif';

const OUTPUT_PATH = 'doc-public/demo-gifs/wysiwyg-formatting.gif';

test.describe('デモ GIF 撮影: WYSIWYG リアルタイム整形', () => {
  test.setTimeout(120_000);

  test('wysiwyg-formatting', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const recorder = new GifRecorder({
      width: 1280,
      height: 720,
      defaultDelay: 1000,
      quality: 8,
    });

    // ── Frame 1: 空のエディタ ────────────────────────────
    await page.goto('/');
    await expect(page.locator('.editor-container')).toBeVisible();
    await page.waitForTimeout(500);
    await recorder.addFrame(page, 1200);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // ── H1 見出しを入力（InputRule: "# " → Heading） ────
    await page.keyboard.type('# My Article');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // ── Frame 2: H1 見出しが表示された状態 ───────────────
    await recorder.addFrame(page, 1500);

    // ── H2 + 本文テキストを追加 ─────────────────────────
    await page.keyboard.type('## Introduction');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Write once, publish anywhere.');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // ── Frame 3: H2 + 本文が追加された状態 ───────────────
    await recorder.addFrame(page, 1500);

    // ── 箇条書きリストを追加（InputRule: "- " → BulletList） ──
    await page.keyboard.type('- Install MarkWeave');
    await page.keyboard.press('Enter');
    await page.keyboard.type('- Write your article');
    await page.keyboard.press('Enter');
    await page.keyboard.type('- Export to HTML');
    await page.waitForTimeout(300);

    // ── Frame 4: 箇条書きリストが表示された状態 ──────────
    await recorder.addFrame(page, 1500);

    // ── 本文テキストを選択して太字ボタンをクリック ───────
    // "Write once, publish anywhere." の行をクリック
    const paragraphs = editor.locator('p');
    const targetPara = paragraphs.filter({ hasText: 'Write once' }).first();
    const paraVisible = await targetPara.isVisible().catch(() => false);
    if (paraVisible) {
      await targetPara.click();
      await page.keyboard.press('Control+a');
      // 全選択ではなく行選択に留める
      await page.keyboard.press('Home');
      await page.keyboard.press('Shift+End');
      await page.waitForTimeout(200);

      // ツールバーの太字ボタンをクリック
      const boldBtn = page.getByTitle(/太字|Bold/i).first();
      if (await boldBtn.isVisible().catch(() => false)) {
        await boldBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // ── Frame 5: 太字が適用された状態 ────────────────────
    await recorder.addFrame(page, 2000);

    // ── GIF を保存 ────────────────────────────────────────
    await recorder.save(OUTPUT_PATH);
  });
});
