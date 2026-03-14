/**
 * マニュアル用スクリーンショット撮影シナリオ: 分割エディタ・フォーカスモード・Zenモード
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/split-editor";

test.describe("マニュアル撮影: 分割エディタ・フォーカスモード", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("分割エディタとフォーカスモードをスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    const editor = page.locator(".ProseMirror");
    await editor.click();

    // コンテンツを入力
    await page.keyboard.type("# 分割エディタのサンプル");
    await page.keyboard.press("Enter");
    await page.keyboard.type("このドキュメントを分割表示できます。");
    await page.keyboard.press("Enter");
    await page.keyboard.type("## セクション1");
    await page.keyboard.press("Enter");
    await page.keyboard.type("左のペインと右のペインで別々のファイルを開けます。");
    await page.waitForTimeout(300);

    // ── Step 1: 分割エディタを開く ──
    // メニューイベントを試みる
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("tauri-menu-action", { detail: "view_split_pane" }));
    });
    await page.waitForTimeout(600);

    const splitLayout = page.locator(".split-editor-layout, [class*='split'], [data-layout]").first();
    const splitVisible = await splitLayout.isVisible().catch(() => false);

    if (splitVisible) {
      const splitBox = await splitLayout.boundingBox();
      if (splitBox) {
        await captureWithAnnotation(
          page,
          "split-editor-active",
          [
            {
              rect: { x: splitBox.x, y: splitBox.y, width: splitBox.width, height: splitBox.height },
              label: "分割エディタ",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      }

      // スプリッタをハイライト
      const splitter = page.locator("[class*='splitter'], [class*='divider'], .cursor-col-resize, .cursor-row-resize").first();
      const splitterVisible = await splitter.isVisible().catch(() => false);
      if (splitterVisible) {
        const splitterBox = await splitter.boundingBox();
        if (splitterBox) {
          await captureWithAnnotation(
            page,
            "split-divider",
            [
              {
                rect: { x: splitterBox.x, y: splitterBox.y, width: splitterBox.width, height: splitterBox.height },
                label: "ドラッグでリサイズ",
                color: "green",
              },
            ],
            OUTPUT_DIR
          );
        }
      }
    } else {
      await captureStep(page, "split-editor-active", OUTPUT_DIR);
    }

    // ── Step 2: フォーカスモード ──
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("tauri-menu-action", { detail: "view_focus_mode" }));
    });
    await page.waitForTimeout(500);
    await captureStep(page, "focus-mode", OUTPUT_DIR);

    // フォーカスモードを解除
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("tauri-menu-action", { detail: "view_focus_mode" }));
    });
    await page.waitForTimeout(300);

    // ── Step 3: タイプライターモード ──
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("tauri-menu-action", { detail: "view_typewriter_mode" }));
    });
    await page.waitForTimeout(500);
    await captureStep(page, "typewriter-mode", OUTPUT_DIR);

    // タイプライターモードを解除
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("tauri-menu-action", { detail: "view_typewriter_mode" }));
    });

    await captureStep(page, "split-overview", OUTPUT_DIR);
  });
});
