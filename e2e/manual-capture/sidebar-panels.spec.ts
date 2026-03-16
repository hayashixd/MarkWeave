/**
 * マニュアル用スクリーンショット撮影シナリオ: サイドバーパネル詳細
 * 対象: バックリンク、タグビュー、Git パネル、サイドバートグル
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/sidebar-panels";

test.describe("マニュアル撮影: サイドバーパネル詳細", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("サイドバーパネルをスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();
    await page.waitForTimeout(500);

    // ── Step 1: バックリンクパネル ──
    // Ctrl+Shift+4 でバックリンクパネルを開く
    await page.keyboard.press("Control+Shift+4");
    await page.waitForTimeout(600);

    const backlinksPanel = page
      .locator("[class*='backlink'], [class*='Backlink'], [data-panel='backlinks']")
      .first();
    const backlinksVisible = await backlinksPanel.isVisible().catch(() => false);

    if (backlinksVisible) {
      const box = await backlinksPanel.boundingBox();
      if (box) {
        await captureWithAnnotation(
          page,
          "backlinks-panel",
          [
            {
              rect: { x: box.x, y: box.y, width: box.width, height: box.height },
              label: "バックリンクパネル",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      } else {
        await captureStep(page, "backlinks-panel", OUTPUT_DIR);
      }
    } else {
      // プラグイン未有効化の場合はサイドバー全体を撮影
      await captureStep(page, "backlinks-panel", OUTPUT_DIR);
    }

    // ── Step 2: タグビューパネル ──
    await page.keyboard.press("Control+Shift+5");
    await page.waitForTimeout(600);

    const tagsPanel = page
      .locator("[class*='tag-view'], [class*='TagView'], [data-panel='tags']")
      .first();
    const tagsVisible = await tagsPanel.isVisible().catch(() => false);

    if (tagsVisible) {
      const box = await tagsPanel.boundingBox();
      if (box) {
        await captureWithAnnotation(
          page,
          "tags-panel",
          [
            {
              rect: { x: box.x, y: box.y, width: box.width, height: box.height },
              label: "タグビュー",
              color: "green",
            },
          ],
          OUTPUT_DIR
        );
      } else {
        await captureStep(page, "tags-panel", OUTPUT_DIR);
      }
    } else {
      await captureStep(page, "tags-panel", OUTPUT_DIR);
    }

    // ── Step 3: Git パネル ──
    await page.keyboard.press("Control+Shift+7");
    await page.waitForTimeout(600);

    const gitPanel = page
      .locator("[class*='git-panel'], [class*='GitPanel'], [data-panel='git']")
      .first();
    const gitVisible = await gitPanel.isVisible().catch(() => false);

    if (gitVisible) {
      const box = await gitPanel.boundingBox();
      if (box) {
        await captureWithAnnotation(
          page,
          "git-panel",
          [
            {
              rect: { x: box.x, y: box.y, width: box.width, height: box.height },
              label: "Git パネル",
              color: "orange",
            },
          ],
          OUTPUT_DIR
        );
      } else {
        await captureStep(page, "git-panel", OUTPUT_DIR);
      }
    } else {
      await captureStep(page, "git-panel", OUTPUT_DIR);
    }

    // ── Step 4: サイドバー非表示トグル ──
    // Ctrl+Shift+L でサイドバーを非表示
    await page.keyboard.press("Control+Shift+1"); // まずアウトラインを表示
    await page.waitForTimeout(400);
    await page.keyboard.press("Control+Shift+l"); // サイドバーを非表示
    await page.waitForTimeout(500);

    const editorArea = page.locator(".editor-container, [class*='editor-area']").first();
    const editorBox = await editorArea.boundingBox().catch(() => null);
    if (editorBox) {
      await captureWithAnnotation(
        page,
        "sidebar-toggle",
        [
          {
            rect: { x: editorBox.x, y: editorBox.y, width: editorBox.width, height: editorBox.height },
            label: "サイドバー非表示 — 編集領域が拡大",
            color: "purple",
          },
        ],
        OUTPUT_DIR
      );
    } else {
      await captureStep(page, "sidebar-toggle", OUTPUT_DIR);
    }

    // サイドバーを元に戻す
    await page.keyboard.press("Control+Shift+l");
    await page.waitForTimeout(300);
  });
});
