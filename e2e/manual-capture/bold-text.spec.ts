/**
 * マニュアル用スクリーンショット撮影シナリオ: 太字テキストの適用
 *
 * 手順:
 *   1. アプリ起動
 *   2. テキスト入力エリアをクリック → 撮影
 *   3. テキスト「Hello World」を入力 → 撮影
 *   4. テキストを全選択（Ctrl+A）→ 撮影
 *   5. ツールバーの太字ボタンをクリック → 撮影
 *   6. 結果確認 → 撮影
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/bold-text";

test.describe("マニュアル撮影: 太字テキスト", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("太字適用の手順をスクリーンショットで記録する", async ({ page }) => {
    // ── Step 1: アプリ起動 ──
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    // ── Step 2: テキスト入力エリアをクリック → 撮影 ──
    const editor = page.locator(".ProseMirror");
    await editor.click();

    const editorBox = await editor.boundingBox();
    if (editorBox) {
      await captureWithAnnotation(
        page,
        "click-editor",
        [
          {
            rect: {
              x: editorBox.x,
              y: editorBox.y,
              width: editorBox.width,
              height: editorBox.height,
            },
            label: "Editor",
            color: "blue",
          },
        ],
        OUTPUT_DIR
      );
    } else {
      await captureStep(page, "click-editor", OUTPUT_DIR);
    }

    // ── Step 3: テキスト「Hello World」を入力 → 撮影 ──
    await page.keyboard.type("Hello World");
    await expect(editor).toContainText("Hello World");
    await captureStep(page, "type-text", OUTPUT_DIR);

    // ── Step 4: テキストを全選択（Ctrl+A）→ 撮影 ──
    await page.keyboard.press("Control+a");
    // 選択状態が視覚的に反映されるまで少し待つ
    await page.waitForTimeout(200);
    await captureStep(page, "select-all", OUTPUT_DIR);

    // ── Step 5: ツールバーの太字ボタンをクリック → 撮影 ──
    const boldButton = page.getByTitle(/太字/);
    await expect(boldButton).toBeVisible();

    const boldBox = await boldButton.boundingBox();
    if (boldBox) {
      await captureWithAnnotation(
        page,
        "before-bold-click",
        [
          {
            rect: {
              x: boldBox.x,
              y: boldBox.y,
              width: boldBox.width,
              height: boldBox.height,
            },
            label: "Bold",
            color: "red",
          },
        ],
        OUTPUT_DIR
      );
    }

    await boldButton.click();

    // ── Step 6: 結果確認 → 撮影 ──
    await expect(editor.locator("strong")).toContainText("Hello World");

    const strongEl = editor.locator("strong");
    const strongBox = await strongEl.boundingBox();
    if (strongBox) {
      await captureWithAnnotation(
        page,
        "result-bold",
        [
          {
            rect: {
              x: strongBox.x,
              y: strongBox.y,
              width: strongBox.width,
              height: strongBox.height,
            },
            label: "Bold text",
            color: "green",
          },
        ],
        OUTPUT_DIR
      );
    } else {
      await captureStep(page, "result-bold", OUTPUT_DIR);
    }
  });
});
