/**
 * マニュアル用スクリーンショット撮影シナリオ: リストの作成
 *
 * 手順:
 *   1. 箇条書きリスト（「- 」記法）
 *   2. 番号付きリスト（「1. 」記法）
 *   3. タスクリスト（「- [ ] 」記法）
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/lists";

test.describe("マニュアル撮影: リスト作成", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("リスト作成の手順をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    const editor = page.locator(".ProseMirror");
    await editor.click();

    // ── Step 1: 箇条書きリスト ──
    await page.keyboard.type("- ");
    await page.waitForTimeout(200);
    await page.keyboard.type("リンゴ");
    await page.keyboard.press("Enter");
    await page.keyboard.type("バナナ");
    await page.keyboard.press("Enter");
    await page.keyboard.type("みかん");
    await expect(editor.locator("ul")).toBeVisible();

    const ulEl = editor.locator("ul").first();
    const ulBox = await ulEl.boundingBox();
    if (ulBox) {
      await captureWithAnnotation(
        page,
        "bullet-list",
        [
          {
            rect: { x: ulBox.x, y: ulBox.y, width: ulBox.width, height: ulBox.height },
            label: "箇条書きリスト (- )",
            color: "blue",
          },
        ],
        OUTPUT_DIR
      );
    } else {
      await captureStep(page, "bullet-list", OUTPUT_DIR);
    }

    // ── Step 2: 番号付きリスト ──
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter"); // リストを抜ける
    await page.keyboard.type("1. ");
    await page.waitForTimeout(200);
    await page.keyboard.type("はじめに準備する");
    await page.keyboard.press("Enter");
    await page.keyboard.type("次に実行する");
    await page.keyboard.press("Enter");
    await page.keyboard.type("最後に確認する");
    await expect(editor.locator("ol")).toBeVisible();

    const olEl = editor.locator("ol").first();
    const olBox = await olEl.boundingBox();
    if (olBox) {
      await captureWithAnnotation(
        page,
        "ordered-list",
        [
          {
            rect: { x: olBox.x, y: olBox.y, width: olBox.width, height: olBox.height },
            label: "番号付きリスト (1. )",
            color: "green",
          },
        ],
        OUTPUT_DIR
      );
    } else {
      await captureStep(page, "ordered-list", OUTPUT_DIR);
    }

    // ── Step 3: タスクリスト ──
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter"); // リストを抜ける
    await page.keyboard.type("- [ ] ");
    await page.waitForTimeout(200);
    await page.keyboard.type("未完了のタスク");
    await page.keyboard.press("Enter");
    await page.keyboard.type("- [x] ");
    await page.waitForTimeout(200);
    await page.keyboard.type("完了済みのタスク");
    await expect(editor.locator('[data-type="taskList"], ul[data-type="taskList"]')).toBeVisible().catch(async () => {
      // セレクターが異なる場合のフォールバック
    });

    await page.waitForTimeout(300);
    await captureStep(page, "task-list", OUTPUT_DIR);

    // ── Step 4: リストボタンをツールバーで強調 ──
    const bulletBtn = page.getByTitle(/箇条書き|Bullet|bullet/).first();
    const bulletBox = await bulletBtn.boundingBox().catch(() => null);
    if (bulletBox) {
      await captureWithAnnotation(
        page,
        "list-toolbar-buttons",
        [
          {
            rect: {
              x: bulletBox.x - 5,
              y: bulletBox.y - 5,
              width: bulletBox.width * 3 + 10,
              height: bulletBox.height + 10,
            },
            label: "リストボタン",
            color: "orange",
          },
        ],
        OUTPUT_DIR
      );
    } else {
      await captureStep(page, "list-toolbar-buttons", OUTPUT_DIR);
    }
  });
});
