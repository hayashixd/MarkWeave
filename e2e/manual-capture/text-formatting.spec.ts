/**
 * マニュアル用スクリーンショット撮影シナリオ: テキスト書式設定
 *
 * 手順:
 *   1. 斜体（Ctrl+I / *text*）
 *   2. 取り消し線（~~text~~）
 *   3. インラインコード（`code`）
 *   4. 書式ボタンをツールバーで強調表示
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/text-formatting";

test.describe("マニュアル撮影: テキスト書式設定", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("テキスト書式設定の手順をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    const editor = page.locator(".ProseMirror");
    await editor.click();

    // ── Step 1: ツールバー全体を強調表示 ──
    const toolbar = page.locator("[class*='toolbar'], [class*='Toolbar']").first();
    const toolbarBox = await toolbar.boundingBox();
    if (toolbarBox) {
      await captureWithAnnotation(
        page,
        "toolbar-overview",
        [
          {
            rect: {
              x: toolbarBox.x,
              y: toolbarBox.y,
              width: toolbarBox.width,
              height: toolbarBox.height,
            },
            label: "書式ツールバー",
            color: "blue",
          },
        ],
        OUTPUT_DIR
      );
    } else {
      await captureStep(page, "toolbar-overview", OUTPUT_DIR);
    }

    // ── Step 2: 斜体（Ctrl+I） ──
    await page.keyboard.type("斜体テキストのサンプル");
    await page.keyboard.press("Control+a");
    await page.waitForTimeout(150);
    await page.keyboard.press("Control+i");
    await expect(editor.locator("em")).toContainText("斜体テキストのサンプル");

    const emEl = editor.locator("em").first();
    const emBox = await emEl.boundingBox();
    if (emBox) {
      await captureWithAnnotation(
        page,
        "italic-result",
        [
          {
            rect: { x: emBox.x, y: emBox.y, width: emBox.width, height: emBox.height },
            label: "斜体 (Ctrl+I)",
            color: "blue",
          },
        ],
        OUTPUT_DIR
      );
    } else {
      await captureStep(page, "italic-result", OUTPUT_DIR);
    }

    // ── Step 3: 取り消し線（~~ 記法） ──
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("~~削除予定のテキスト~~");
    await page.waitForTimeout(300);
    await expect(editor.locator("s, del, strike")).toBeVisible();

    const sEl = editor.locator("s, del, strike").first();
    const sBox = await sEl.boundingBox();
    if (sBox) {
      await captureWithAnnotation(
        page,
        "strikethrough-result",
        [
          {
            rect: { x: sBox.x, y: sBox.y, width: sBox.width, height: sBox.height },
            label: "取り消し線 (~~text~~)",
            color: "red",
          },
        ],
        OUTPUT_DIR
      );
    } else {
      await captureStep(page, "strikethrough-result", OUTPUT_DIR);
    }

    // ── Step 4: インラインコード（`code` 記法） ──
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("`const x = 42`");
    await page.waitForTimeout(300);
    await expect(editor.locator("code")).toBeVisible();

    const codeEl = editor.locator("code").first();
    const codeBox = await codeEl.boundingBox();
    if (codeBox) {
      await captureWithAnnotation(
        page,
        "inline-code-result",
        [
          {
            rect: { x: codeBox.x, y: codeBox.y, width: codeBox.width, height: codeBox.height },
            label: "インラインコード (`code`)",
            color: "green",
          },
        ],
        OUTPUT_DIR
      );
    } else {
      await captureStep(page, "inline-code-result", OUTPUT_DIR);
    }

    // ── Step 5: 全体確認 ──
    await captureStep(page, "formatting-overview", OUTPUT_DIR);
  });
});
