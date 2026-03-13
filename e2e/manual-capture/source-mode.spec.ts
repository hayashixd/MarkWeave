/**
 * マニュアル用スクリーンショット撮影シナリオ: ソースモード切替
 *
 * 手順:
 *   1. WYSIWYGモードでテキスト入力
 *   2. Ctrl+/ でソースモードに切替 → 撮影
 *   3. ソースモードでMarkdown直接編集 → 撮影
 *   4. Ctrl+/ でWYSIWYGモードに戻る → 撮影
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/source-mode";

test.describe("マニュアル撮影: ソースモード切替", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("ソースモード切替の手順をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    const editor = page.locator(".ProseMirror");
    await editor.click();

    // ── Step 1: WYSIWYGモードでコンテンツ入力 ──
    await page.keyboard.type("# Markdown サンプル");
    await page.keyboard.press("Enter");
    await page.keyboard.type("これは**太字**と*斜体*のテキストです。");
    await page.keyboard.press("Enter");
    await page.keyboard.type("- 項目1");
    await page.keyboard.press("Enter");
    await page.keyboard.type("- 項目2");
    await page.waitForTimeout(300);

    await captureStep(page, "wysiwyg-mode", OUTPUT_DIR);

    // ── Step 2: ソースモードボタンを強調 ──
    const sourceBtn = page.getByTitle(/ソース|Source|source/).first();
    const sourceBtnBox = await sourceBtn.boundingBox().catch(() => null);
    if (sourceBtnBox) {
      await captureWithAnnotation(
        page,
        "source-button",
        [
          {
            rect: {
              x: sourceBtnBox.x,
              y: sourceBtnBox.y,
              width: sourceBtnBox.width,
              height: sourceBtnBox.height,
            },
            label: "ソースモード (Ctrl+/)",
            color: "red",
          },
        ],
        OUTPUT_DIR
      );
    }

    // ── Step 3: Ctrl+/ でソースモードに切替 ──
    await page.keyboard.press("Control+/");
    await page.waitForTimeout(500);

    // ソースモードのエディタ（CodeMirror）が表示されているか確認
    const sourceEditor = page.locator(".cm-editor, [class*='source'], textarea").first();
    await expect(sourceEditor).toBeVisible({ timeout: 3000 }).catch(async () => {
      // フォールバック: とにかく撮影
    });

    await captureStep(page, "source-mode-active", OUTPUT_DIR);

    // ── Step 4: ソースモードでMarkdownが見える状態を撮影 ──
    await page.waitForTimeout(300);
    const cmContent = page.locator(".cm-content, .cm-line").first();
    const cmBox = await cmContent.boundingBox().catch(() => null);
    if (cmBox) {
      await captureWithAnnotation(
        page,
        "source-markdown-visible",
        [
          {
            rect: {
              x: cmBox.x,
              y: cmBox.y,
              width: Math.min(cmBox.width, 600),
              height: Math.min(cmBox.height * 5, 200),
            },
            label: "Markdown ソースコード",
            color: "blue",
          },
        ],
        OUTPUT_DIR
      );
    } else {
      await captureStep(page, "source-markdown-visible", OUTPUT_DIR);
    }

    // ── Step 5: WYSIWYGモードに戻る ──
    await page.keyboard.press("Control+/");
    await page.waitForTimeout(500);

    await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 3000 }).catch(async () => {});

    await captureStep(page, "back-to-wysiwyg", OUTPUT_DIR);
  });
});
