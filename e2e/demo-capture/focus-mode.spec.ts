/**
 * デモ GIF 撮影: フォーカスモード・タイプライターモード
 *
 * "雑音ゼロの執筆体験" を伝えるデモ。
 * 出力: doc-public/demo-gifs/focus-mode.gif
 *
 * フレーム構成:
 *   1. 通常の WYSIWYG エディタ（記事コンテンツあり）
 *   2. フォーカスモード ON（サイドバー非表示・余白拡大）
 *   3. タイプライターモード ON（現在行が中央に固定）
 *   4. 通常モードに戻った状態
 */
import { test, expect } from '@playwright/test';
import { GifRecorder } from '../helpers/gif';

const OUTPUT_PATH = 'doc-public/demo-gifs/focus-mode.gif';

test.describe('デモ GIF 撮影: フォーカスモード・タイプライターモード', () => {
  test.setTimeout(120_000);

  test('focus-mode', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const recorder = new GifRecorder({
      width: 1280,
      height: 720,
      defaultDelay: 1000,
      quality: 8,
    });

    // ── コンテンツを入力 ──────────────────────────────────
    await page.goto('/');
    await expect(page.locator('.editor-container')).toBeVisible();

    const editor = page.locator('.ProseMirror');
    await editor.click();

    await page.keyboard.type('# Deep Work');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('The ability to focus without distraction');
    await page.keyboard.type(' on a cognitively demanding task.');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('## Why It Matters');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Deep work produces results that are hard to replicate.');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('## How to Practice');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Schedule distraction-free blocks of time.');
    await page.waitForTimeout(400);

    // ── Frame 1: 通常の WYSIWYG エディタ ─────────────────
    await recorder.addFrame(page, 1500);

    // ── フォーカスモード ON ───────────────────────────────
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('tauri-menu-action', { detail: 'view_focus_mode' })
      );
    });
    await page.waitForTimeout(600);

    // ── Frame 2: フォーカスモード ON ─────────────────────
    await recorder.addFrame(page, 2000);

    // ── フォーカスモード OFF ──────────────────────────────
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('tauri-menu-action', { detail: 'view_focus_mode' })
      );
    });
    await page.waitForTimeout(400);

    // ── タイプライターモード ON ───────────────────────────
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('tauri-menu-action', { detail: 'view_typewriter_mode' })
      );
    });
    await page.waitForTimeout(600);

    // ── Frame 3: タイプライターモード ON ──────────────────
    await recorder.addFrame(page, 2000);

    // ── タイプライターモード OFF → 通常に戻す ─────────────
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('tauri-menu-action', { detail: 'view_typewriter_mode' })
      );
    });
    await page.waitForTimeout(400);

    // ── Frame 4: 通常モードに戻った状態 ──────────────────
    await recorder.addFrame(page, 1500);

    // ── GIF を保存 ────────────────────────────────────────
    await recorder.save(OUTPUT_PATH);
  });
});
