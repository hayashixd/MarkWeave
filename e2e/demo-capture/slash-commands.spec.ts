/**
 * デモ GIF 撮影: スラッシュコマンド
 *
 * "/ を入力するとコマンドメニューが開く" を伝えるデモ。
 * 出力: doc-public/demo-gifs/slash-commands.gif
 *
 * フレーム構成:
 *   1. プリセットコンテンツが表示されたエディタ
 *   2. 新しい段落の行頭で "/" を入力してメニューが開いた状態
 *   3. "code" とフィルタリングしてコードブロックが絞り込まれた状態
 *   4. Backspace でクリアして全メニューを表示
 *   5. "table" を選択して Enter で実行後の状態（テーブルが挿入された）
 */
import { test, expect } from '@playwright/test';
import { GifRecorder } from '../helpers/gif';

const OUTPUT_PATH = 'doc-public/demo-gifs/slash-commands.gif';

test.describe('デモ GIF 撮影: スラッシュコマンド', () => {
  test.setTimeout(120_000);

  test('slash-commands', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const recorder = new GifRecorder({
      width: 1280,
      height: 720,
      defaultDelay: 1000,
      quality: 8,
    });

    await page.goto('/');
    await expect(page.locator('.editor-container')).toBeVisible();

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // ── コンテンツを入力してからスラッシュメニューを開く ──
    await page.keyboard.type('# スラッシュコマンドのデモ');
    await page.keyboard.press('Enter');
    await page.keyboard.type('行頭で / を入力するとコマンドメニューが開きます。');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // ── Frame 1: コンテンツが入力された状態 ──────────────
    await recorder.addFrame(page, 1500);

    // ── "/" を入力してメニューを開く ──────────────────────
    await page.keyboard.type('/');
    await page.waitForTimeout(700);

    const slashMenu = page.locator('.slash-command-menu');
    const menuVisible = await slashMenu.isVisible().catch(() => false);

    if (menuVisible) {
      // ── Frame 2: スラッシュメニューが開いた状態 ──────────
      await recorder.addFrame(page, 2000);

      // ── "code" とタイプしてフィルタリング ────────────────
      await page.keyboard.type('code');
      await page.waitForTimeout(500);

      // ── Frame 3: フィルタリングされた状態 ────────────────
      await recorder.addFrame(page, 1800);

      // ── Backspace でクリア、全メニューを表示 ─────────────
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(400);

      // ── Frame 4: 全メニュー再表示 ─────────────────────────
      await recorder.addFrame(page, 1800);

      // ── "table" を選択 ────────────────────────────────────
      await page.keyboard.type('table');
      await page.waitForTimeout(400);

      const hasTable = await slashMenu.locator(':text("テーブル"), :text("Table")').isVisible().catch(() => false);
      if (hasTable) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(600);

        // ── Frame 5: テーブルが挿入された状態 ────────────────
        await recorder.addFrame(page, 2500);
      } else {
        await page.keyboard.press('Escape');
        await recorder.addFrame(page, 1500);
      }
    } else {
      // メニューが見つからなかった場合のフォールバック
      await page.keyboard.press('Escape');
      await recorder.addFrame(page, 1000);
      await page.waitForTimeout(300);
      await recorder.addFrame(page, 1000);
      await recorder.addFrame(page, 1000);
      await recorder.addFrame(page, 1000);
      await recorder.addFrame(page, 1500);
    }

    // ── GIF を保存 ────────────────────────────────────────
    await recorder.save(OUTPUT_PATH);
  });
});
