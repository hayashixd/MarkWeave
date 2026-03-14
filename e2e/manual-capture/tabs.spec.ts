/**
 * マニュアル用スクリーンショット撮影シナリオ: タブ管理
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/tabs";

test.describe("マニュアル撮影: タブ管理", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("タブ管理の手順をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    // ── Step 1: タブバーの初期状態を撮影 ──
    const tabBar = page.locator(".tab-bar");
    const tabBarVisible = await tabBar.isVisible().catch(() => false);

    if (tabBarVisible) {
      const tabBarBox = await tabBar.boundingBox();
      if (tabBarBox) {
        await captureWithAnnotation(
          page,
          "tabbar-overview",
          [
            {
              rect: { x: tabBarBox.x, y: tabBarBox.y, width: tabBarBox.width, height: tabBarBox.height },
              label: "タブバー",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      }
    } else {
      await captureStep(page, "tabbar-overview", OUTPUT_DIR);
    }

    // ── Step 2: 最初のタブにテキストを入力して未保存マーカーを表示 ──
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("# 最初のドキュメント");
    await page.keyboard.press("Enter");
    await page.keyboard.type("これはタブ1のコンテンツです。");
    await page.waitForTimeout(300);

    // 未保存マーカーを含むタブを撮影
    const activeTab = page.locator(".tab-item").first();
    const tabBox = await activeTab.boundingBox().catch(() => null);
    if (tabBox) {
      await captureWithAnnotation(
        page,
        "tab-unsaved-marker",
        [
          {
            rect: { x: tabBox.x, y: tabBox.y, width: tabBox.width, height: tabBox.height },
            label: "未保存マーカー (●)",
            color: "orange",
          },
        ],
        OUTPUT_DIR
      );
    } else {
      await captureStep(page, "tab-unsaved-marker", OUTPUT_DIR);
    }

    // ── Step 3: 新規タブを開く (+ボタン) ──
    const newTabBtn = page.locator(".tab-bar button[title*='新規'], .tab-bar button[title*='New'], .tab-bar .text-lg").first();
    const newTabBtnVisible = await newTabBtn.isVisible().catch(() => false);
    if (newTabBtnVisible) {
      const btnBox = await newTabBtn.boundingBox();
      if (btnBox) {
        await captureWithAnnotation(
          page,
          "new-tab-button",
          [
            {
              rect: { x: btnBox.x, y: btnBox.y, width: btnBox.width, height: btnBox.height },
              label: "新規タブ",
              color: "green",
            },
          ],
          OUTPUT_DIR
        );
      }
      await newTabBtn.click();
      await page.waitForTimeout(400);
    } else {
      await captureStep(page, "new-tab-button", OUTPUT_DIR);
    }

    // ── Step 4: 複数タブの状態 ──
    await captureStep(page, "multiple-tabs", OUTPUT_DIR);

    // ── Step 5: タブの右クリックメニュー ──
    const firstTab = page.locator(".tab-item").first();
    await firstTab.click({ button: "right" });
    await page.waitForTimeout(400);

    const contextMenu = page.locator("[role='menu'], .fixed.z-50.bg-white").first();
    const menuVisible = await contextMenu.isVisible().catch(() => false);
    if (menuVisible) {
      const menuBox = await contextMenu.boundingBox();
      if (menuBox) {
        await captureWithAnnotation(
          page,
          "tab-context-menu",
          [
            {
              rect: { x: menuBox.x, y: menuBox.y, width: menuBox.width, height: menuBox.height },
              label: "タブ操作メニュー",
              color: "purple",
            },
          ],
          OUTPUT_DIR
        );
      }
      await page.keyboard.press("Escape");
    } else {
      await captureStep(page, "tab-context-menu", OUTPUT_DIR);
      await page.keyboard.press("Escape");
    }
  });
});
