/**
 * マニュアル用スクリーンショット撮影シナリオ: エクスポート
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/export";

test.describe("マニュアル撮影: エクスポート", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("エクスポート機能の使い方をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    // コンテンツを用意
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("# エクスポートサンプル");
    await page.keyboard.press("Enter");
    await page.keyboard.type("このドキュメントをHTMLやPDFにエクスポートできます。");
    await page.waitForTimeout(300);

    // ── Step 1: エクスポートダイアログを開く（メニューから） ──
    // メニューバーからエクスポートを選択
    // ネイティブメニューはPlaywrightで直接操作が難しいので、
    // まずはアプリ全体を撮影してからメニューを試みる
    await captureStep(page, "before-export", OUTPUT_DIR);

    // アプリメニューのファイルメニューを探す
    // Tauri のネイティブメニューは通常 OS が管理するため
    // フロントエンドからのトリガー方法を試みる
    // カスタムイベントでエクスポートダイアログを開く
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("menu-action", { detail: { action: "export-html" } }));
    });
    await page.waitForTimeout(800);

    const exportDialog = page.locator("[role='dialog'], [aria-label*='エクスポート'], [aria-label*='Export']").first();
    const exportVisible = await exportDialog.isVisible().catch(() => false);

    if (exportVisible) {
      const dialogBox = await exportDialog.boundingBox();
      if (dialogBox) {
        await captureWithAnnotation(
          page,
          "export-dialog-html",
          [
            {
              rect: { x: dialogBox.x, y: dialogBox.y, width: dialogBox.width, height: dialogBox.height },
              label: "HTMLエクスポートダイアログ",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      }

      // テーマ選択カードを強調
      const themeCards = exportDialog.locator("label.flex, [class*='theme-card']");
      const cardCount = await themeCards.count();
      if (cardCount > 0) {
        const firstCard = themeCards.first();
        const cardBox = await firstCard.boundingBox();
        if (cardBox) {
          await captureWithAnnotation(
            page,
            "export-theme-selection",
            [
              {
                rect: { x: cardBox.x, y: cardBox.y, width: cardBox.width, height: cardBox.height },
                label: "テーマ選択",
                color: "purple",
              },
            ],
            OUTPUT_DIR
          );
        }
      }

      await page.keyboard.press("Escape");
    } else {
      await captureStep(page, "export-dialog-html", OUTPUT_DIR);
    }

    await captureStep(page, "export-overview", OUTPUT_DIR);
  });
});
