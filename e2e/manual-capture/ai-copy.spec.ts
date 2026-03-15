/**
 * マニュアル用スクリーンショット撮影シナリオ: AI コピー機能
 *
 * 対象機能:
 *   - ✨ AI コピーボタン（ツールバー右端）
 *   - 最適化オプションのドロップダウン
 *   - 最適化レポートのポップオーバー
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/ai-copy";

test.describe("マニュアル撮影: AI コピー機能", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("AI コピー機能の使い方をスクリーンショットで記録する", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    const editor = page.locator(".ProseMirror");
    await editor.click();

    // ── テスト用コンテンツを入力 ──
    await page.keyboard.type("# AI コピー機能のサンプル");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("このMarkdownをAIに貼り付けやすい形式に最適化してコピーできます。");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("## 主な最適化内容");
    await page.keyboard.press("Enter");
    await page.keyboard.type("- 見出し階層の修正");
    await page.keyboard.press("Enter");
    await page.keyboard.type("- コードブロックへの言語タグ付与");
    await page.keyboard.press("Enter");
    await page.keyboard.type("- 過剰な空白行の削除");
    await page.waitForTimeout(400);

    // ── Step 1: ツールバーの AI コピーボタンを確認 ──
    const aiCopyBtn = page.locator(".ai-copy-button").first();
    const btnVisible = await aiCopyBtn.isVisible().catch(() => false);

    if (btnVisible) {
      const btnBox = await aiCopyBtn.boundingBox();
      if (btnBox) {
        await captureWithAnnotation(
          page,
          "ai-copy-button-toolbar",
          [
            {
              rect: { x: btnBox.x - 4, y: btnBox.y - 4, width: btnBox.width + 40, height: btnBox.height + 8 },
              label: "✨ AI コピーボタン",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      }
    } else {
      await captureStep(page, "ai-copy-button-toolbar", OUTPUT_DIR);
    }

    // ── Step 2: ドロップダウントリガーをクリックしてオプションを表示 ──
    const dropdownTrigger = page.locator(".ai-copy-button__dropdown-trigger").first();
    const triggerVisible = await dropdownTrigger.isVisible().catch(() => false);

    if (triggerVisible) {
      await dropdownTrigger.click();
      await page.waitForTimeout(300);

      const dropdown = page.locator(".ai-copy-button__dropdown").first();
      const ddVisible = await dropdown.isVisible().catch(() => false);

      if (ddVisible) {
        const ddBox = await dropdown.boundingBox();
        if (ddBox) {
          await captureWithAnnotation(
            page,
            "ai-copy-options-dropdown",
            [
              {
                rect: { x: ddBox.x - 4, y: ddBox.y - 4, width: ddBox.width + 8, height: ddBox.height + 8 },
                label: "最適化オプション",
                color: "purple",
              },
            ],
            OUTPUT_DIR
          );
        }
      } else {
        await captureStep(page, "ai-copy-options-dropdown", OUTPUT_DIR);
      }

      // ドロップダウンを閉じる
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    } else {
      await captureStep(page, "ai-copy-options-dropdown", OUTPUT_DIR);
    }

    // ── Step 3: 「最適化プレビューを表示してからコピー」でレポートを表示 ──
    // ドロップダウンを再度開いてプレビュー付きコピーを実行
    const dropdownTrigger2 = page.locator(".ai-copy-button__dropdown-trigger").first();
    const triggerVisible2 = await dropdownTrigger2.isVisible().catch(() => false);

    if (triggerVisible2) {
      await dropdownTrigger2.click();
      await page.waitForTimeout(300);

      // "最適化プレビューを表示してからコピー" ボタン
      const previewBtn = page.locator(".ai-copy-button__dropdown button").nth(1);
      const previewBtnVisible = await previewBtn.isVisible().catch(() => false);

      if (previewBtnVisible) {
        await previewBtn.click();
        await page.waitForTimeout(600);

        const reportPopover = page.locator(".optimization-report-popover, [aria-label='最適化レポート']").first();
        const reportVisible = await reportPopover.isVisible().catch(() => false);

        if (reportVisible) {
          const reportBox = await reportPopover.boundingBox();
          if (reportBox) {
            await captureWithAnnotation(
              page,
              "ai-copy-report-popover",
              [
                {
                  rect: { x: reportBox.x - 4, y: reportBox.y - 4, width: reportBox.width + 8, height: reportBox.height + 8 },
                  label: "最適化レポート",
                  color: "green",
                },
              ],
              OUTPUT_DIR
            );
          }
          // レポートを閉じる
          const closeBtn = reportPopover.locator("button[aria-label='閉じる'], button:has-text('閉じる')").first();
          await closeBtn.click().catch(() => page.keyboard.press("Escape"));
        } else {
          await captureStep(page, "ai-copy-report-popover", OUTPUT_DIR);
        }
      } else {
        await page.keyboard.press("Escape");
        await captureStep(page, "ai-copy-report-popover", OUTPUT_DIR);
      }
    } else {
      await captureStep(page, "ai-copy-report-popover", OUTPUT_DIR);
    }

    // ── Step 4: メインの AI コピーボタンをクリックしてコピー済み状態を撮影 ──
    const aiCopyBtn2 = page.locator(".ai-copy-button").first();
    const btn2Visible = await aiCopyBtn2.isVisible().catch(() => false);

    if (btn2Visible) {
      await aiCopyBtn2.click();
      await page.waitForTimeout(400);

      // "コピー済み ✓" 状態を撮影
      const btnBox2 = await aiCopyBtn2.boundingBox();
      if (btnBox2) {
        await captureWithAnnotation(
          page,
          "ai-copy-copied-state",
          [
            {
              rect: { x: btnBox2.x - 4, y: btnBox2.y - 4, width: btnBox2.width + 40, height: btnBox2.height + 8 },
              label: "コピー完了",
              color: "green",
            },
          ],
          OUTPUT_DIR
        );
      }
    } else {
      await captureStep(page, "ai-copy-copied-state", OUTPUT_DIR);
    }

    await captureStep(page, "ai-copy-overview", OUTPUT_DIR);
  });
});
