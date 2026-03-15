/**
 * マニュアル用スクリーンショット撮影シナリオ: 検索・置換
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/search-replace";

test.describe("マニュアル撮影: 検索・置換", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("検索・置換の手順をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    const editor = page.locator(".ProseMirror");
    await editor.click();

    // 検索対象のテキストを入力
    await page.keyboard.type("# 検索・置換のデモ");
    await page.keyboard.press("Enter");
    await page.keyboard.type("これはサンプルテキストです。サンプルという言葉を検索してみましょう。");
    await page.keyboard.press("Enter");
    await page.keyboard.type("もう一度サンプルが登場します。");
    await page.waitForTimeout(300);

    // ── Step 1: Ctrl+F で検索バーを開く ──
    await page.keyboard.press("Control+f");
    await page.waitForTimeout(500);

    const searchBar = page.locator(".search-bar, [class*='search-bar'], [class*='SearchBar']").first();
    const searchVisible = await searchBar.isVisible().catch(() => false);

    if (searchVisible) {
      const searchBox = await searchBar.boundingBox();
      if (searchBox) {
        await captureWithAnnotation(
          page,
          "search-bar-open",
          [
            {
              rect: { x: searchBox.x, y: searchBox.y, width: searchBox.width, height: searchBox.height },
              label: "検索バー (Ctrl+F)",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      }

      // 検索テキストを入力
      const searchInput = page.locator(".search-bar__input, [placeholder*='検索'], [placeholder*='search']").first();
      await searchInput.fill("サンプル");
      await page.waitForTimeout(400);
      await captureStep(page, "search-result-highlight", OUTPUT_DIR);

      // ── Step 2: Ctrl+H で置換バーを開く ──
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      await page.keyboard.press("Control+h");
      await page.waitForTimeout(500);

      const replaceBar = page.locator(".search-bar, [class*='search-bar']").first();
      const replaceVisible = await replaceBar.isVisible().catch(() => false);

      if (replaceVisible) {
        const replaceBox = await replaceBar.boundingBox();
        if (replaceBox) {
          await captureWithAnnotation(
            page,
            "replace-bar-open",
            [
              {
                rect: { x: replaceBox.x, y: replaceBox.y, width: replaceBox.width, height: replaceBox.height },
                label: "検索・置換バー (Ctrl+H)",
                color: "green",
              },
            ],
            OUTPUT_DIR
          );
        }

        // 置換フィールドに入力
        const replaceInput = page.locator(".search-bar__replace-row input, [placeholder*='置換'], [placeholder*='replace']").first();
        if (await replaceInput.isVisible().catch(() => false)) {
          await replaceInput.fill("例文");
          await page.waitForTimeout(200);
          await captureStep(page, "replace-fields-filled", OUTPUT_DIR);
        } else {
          await captureStep(page, "replace-fields-filled", OUTPUT_DIR);
        }
      } else {
        await captureStep(page, "replace-bar-open", OUTPUT_DIR);
      }

      await page.keyboard.press("Escape");
    } else {
      await captureStep(page, "search-bar-open", OUTPUT_DIR);
      await page.keyboard.press("Escape");
    }

    await captureStep(page, "search-replace-overview", OUTPUT_DIR);
  });
});
