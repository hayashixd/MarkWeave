/**
 * マニュアル用スクリーンショット撮影シナリオ: フローティング目次・ズーム
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/floating-toc";

test.describe("マニュアル撮影: フローティング目次・ズーム", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("フローティング目次とズームをスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();
    await page.waitForTimeout(500);

    // 見出し付きのサンプルコンテンツを入力
    const editor = page.locator(".ProseMirror, [contenteditable='true']").first();
    await editor.click();
    await page.waitForTimeout(200);

    await page.keyboard.type("# セクション 1");
    await page.keyboard.press("Enter");
    await page.keyboard.type("最初のセクションです。");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("## サブセクション 1.1");
    await page.keyboard.press("Enter");
    await page.keyboard.type("サブセクションの内容。");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("# セクション 2");
    await page.keyboard.press("Enter");
    await page.keyboard.type("2番目のセクション。");
    await page.waitForTimeout(400);

    // ── Step 1: フローティング目次 ──
    await page.keyboard.press("Control+Shift+t");
    await page.waitForTimeout(700);

    const floatingToc = page
      .locator(
        "[class*='floating-toc'], [class*='FloatingToc'], [class*='floating-toc'], .floating-toc"
      )
      .first();
    const tocVisible = await floatingToc.isVisible().catch(() => false);

    if (tocVisible) {
      const tocBox = await floatingToc.boundingBox();
      if (tocBox) {
        await captureWithAnnotation(
          page,
          "floating-toc",
          [
            {
              rect: { x: tocBox.x, y: tocBox.y, width: tocBox.width, height: tocBox.height },
              label: "フローティング目次",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      } else {
        await captureStep(page, "floating-toc", OUTPUT_DIR);
      }
    } else {
      await captureStep(page, "floating-toc", OUTPUT_DIR);
    }

    // フローティング目次を閉じる
    await page.keyboard.press("Control+Shift+t");
    await page.waitForTimeout(300);

    // ── Step 2: ズームコントロール ──
    // 拡大してからスクリーンショット
    await page.keyboard.press("Control+Equal"); // Ctrl+=
    await page.waitForTimeout(300);
    await page.keyboard.press("Control+Equal");
    await page.waitForTimeout(300);

    // メニューからズームを確認（表示メニューを開く）
    const viewMenu = page.getByRole("menuitem", { name: /表示|View/ }).first();
    const viewMenuVisible = await viewMenu.isVisible().catch(() => false);
    if (viewMenuVisible) {
      await viewMenu.click();
      await page.waitForTimeout(300);

      const zoomIn = page.getByRole("menuitem", { name: /拡大|Zoom In/i }).first();
      const zoomInVisible = await zoomIn.isVisible().catch(() => false);
      if (zoomInVisible) {
        const zoomInBox = await zoomIn.boundingBox().catch(() => null);
        await captureWithAnnotation(
          page,
          "zoom-controls",
          [
            {
              rect: zoomInBox ?? { x: 0, y: 0, width: 200, height: 100 },
              label: "ズーム操作 (Ctrl+= / Ctrl+- / Ctrl+0)",
              color: "orange",
            },
          ],
          OUTPUT_DIR
        );
      } else {
        await captureStep(page, "zoom-controls", OUTPUT_DIR);
      }
      await page.keyboard.press("Escape");
    } else {
      await captureStep(page, "zoom-controls", OUTPUT_DIR);
    }

    // ズームをリセット
    await page.keyboard.press("Control+0");
    await page.waitForTimeout(200);
  });
});
