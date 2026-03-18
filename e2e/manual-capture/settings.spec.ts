/**
 * マニュアル用スクリーンショット撮影シナリオ: 設定ダイアログ
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/settings";

test.describe("マニュアル撮影: 設定ダイアログ", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("設定ダイアログの使い方をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    // ── Step 1: Ctrl+, で設定ダイアログを開く ──
    await page.keyboard.press("Control+,");
    await page.waitForTimeout(600);

    const dialog = page.locator("[role='dialog'], .fixed.inset-0.z-50 [class*='dialog'], .fixed.inset-0.z-50 > div > div").first();
    const dialogVisible = await dialog.isVisible().catch(() => false);

    if (dialogVisible) {
      const dialogBox = await dialog.boundingBox();
      if (dialogBox) {
        await captureWithAnnotation(
          page,
          "settings-dialog-open",
          [
            {
              rect: { x: dialogBox.x, y: dialogBox.y, width: dialogBox.width, height: dialogBox.height },
              label: "設定ダイアログ (Ctrl+,)",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      }

      // ── Step 2: 外観タブ（テーマ選択） ──
      const appearanceTab = page.locator("button:has-text('外観'), nav button").first();
      const tabVisible = await appearanceTab.isVisible().catch(() => false);
      if (tabVisible) {
        await appearanceTab.click();
        await page.waitForTimeout(400);
        await captureStep(page, "settings-appearance-tab", OUTPUT_DIR);
      }

      // ── Step 3: エディタタブ ──
      const editorTab = page.locator("button:has-text('エディタ'), nav button:nth-child(2)").first();
      const editorTabVisible = await editorTab.isVisible().catch(() => false);
      if (editorTabVisible) {
        await editorTab.click();
        await page.waitForTimeout(400);
        await captureStep(page, "settings-editor-tab", OUTPUT_DIR);
      }

      // ── Step 4: 執筆タブ ──
      const writingTab = page.locator("button:has-text('執筆'), nav button:nth-child(3)").first();
      const writingTabVisible = await writingTab.isVisible().catch(() => false);
      if (writingTabVisible) {
        await writingTab.click();
        await page.waitForTimeout(400);
        await captureStep(page, "settings-writing-tab", OUTPUT_DIR);
      }

      // ── Step 5: プラグインタブ ──
      const pluginTab = page.locator("button:has-text('プラグイン'), nav button:nth-child(4)").first();
      const pluginTabVisible = await pluginTab.isVisible().catch(() => false);
      if (pluginTabVisible) {
        await pluginTab.click();
        await page.waitForTimeout(400);
        await captureStep(page, "settings-plugins-tab", OUTPUT_DIR);
      }

      // ── Step 6: AI タブ（設定ダイアログ nav 内の AI ボタン） ──
      const aiTab = page.locator(".fixed.inset-0.z-50 nav button").nth(6);
      const aiTabVisible = await aiTab.isVisible().catch(() => false);
      if (aiTabVisible) {
        await aiTab.click();
        await page.waitForTimeout(400);
        await captureStep(page, "settings-ai-tab", OUTPUT_DIR);
      }

      // ダイアログを閉じる
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    } else {
      await captureStep(page, "settings-dialog-open", OUTPUT_DIR);
    }
  });
});
