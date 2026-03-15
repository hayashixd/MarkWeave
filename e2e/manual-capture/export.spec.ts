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
      window.dispatchEvent(new CustomEvent("tauri-menu-action", { detail: "file_export_html" }));
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

    // ── Step 2: PDF エクスポートダイアログ ──
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("tauri-menu-action", { detail: "file_export_pdf" }));
    });
    await page.waitForTimeout(800);

    const pdfDialog = page.locator("[role='dialog'], [aria-label*='PDF'], [aria-label*='エクスポート']").first();
    const pdfVisible = await pdfDialog.isVisible().catch(() => false);

    if (pdfVisible) {
      const pdfBox = await pdfDialog.boundingBox();
      if (pdfBox) {
        await captureWithAnnotation(
          page,
          "export-dialog-pdf",
          [
            {
              rect: { x: pdfBox.x, y: pdfBox.y, width: pdfBox.width, height: pdfBox.height },
              label: "PDF エクスポートダイアログ",
              color: "red",
            },
          ],
          OUTPUT_DIR
        );
      }
      await page.keyboard.press("Escape");
    } else {
      await captureStep(page, "export-dialog-pdf", OUTPUT_DIR);
    }
    await page.waitForTimeout(300);

    // ── Step 3: Pandoc エクスポートダイアログ（Word/LaTeX/EPUB） ──
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("tauri-menu-action", { detail: "file_export_word" }));
    });
    await page.waitForTimeout(800);

    const pandocDialog = page.locator("[role='dialog'], [aria-label*='Pandoc'], [aria-label*='Word'], [aria-label*='エクスポート']").first();
    const pandocVisible = await pandocDialog.isVisible().catch(() => false);

    if (pandocVisible) {
      const pandocBox = await pandocDialog.boundingBox();
      if (pandocBox) {
        await captureWithAnnotation(
          page,
          "export-dialog-pandoc",
          [
            {
              rect: { x: pandocBox.x, y: pandocBox.y, width: pandocBox.width, height: pandocBox.height },
              label: "Pandoc エクスポートダイアログ（Word / LaTeX / EPUB）",
              color: "orange",
            },
          ],
          OUTPUT_DIR
        );
      }
      await page.keyboard.press("Escape");
    } else {
      await captureStep(page, "export-dialog-pandoc", OUTPUT_DIR);
    }

    await captureStep(page, "export-all-overview", OUTPUT_DIR);
  });
});
