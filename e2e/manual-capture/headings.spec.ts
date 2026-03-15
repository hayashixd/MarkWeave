/**
 * マニュアル用スクリーンショット撮影シナリオ: 見出しの入力
 *
 * 手順:
 *   1. アプリ起動
 *   2. 「# 」でH1を入力 → 撮影
 *   3. 「## 」でH2を入力 → 撮影
 *   4. ブロックタイプドロップダウンで見出し選択 → 撮影
 *   5. 結果確認 → 撮影
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/headings";

test.describe("マニュアル撮影: 見出し入力", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("見出し入力の手順をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    const editor = page.locator(".ProseMirror");
    await editor.click();

    // ── Step 1: H1を「# 」で入力 ──
    await page.keyboard.type("# ");
    await page.waitForTimeout(200);
    await page.keyboard.type("はじめに");
    await expect(editor.locator("h1")).toContainText("はじめに");

    const h1El = editor.locator("h1");
    const h1Box = await h1El.boundingBox();
    if (h1Box) {
      await captureWithAnnotation(
        page,
        "h1-result",
        [
          {
            rect: { x: h1Box.x, y: h1Box.y, width: h1Box.width, height: h1Box.height },
            label: "H1 見出し",
            color: "blue",
          },
        ],
        OUTPUT_DIR
      );
    } else {
      await captureStep(page, "h1-result", OUTPUT_DIR);
    }

    // ── Step 2: H2を「## 」で入力 ──
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("## ");
    await page.waitForTimeout(200);
    await page.keyboard.type("第1節");
    await expect(editor.locator("h2")).toContainText("第1節");

    const h2El = editor.locator("h2");
    const h2Box = await h2El.boundingBox();
    if (h2Box) {
      await captureWithAnnotation(
        page,
        "h2-result",
        [
          {
            rect: { x: h2Box.x, y: h2Box.y, width: h2Box.width, height: h2Box.height },
            label: "H2 見出し",
            color: "green",
          },
        ],
        OUTPUT_DIR
      );
    } else {
      await captureStep(page, "h2-result", OUTPUT_DIR);
    }

    // ── Step 3: H3を「### 」で入力 ──
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("### ");
    await page.waitForTimeout(200);
    await page.keyboard.type("概要");
    await expect(editor.locator("h3")).toContainText("概要");

    const h3El = editor.locator("h3");
    const h3Box = await h3El.boundingBox();
    if (h3Box) {
      await captureWithAnnotation(
        page,
        "h3-result",
        [
          {
            rect: { x: h3Box.x, y: h3Box.y, width: h3Box.width, height: h3Box.height },
            label: "H3 見出し",
            color: "orange",
          },
        ],
        OUTPUT_DIR
      );
    } else {
      await captureStep(page, "h3-result", OUTPUT_DIR);
    }

    // ── Step 4: ブロックタイプドロップダウンを強調して撮影 ──
    const dropdown = page.locator("select, [role='combobox']").first();
    const dropdownBox = await dropdown.boundingBox();
    if (dropdownBox) {
      await captureWithAnnotation(
        page,
        "block-type-dropdown",
        [
          {
            rect: {
              x: dropdownBox.x,
              y: dropdownBox.y,
              width: dropdownBox.width,
              height: dropdownBox.height,
            },
            label: "ブロックタイプ",
            color: "purple",
          },
        ],
        OUTPUT_DIR
      );
    } else {
      await captureStep(page, "block-type-dropdown", OUTPUT_DIR);
    }

    // ── Step 5: 全体の見出し一覧を撮影 ──
    await captureStep(page, "headings-overview", OUTPUT_DIR);
  });
});
