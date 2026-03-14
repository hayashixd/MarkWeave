/**
 * マニュアル用スクリーンショット撮影シナリオ: テーブル編集
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/tables";

test.describe("マニュアル撮影: テーブル編集", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("テーブル編集の手順をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    const editor = page.locator(".ProseMirror");
    await editor.click();

    // ── Step 1: スラッシュコマンドでテーブルを挿入 ──
    await page.keyboard.type("# テーブルの例");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");
    await page.waitForTimeout(400);

    const slashMenu = page.locator(".slash-command-menu");
    const slashVisible = await slashMenu.isVisible().catch(() => false);
    if (slashVisible) {
      await captureWithAnnotation(
        page,
        "slash-command-menu",
        [
          {
            rect: await slashMenu.boundingBox().then(b => b ?? { x: 0, y: 0, width: 200, height: 200 }),
            label: "スラッシュコマンド",
            color: "blue",
          },
        ],
        OUTPUT_DIR
      );
      // テーブルを検索して選択
      await page.keyboard.type("table");
      await page.waitForTimeout(400);
      await page.keyboard.press("Enter");
      // テーブル挿入の完了を待つ
      await editor.locator("table").waitFor({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
    } else {
      // スラッシュメニューが出ない場合: Markdownで直接テーブルを作成
      await page.keyboard.press("Escape");
      await page.keyboard.press("Backspace");
      // Markdownテーブルを直接入力
      await page.keyboard.type("| 名前 | 年齢 | 職業 |");
      await page.keyboard.press("Enter");
      await page.keyboard.type("| --- | --- | --- |");
      await page.keyboard.press("Enter");
      await page.keyboard.type("| 田中 | 30 | エンジニア |");
      await page.keyboard.press("Enter");
      await page.keyboard.type("| 鈴木 | 25 | デザイナー |");
      await page.waitForTimeout(500);
    }

    await captureStep(page, "table-created", OUTPUT_DIR);

    // ── Step 2: テーブル内でのTab移動 ──
    const table = editor.locator("table").first();
    const tableVisible = await table.isVisible().catch(() => false);

    if (tableVisible) {
      // テーブルの最初のセルをクリック
      const firstCell = editor.locator("table td, table th").first();
      await firstCell.click();

      const cellBox = await firstCell.boundingBox();
      if (cellBox) {
        await captureWithAnnotation(
          page,
          "table-cell-focus",
          [
            {
              rect: { x: cellBox.x, y: cellBox.y, width: cellBox.width, height: cellBox.height },
              label: "セル選択 (Tab で移動)",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      }

      // Tab でセル移動
      await page.keyboard.press("Tab");
      await page.waitForTimeout(200);
      await captureStep(page, "table-tab-navigation", OUTPUT_DIR);

      // ── Step 3: テーブルの右クリックコンテキストメニュー ──
      const tableEl = editor.locator("table td").first();
      await tableEl.click({ button: "right" });
      await page.waitForTimeout(400);

      const contextMenu = page.locator(".table-context-menu, [role='menu']").first();
      const menuVisible = await contextMenu.isVisible().catch(() => false);
      if (menuVisible) {
        const menuBox = await contextMenu.boundingBox();
        if (menuBox) {
          await captureWithAnnotation(
            page,
            "table-context-menu",
            [
              {
                rect: { x: menuBox.x, y: menuBox.y, width: menuBox.width, height: menuBox.height },
                label: "テーブル操作メニュー",
                color: "purple",
              },
            ],
            OUTPUT_DIR
          );
        }
        await page.keyboard.press("Escape");
      } else {
        await captureStep(page, "table-context-menu", OUTPUT_DIR);
        await page.keyboard.press("Escape");
      }

      // ── Step 4: テーブル全体の表示 ──
      await captureStep(page, "table-overview", OUTPUT_DIR);
    } else {
      await captureStep(page, "table-overview", OUTPUT_DIR);
    }
  });
});
