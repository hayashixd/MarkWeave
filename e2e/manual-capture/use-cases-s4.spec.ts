/**
 * use-cases.html Scenario 4 用スクリーンショット撮影
 *
 * 出力先: docs/use-case-screenshots/s4-workspace/
 *   - workspace-filetree.png  … ファイルツリーパネル（サイドバー + ファイルツリー）
 *   - external-change.png     … 外部変更検知ダイアログ
 *
 * 使い方（アプリが起動していること: pnpm dev）:
 *   pnpm exec playwright test e2e/manual-capture/use-cases-s4.spec.ts --project=manual-capture
 * その後:
 *   node docs/generate-use-cases.cjs
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const OUTPUT_DIR = path.resolve(process.cwd(), "docs/use-case-screenshots/s4-workspace");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

test.describe("use-cases Scenario 4 スクリーンショット撮影", () => {
  test("workspace-filetree: ファイルツリーパネルを撮影", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();
    await page.waitForTimeout(800);

    // サイドバーを開く（▶ トグルボタンをクリック）
    const toggleBtn = page.locator('[aria-label="sidebar.open"], [aria-label="サイドバーを開く"]').first();
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await page.waitForTimeout(400);
    }

    // Files タブに切り替え
    const filesTab = page.locator('[aria-controls="sidebar-panel-files"]').first();
    if (await filesTab.isVisible()) {
      await filesTab.click();
      await page.waitForTimeout(400);
    }

    ensureDir(OUTPUT_DIR);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "workspace-filetree.png") });
  });

  test("external-change: 外部変更検知ダイアログを撮影", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();
    await page.waitForTimeout(800);

    // DEV モードのテストフックでダイアログを直接表示
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("__dev_external_change", {
          detail: { fileName: "my-article.md" },
        })
      );
    });
    await page.waitForTimeout(500);

    // ダイアログが表示されていることを確認
    await expect(
      page.locator('[role="dialog"][aria-label="ファイルが外部で変更されました"]')
    ).toBeVisible({ timeout: 3000 });

    ensureDir(OUTPUT_DIR);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "external-change.png") });
  });
});
