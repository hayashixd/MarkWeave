/**
 * マニュアル用スクリーンショット撮影シナリオ: スラッシュコマンド
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/slash-commands";

test.describe("マニュアル撮影: スラッシュコマンド", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("スラッシュコマンドの使い方をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    const editor = page.locator(".ProseMirror");
    await editor.click();

    // ── Step 1: 行頭で "/" を入力してスラッシュメニューを開く ──
    await page.keyboard.type("/");
    await page.waitForTimeout(600);

    const slashMenu = page.locator(".slash-command-menu");
    const menuVisible = await slashMenu.isVisible().catch(() => false);

    if (menuVisible) {
      const menuBox = await slashMenu.boundingBox();
      if (menuBox) {
        await captureWithAnnotation(
          page,
          "slash-menu-open",
          [
            {
              rect: { x: menuBox.x, y: menuBox.y, width: menuBox.width, height: menuBox.height },
              label: "スラッシュコマンドメニュー",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      }

      // ── Step 2: "heading" とフィルタリング ──
      await page.keyboard.type("heading");
      await page.waitForTimeout(400);
      await captureStep(page, "slash-filter-heading", OUTPUT_DIR);

      // クリアして全メニュー表示
      await page.keyboard.press("Backspace");
      await page.keyboard.press("Backspace");
      await page.keyboard.press("Backspace");
      await page.keyboard.press("Backspace");
      await page.keyboard.press("Backspace");
      await page.keyboard.press("Backspace");
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(400);

      // ── Step 3: カテゴリ別グループ表示 ──
      const groupLabel = slashMenu.locator(".slash-command-menu__group-label").first();
      const groupVisible = await groupLabel.isVisible().catch(() => false);
      if (groupVisible) {
        await captureStep(page, "slash-menu-groups", OUTPUT_DIR);
      }

      // ── Step 4: キーボード操作でコマンドを選択 ──
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(200);
      await captureStep(page, "slash-menu-selected", OUTPUT_DIR);

      // Enterで実行
      await page.keyboard.press("Enter");
      await page.waitForTimeout(400);
      await captureStep(page, "slash-command-executed", OUTPUT_DIR);
    } else {
      await captureStep(page, "slash-menu-open", OUTPUT_DIR);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Backspace");
    }
  });
});
