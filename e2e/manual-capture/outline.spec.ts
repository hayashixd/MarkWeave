/**
 * マニュアル用スクリーンショット撮影シナリオ: アウトラインパネル
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/outline";

test.describe("マニュアル撮影: アウトラインパネル", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("アウトラインパネルの使い方をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    const editor = page.locator(".ProseMirror");
    await editor.click();

    // 見出しを複数入力してアウトラインを作成
    await page.keyboard.type("# 第1章: はじめに");
    await page.keyboard.press("Enter");
    await page.keyboard.type("概要テキスト。");
    await page.keyboard.press("Enter");
    await page.keyboard.type("## 1.1 背景");
    await page.keyboard.press("Enter");
    await page.keyboard.type("背景の説明。");
    await page.keyboard.press("Enter");
    await page.keyboard.type("## 1.2 目的");
    await page.keyboard.press("Enter");
    await page.keyboard.type("目的の説明。");
    await page.keyboard.press("Enter");
    await page.keyboard.type("# 第2章: 本論");
    await page.keyboard.press("Enter");
    await page.keyboard.type("### 2.1 詳細");
    await page.waitForTimeout(400);

    // ── Step 1: アウトラインパネルを探す（サイドバー内） ──
    const outlinePanel = page.locator(".outline-panel");
    const outlineVisible = await outlinePanel.isVisible().catch(() => false);

    if (outlineVisible) {
      const outlineBox = await outlinePanel.boundingBox();
      if (outlineBox) {
        await captureWithAnnotation(
          page,
          "outline-panel",
          [
            {
              rect: { x: outlineBox.x, y: outlineBox.y, width: outlineBox.width, height: outlineBox.height },
              label: "アウトラインパネル",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      }

      // アウトラインアイテムをクリックしてジャンプ
      const outlineItem = outlinePanel.locator(".outline-panel__item").first();
      const itemVisible = await outlineItem.isVisible().catch(() => false);
      if (itemVisible) {
        const itemBox = await outlineItem.boundingBox();
        if (itemBox) {
          await captureWithAnnotation(
            page,
            "outline-item-click",
            [
              {
                rect: { x: itemBox.x, y: itemBox.y, width: itemBox.width, height: itemBox.height },
                label: "クリックでジャンプ",
                color: "green",
              },
            ],
            OUTPUT_DIR
          );
        }
        await outlineItem.click();
        await page.waitForTimeout(300);
      }
    } else {
      // サイドバーのタブでアウトラインを開く
      const outlineTab = page.locator("[data-tab='outline'], button:has-text('アウトライン'), button[title*='アウトライン']").first();
      const tabVisible = await outlineTab.isVisible().catch(() => false);
      if (tabVisible) {
        await outlineTab.click();
        await page.waitForTimeout(400);
      }
      await captureStep(page, "outline-panel", OUTPUT_DIR);
    }

    await captureStep(page, "outline-overview", OUTPUT_DIR);
  });
});
