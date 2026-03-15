/**
 * デモ GIF 撮影: AI コピー機能
 *
 * "ワンクリックで AI 向けに最適化してコピーできる" を伝えるデモ。
 * 出力: doc-public/demo-gifs/ai-copy.gif
 *
 * フレーム構成:
 *   1. 記事コンテンツが入力されたエディタ
 *   2. AI コピードロップダウンを開いた状態（オプション一覧）
 *   3. AI コピーボタンをクリックしてコピー済みになった状態
 */
import { test, expect } from '@playwright/test';
import { GifRecorder } from '../helpers/gif';

const OUTPUT_PATH = 'doc-public/demo-gifs/ai-copy.gif';

test.describe('デモ GIF 撮影: AI コピー機能', () => {
  test.setTimeout(120_000);

  test('ai-copy', async ({ page }) => {
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

    await page.keyboard.type('# TypeScript Tips');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('A practical guide for TypeScript developers.');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('## Type Inference');
    await page.keyboard.press('Enter');
    await page.keyboard.type('- Use `const` for better inference');
    await page.keyboard.press('Enter');
    // 2項目目以降は既にリスト内なので "- " は不要（InputRule は段落先頭のみ発動）
    await page.keyboard.type('Avoid explicit `any`');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Prefer `unknown` over `any`');
    await page.waitForTimeout(400);

    // ── Frame 1: 記事が入力されたエディタ ────────────────
    await recorder.addFrame(page, 1500);

    // ── ドロップダウンを開く ──────────────────────────────
    const dropdownTrigger = page.locator('.ai-copy-button__dropdown-trigger').first();
    const triggerVisible = await dropdownTrigger.isVisible().catch(() => false);

    if (triggerVisible) {
      await dropdownTrigger.click();
      await page.waitForTimeout(400);

      // ── Frame 2: ドロップダウン（オプション一覧）が開いた状態 ──
      await recorder.addFrame(page, 2000);

      // ドロップダウンを閉じる
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } else {
      // ドロップダウントリガーが見つからなかった場合はスキップ
      await recorder.addFrame(page, 1000);
    }

    // ── メインの AI コピーボタンをクリック ────────────────
    const aiCopyBtn = page.locator('.ai-copy-button').first();
    const btnVisible = await aiCopyBtn.isVisible().catch(() => false);

    if (btnVisible) {
      await aiCopyBtn.click();
      await page.waitForTimeout(500);

      // ── Frame 3: コピー済み状態 ───────────────────────────
      await recorder.addFrame(page, 2000);
    } else {
      await recorder.addFrame(page, 1000);
    }

    // ── GIF を保存 ────────────────────────────────────────
    await recorder.save(OUTPUT_PATH);
  });
});
