/**
 * マニュアル用スクリーンショット撮影シナリオ: ワークスペース・ファイルツリー
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/workspace";

test.describe("マニュアル撮影: ワークスペース・ファイルツリー", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("ワークスペースとファイルツリーの使い方をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();
    await page.waitForTimeout(500);

    // ── Step 1: サイドバーの全体表示 ──
    const sidebar = page.locator(".sidebar, [class*='sidebar'], [class*='Sidebar']").first();
    const sidebarVisible = await sidebar.isVisible().catch(() => false);

    if (sidebarVisible) {
      const sidebarBox = await sidebar.boundingBox();
      if (sidebarBox) {
        await captureWithAnnotation(
          page,
          "sidebar-overview",
          [
            {
              rect: { x: sidebarBox.x, y: sidebarBox.y, width: sidebarBox.width, height: sidebarBox.height },
              label: "サイドバー",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      }
    } else {
      await captureStep(page, "sidebar-overview", OUTPUT_DIR);
    }

    // ── Step 2: ファイルツリーパネル ──
    const fileTree = page.locator(".file-tree-panel, [class*='file-tree'], [class*='FileTree']").first();
    const treeVisible = await fileTree.isVisible().catch(() => false);

    if (treeVisible) {
      const treeBox = await fileTree.boundingBox();
      if (treeBox) {
        await captureWithAnnotation(
          page,
          "file-tree-panel",
          [
            {
              rect: { x: treeBox.x, y: treeBox.y, width: treeBox.width, height: treeBox.height },
              label: "ファイルツリー",
              color: "green",
            },
          ],
          OUTPUT_DIR
        );
      }

      // ファイルツリーノードの右クリックメニュー
      const treeNode = fileTree.locator("[class*='tree-node'], [class*='file-item']").first();
      const nodeVisible = await treeNode.isVisible().catch(() => false);
      if (nodeVisible) {
        await treeNode.click({ button: "right" });
        await page.waitForTimeout(400);

        const contextMenu = page.locator("[role='menu'], .context-menu, .fixed.z-50.bg-white").first();
        const menuVisible = await contextMenu.isVisible().catch(() => false);
        if (menuVisible) {
          const menuBox = await contextMenu.boundingBox();
          if (menuBox) {
            await captureWithAnnotation(
              page,
              "file-tree-context-menu",
              [
                {
                  rect: { x: menuBox.x, y: menuBox.y, width: menuBox.width, height: menuBox.height },
                  label: "ファイル操作メニュー",
                  color: "purple",
                },
              ],
              OUTPUT_DIR
            );
          }
          await page.keyboard.press("Escape");
        } else {
          await captureStep(page, "file-tree-context-menu", OUTPUT_DIR);
        }
      }
    } else {
      await captureStep(page, "file-tree-panel", OUTPUT_DIR);
    }

    // ── Step 3: ステータスバー ──
    const statusBar = page.locator(".status-bar, [class*='status-bar'], [class*='StatusBar']").first();
    const statusVisible = await statusBar.isVisible().catch(() => false);

    if (statusVisible) {
      const statusBox = await statusBar.boundingBox();
      if (statusBox) {
        await captureWithAnnotation(
          page,
          "status-bar",
          [
            {
              rect: { x: statusBox.x, y: statusBox.y, width: statusBox.width, height: statusBox.height },
              label: "ステータスバー",
              color: "orange",
            },
          ],
          OUTPUT_DIR
        );
      }
    }

    await captureStep(page, "workspace-overview", OUTPUT_DIR);
  });
});
