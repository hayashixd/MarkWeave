/**
 * マニュアル用スクリーンショット撮影シナリオ: 執筆ツール
 * 対象: ポモドーロタイマー、ワードスプリント、文書統計
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/writing-tools";

test.describe("マニュアル撮影: 執筆ツール", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("執筆ツールをスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();
    await page.waitForTimeout(500);

    // テキストを入力して文書統計を有効にする
    const editor = page.locator(".ProseMirror, [contenteditable='true']").first();
    await editor.click();
    await page.keyboard.type(
      "MarkWeave の執筆ツールを使って、効率的に記事を書きましょう。ポモドーロタイマーで時間管理、ワードスプリントで集中力を高めることができます。"
    );
    await page.waitForTimeout(400);

    // ── Step 1: ポモドーロタイマー (ステータスバー) ──
    const statusBar = page
      .locator(".status-bar, [class*='status-bar'], [class*='StatusBar']")
      .first();
    const statusVisible = await statusBar.isVisible().catch(() => false);

    if (statusVisible) {
      // ポモドーロアイコンを探す
      const pomodoroBtn = page
        .locator(
          "[class*='pomodoro'], [data-testid*='pomodoro'], button[title*='ポモドーロ'], button[title*='Pomodoro']"
        )
        .first();
      const pomodoroVisible = await pomodoroBtn.isVisible().catch(() => false);

      if (pomodoroVisible) {
        // クリックしてタイマーを開く
        await pomodoroBtn.click();
        await page.waitForTimeout(500);

        const pomodoroWidget = page
          .locator("[class*='PomodoroTimer'], [class*='pomodoro-timer'], [class*='pomodoro-widget']")
          .first();
        const widgetVisible = await pomodoroWidget.isVisible().catch(() => false);

        if (widgetVisible) {
          const box = await pomodoroWidget.boundingBox();
          if (box) {
            await captureWithAnnotation(
              page,
              "pomodoro-timer",
              [
                {
                  rect: { x: box.x, y: box.y, width: box.width, height: box.height },
                  label: "ポモドーロタイマー — ステータスバーから起動",
                  color: "red",
                },
              ],
              OUTPUT_DIR
            );
          } else {
            await captureStep(page, "pomodoro-timer", OUTPUT_DIR);
          }
          // タイマーを閉じる
          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
        } else {
          await captureStep(page, "pomodoro-timer", OUTPUT_DIR);
        }
      } else {
        // ステータスバー全体を撮影
        const statusBox = await statusBar.boundingBox();
        if (statusBox) {
          await captureWithAnnotation(
            page,
            "pomodoro-timer",
            [
              {
                rect: { x: statusBox.x, y: statusBox.y, width: statusBox.width, height: statusBox.height },
                label: "ステータスバー — ポモドーロアイコンをクリック",
                color: "red",
              },
            ],
            OUTPUT_DIR
          );
        } else {
          await captureStep(page, "pomodoro-timer", OUTPUT_DIR);
        }
      }
    } else {
      await captureStep(page, "pomodoro-timer", OUTPUT_DIR);
    }

    // ── Step 2: ワードスプリント (ステータスバー) ──
    const wordSprintBtn = page
      .locator(
        "[class*='word-sprint'], [class*='WordSprint'], [data-testid*='word-sprint'], button[title*='スプリント'], button[title*='Sprint']"
      )
      .first();
    const sprintBtnVisible = await wordSprintBtn.isVisible().catch(() => false);

    if (sprintBtnVisible) {
      await wordSprintBtn.click();
      await page.waitForTimeout(500);

      const sprintWidget = page
        .locator("[class*='WordSprintWidget'], [class*='word-sprint-widget']")
        .first();
      const sprintVisible = await sprintWidget.isVisible().catch(() => false);

      if (sprintVisible) {
        const box = await sprintWidget.boundingBox();
        if (box) {
          await captureWithAnnotation(
            page,
            "word-sprint-widget",
            [
              {
                rect: { x: box.x, y: box.y, width: box.width, height: box.height },
                label: "ワードスプリント — 目標時間・文字数を設定",
                color: "green",
              },
            ],
            OUTPUT_DIR
          );
        } else {
          await captureStep(page, "word-sprint-widget", OUTPUT_DIR);
        }
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      } else {
        await captureStep(page, "word-sprint-widget", OUTPUT_DIR);
      }
    } else {
      await captureStep(page, "word-sprint-widget", OUTPUT_DIR);
    }

    // ── Step 3: 文書統計ダイアログ ──
    // 編集メニューから「文書統計」を選択
    const editMenu = page.getByRole("menuitem", { name: /編集|Edit/ }).first();
    const editMenuVisible = await editMenu.isVisible().catch(() => false);

    if (editMenuVisible) {
      await editMenu.click();
      await page.waitForTimeout(300);

      const statsItem = page
        .getByRole("menuitem", { name: /文書統計|statistics|stats/i })
        .first();
      const statsVisible = await statsItem.isVisible().catch(() => false);

      if (statsVisible) {
        await statsItem.click();
        await page.waitForTimeout(500);

        const statsDialog = page
          .locator("[role='dialog'], .modal, [class*='stats-dialog'], [class*='StatsDialog']")
          .first();
        const dialogVisible = await statsDialog.isVisible().catch(() => false);

        if (dialogVisible) {
          const box = await statsDialog.boundingBox();
          if (box) {
            await captureWithAnnotation(
              page,
              "doc-stats-dialog",
              [
                {
                  rect: { x: box.x, y: box.y, width: box.width, height: box.height },
                  label: "文書統計 — 文字数・読了時間・可読性スコア",
                  color: "blue",
                },
              ],
              OUTPUT_DIR
            );
          } else {
            await captureStep(page, "doc-stats-dialog", OUTPUT_DIR);
          }
          await page.keyboard.press("Escape");
        } else {
          await captureStep(page, "doc-stats-dialog", OUTPUT_DIR);
        }
      } else {
        await captureStep(page, "doc-stats-dialog", OUTPUT_DIR);
        await page.keyboard.press("Escape");
      }
    } else {
      await captureStep(page, "doc-stats-dialog", OUTPUT_DIR);
    }
  });
});
