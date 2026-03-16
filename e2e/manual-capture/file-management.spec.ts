/**
 * マニュアル用スクリーンショット撮影シナリオ: ファイル管理の応用
 * 対象: 最近使ったファイル、デイリーノート、テンプレート、別名で保存、印刷
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/file-management";

test.describe("マニュアル撮影: ファイル管理の応用", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("ファイル管理機能をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();
    await page.waitForTimeout(500);

    // ── Step 1: 最近使ったファイルメニュー ──
    // ファイルメニューを開く
    const fileMenu = page.locator("[data-tauri-drag-region], .menubar, [class*='menu-bar']").first();
    const fileMenuBtn = page.getByRole("menuitem", { name: /ファイル|File/ }).first();
    const fileMenuBtnVisible = await fileMenuBtn.isVisible().catch(() => false);

    if (fileMenuBtnVisible) {
      await fileMenuBtn.click();
      await page.waitForTimeout(300);

      const recentItem = page.getByRole("menuitem", { name: /最近使ったファイル|recent/i }).first();
      const recentVisible = await recentItem.isVisible().catch(() => false);
      if (recentVisible) {
        await recentItem.hover();
        await page.waitForTimeout(300);
        await captureWithAnnotation(
          page,
          "recent-files-menu",
          [
            {
              rect: await recentItem.boundingBox().catch(() => null) ?? { x: 0, y: 0, width: 200, height: 30 },
              label: "最近使ったファイル",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      } else {
        await captureStep(page, "recent-files-menu", OUTPUT_DIR);
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    } else {
      await captureStep(page, "recent-files-menu", OUTPUT_DIR);
    }

    // ── Step 2: デイリーノート ──
    // Ctrl+Alt+D でデイリーノートを作成
    await page.keyboard.press("Control+Alt+d");
    await page.waitForTimeout(600);

    const tabBar = page.locator(".tab-bar, [class*='tab-bar'], [class*='TabBar']").first();
    const tabBarBox = await tabBar.boundingBox().catch(() => null);
    if (tabBarBox) {
      await captureWithAnnotation(
        page,
        "daily-note-created",
        [
          {
            rect: { x: tabBarBox.x, y: tabBarBox.y, width: tabBarBox.width, height: tabBarBox.height },
            label: "デイリーノートタブ (日付ファイル名)",
            color: "green",
          },
        ],
        OUTPUT_DIR
      );
    } else {
      await captureStep(page, "daily-note-created", OUTPUT_DIR);
    }

    // ── Step 3: テンプレートダイアログ ──
    // ファイルメニューからテンプレート新規作成
    const fileMenuBtn2 = page.getByRole("menuitem", { name: /ファイル|File/ }).first();
    const menuBtn2Visible = await fileMenuBtn2.isVisible().catch(() => false);
    if (menuBtn2Visible) {
      await fileMenuBtn2.click();
      await page.waitForTimeout(300);
      const templateItem = page.getByRole("menuitem", { name: /テンプレート|template/i }).first();
      const templateVisible = await templateItem.isVisible().catch(() => false);
      if (templateVisible) {
        await templateItem.click();
        await page.waitForTimeout(500);
        const dialog = page.locator("[role='dialog'], .modal, [class*='dialog'], [class*='Dialog']").first();
        const dialogVisible = await dialog.isVisible().catch(() => false);
        if (dialogVisible) {
          await captureWithAnnotation(
            page,
            "template-dialog",
            [
              {
                rect: await dialog.boundingBox() ?? { x: 100, y: 100, width: 400, height: 300 },
                label: "テンプレート選択",
                color: "purple",
              },
            ],
            OUTPUT_DIR
          );
          await page.keyboard.press("Escape");
        } else {
          await captureStep(page, "template-dialog", OUTPUT_DIR);
        }
      } else {
        await captureStep(page, "template-dialog", OUTPUT_DIR);
        await page.keyboard.press("Escape");
      }
    } else {
      await captureStep(page, "template-dialog", OUTPUT_DIR);
    }

    // ── Step 4: Markdown として保存ダイアログ ──
    await page.keyboard.press("Control+Shift+m");
    await page.waitForTimeout(500);
    const saveDialog = page.locator("[role='dialog'], .modal, [class*='dialog'], [class*='Dialog']").first();
    const saveDialogVisible = await saveDialog.isVisible().catch(() => false);
    if (saveDialogVisible) {
      await captureWithAnnotation(
        page,
        "save-as-markdown",
        [
          {
            rect: await saveDialog.boundingBox() ?? { x: 100, y: 100, width: 400, height: 300 },
            label: "Markdown として保存",
            color: "orange",
          },
        ],
        OUTPUT_DIR
      );
      await page.keyboard.press("Escape");
    } else {
      await captureStep(page, "save-as-markdown", OUTPUT_DIR);
    }

    // ── Step 5: 印刷ダイアログ（全体スクリーンショット） ──
    // 印刷ダイアログはOSネイティブのため、メニューの状態だけ撮影
    const fileMenuBtn3 = page.getByRole("menuitem", { name: /ファイル|File/ }).first();
    const menuBtn3Visible = await fileMenuBtn3.isVisible().catch(() => false);
    if (menuBtn3Visible) {
      await fileMenuBtn3.click();
      await page.waitForTimeout(300);
      const printItem = page.getByRole("menuitem", { name: /印刷|print/i }).first();
      const printVisible = await printItem.isVisible().catch(() => false);
      if (printVisible) {
        await captureWithAnnotation(
          page,
          "print-dialog",
          [
            {
              rect: await printItem.boundingBox() ?? { x: 0, y: 0, width: 200, height: 30 },
              label: "印刷 (Ctrl+P)",
              color: "red",
            },
          ],
          OUTPUT_DIR
        );
      } else {
        await captureStep(page, "print-dialog", OUTPUT_DIR);
      }
      await page.keyboard.press("Escape");
    } else {
      await captureStep(page, "print-dialog", OUTPUT_DIR);
    }
  });
});
