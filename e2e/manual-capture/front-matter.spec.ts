/**
 * マニュアル用スクリーンショット撮影シナリオ: YAML Front Matter・リンク・文書統計
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/front-matter";

test.describe("マニュアル撮影: YAML Front Matter・その他機能", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("YAML Front Matter・リンク・文書統計の使い方をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    // ── Step 1: YAML Front Matter パネルを確認 ──
    const fmPanel = page.locator(".front-matter-panel, [class*='front-matter'], [class*='FrontMatter']").first();
    const fmVisible = await fmPanel.isVisible().catch(() => false);

    if (fmVisible) {
      const fmBox = await fmPanel.boundingBox();
      if (fmBox) {
        await captureWithAnnotation(
          page,
          "front-matter-panel",
          [
            {
              rect: { x: fmBox.x, y: fmBox.y, width: fmBox.width, height: fmBox.height },
              label: "YAML Front Matter パネル",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      }

      // パネルを展開
      const fmHeader = fmPanel.locator("[class*='header'], button").first();
      const headerVisible = await fmHeader.isVisible().catch(() => false);
      if (headerVisible) {
        await fmHeader.click();
        await page.waitForTimeout(400);
        await captureStep(page, "front-matter-expanded", OUTPUT_DIR);
      }
    } else {
      await captureStep(page, "front-matter-panel", OUTPUT_DIR);
    }

    // ── Step 2: エディタにコンテンツを入力 ──
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("# リンクのサンプル");
    await page.keyboard.press("Enter");
    await page.keyboard.type("これは通常のテキストです。");
    await page.waitForTimeout(200);

    // ── Step 3: リンク挿入（Ctrl+K） ──
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("リンクを挿入します: ");
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(400);

    const linkDialog = page.locator("[role='dialog'], [class*='link-dialog'], [class*='LinkDialog']").first();
    const linkVisible = await linkDialog.isVisible().catch(() => false);

    if (linkVisible) {
      const dialogBox = await linkDialog.boundingBox();
      if (dialogBox) {
        await captureWithAnnotation(
          page,
          "link-insert-dialog",
          [
            {
              rect: { x: dialogBox.x, y: dialogBox.y, width: dialogBox.width, height: dialogBox.height },
              label: "リンク挿入ダイアログ (Ctrl+K)",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      }
      await page.keyboard.press("Escape");
    } else {
      await captureStep(page, "link-insert-dialog", OUTPUT_DIR);
      await page.keyboard.press("Escape");
    }

    // ── Step 4: 文書統計ダイアログ ──
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("menu-action", { detail: { action: "word-count" } }));
    });
    await page.waitForTimeout(500);

    const statsDialog = page.locator("[role='dialog'], [class*='stats'], [class*='word-count']").first();
    const statsVisible = await statsDialog.isVisible().catch(() => false);

    if (statsVisible) {
      const statsBox = await statsDialog.boundingBox();
      if (statsBox) {
        await captureWithAnnotation(
          page,
          "word-count-dialog",
          [
            {
              rect: { x: statsBox.x, y: statsBox.y, width: statsBox.width, height: statsBox.height },
              label: "文書統計（文字数・単語数）",
              color: "green",
            },
          ],
          OUTPUT_DIR
        );
      }
      await page.keyboard.press("Escape");
    } else {
      await captureStep(page, "word-count-dialog", OUTPUT_DIR);
    }

    await captureStep(page, "extras-overview", OUTPUT_DIR);
  });
});
