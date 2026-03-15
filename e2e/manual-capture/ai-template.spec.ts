/**
 * マニュアル用スクリーンショット撮影シナリオ: AI テンプレートパネル
 *
 * 対象機能:
 *   - AI テンプレートパネル（サイドバー "AI" タブ）
 *   - カテゴリフィルタ・キーワード検索
 *   - テンプレートプレビュー
 *   - プレースホルダー入力ダイアログ
 *   - カスタムテンプレート作成
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/ai-template";

test.describe("マニュアル撮影: AI テンプレートパネル", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("AI テンプレートパネルの使い方をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    // エディタにコンテキスト用コンテンツを入力
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("# ドキュメント");
    await page.keyboard.press("Enter");
    await page.keyboard.type("AI テンプレートを使って素早くコンテンツを作成できます。");
    await page.waitForTimeout(300);

    // ── Step 1: AI テンプレートパネルを開く ──
    // メニューイベント（tauri-menu-action フォールバック）で AI タブを開く
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("tauri-menu-action", { detail: "view_ai_templates" }));
    });
    await page.waitForTimeout(600);

    const templatePanel = page.locator(".template-panel, [aria-label='AIテンプレート']").first();
    const panelVisible = await templatePanel.isVisible().catch(() => false);

    if (panelVisible) {
      const panelBox = await templatePanel.boundingBox();
      if (panelBox) {
        await captureWithAnnotation(
          page,
          "ai-template-panel-open",
          [
            {
              rect: { x: panelBox.x - 2, y: panelBox.y - 2, width: panelBox.width + 4, height: panelBox.height + 4 },
              label: "AI テンプレートパネル",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      }
    } else {
      await captureStep(page, "ai-template-panel-open", OUTPUT_DIR);
    }

    // ── Step 2: カテゴリフィルタ（ブログ）を選択 ──
    const blogTab = page.locator(".template-panel__categories button, [class*='category']")
      .filter({ hasText: "ブログ" }).first();
    const blogTabVisible = await blogTab.isVisible().catch(() => false);

    if (blogTabVisible) {
      await blogTab.click();
      await page.waitForTimeout(300);

      const categoryBox = await blogTab.boundingBox();
      if (categoryBox) {
        await captureWithAnnotation(
          page,
          "ai-template-category-filter",
          [
            {
              rect: { x: categoryBox.x - 4, y: categoryBox.y - 4, width: categoryBox.width + 8, height: categoryBox.height + 8 },
              label: "カテゴリ選択",
              color: "purple",
            },
          ],
          OUTPUT_DIR
        );
      }
    } else {
      await captureStep(page, "ai-template-category-filter", OUTPUT_DIR);
    }

    // ── Step 3: テンプレートを選択してプレビューを表示 ──
    const firstTemplate = page.locator(".template-panel__list-item, [class*='template-item']").first();
    const templateVisible = await firstTemplate.isVisible().catch(() => false);

    if (templateVisible) {
      await firstTemplate.click();
      await page.waitForTimeout(400);

      // プレビューエリアを強調
      const preview = page.locator(".template-panel__preview, [class*='template-preview']").first();
      const previewVisible = await preview.isVisible().catch(() => false);

      if (previewVisible) {
        const previewBox = await preview.boundingBox();
        if (previewBox) {
          await captureWithAnnotation(
            page,
            "ai-template-preview",
            [
              {
                rect: { x: previewBox.x - 2, y: previewBox.y - 2, width: previewBox.width + 4, height: previewBox.height + 4 },
                label: "テンプレートプレビュー",
                color: "green",
              },
            ],
            OUTPUT_DIR
          );
        }
      } else {
        await captureStep(page, "ai-template-preview", OUTPUT_DIR);
      }

      // ── Step 4: 挿入ボタンをクリックしてプレースホルダーダイアログを表示 ──
      const insertBtn = page.locator(".template-panel__insert-btn, button:has-text('挿入')").first();
      const insertBtnVisible = await insertBtn.isVisible().catch(() => false);

      if (insertBtnVisible) {
        await insertBtn.click();
        await page.waitForTimeout(400);

        const placeholderDialog = page.locator("[class*='placeholder-dialog'], [aria-label*='プレースホルダー'], [class*='template-dialog']").first();
        const dialogVisible = await placeholderDialog.isVisible().catch(() => false);

        if (dialogVisible) {
          const dialogBox = await placeholderDialog.boundingBox();
          if (dialogBox) {
            await captureWithAnnotation(
              page,
              "ai-template-placeholder-dialog",
              [
                {
                  rect: { x: dialogBox.x - 4, y: dialogBox.y - 4, width: dialogBox.width + 8, height: dialogBox.height + 8 },
                  label: "プレースホルダー入力",
                  color: "blue",
                },
              ],
              OUTPUT_DIR
            );
          }
          await page.keyboard.press("Escape");
        } else {
          await captureStep(page, "ai-template-placeholder-dialog", OUTPUT_DIR);
        }
      } else {
        await captureStep(page, "ai-template-placeholder-dialog", OUTPUT_DIR);
      }
    } else {
      await captureStep(page, "ai-template-preview", OUTPUT_DIR);
      await captureStep(page, "ai-template-placeholder-dialog", OUTPUT_DIR);
    }

    // ── Step 5: キーワード検索 ──
    const searchInput = page.locator(".template-panel__search input, input[type='search']").first();
    const searchVisible = await searchInput.isVisible().catch(() => false);

    if (searchVisible) {
      await searchInput.click();
      await searchInput.fill("ブログ");
      await page.waitForTimeout(400);

      const searchBox = await searchInput.boundingBox();
      if (searchBox) {
        await captureWithAnnotation(
          page,
          "ai-template-search",
          [
            {
              rect: { x: searchBox.x - 4, y: searchBox.y - 4, width: searchBox.width + 8, height: searchBox.height + 8 },
              label: "キーワード検索",
              color: "orange",
            },
          ],
          OUTPUT_DIR
        );
      }
      await searchInput.fill("");
    } else {
      await captureStep(page, "ai-template-search", OUTPUT_DIR);
    }

    // ── Step 6: カスタムテンプレート作成ボタン ──
    const newBtn = page.locator(".template-panel__new-btn, button[aria-label='新規テンプレート']").first();
    const newBtnVisible = await newBtn.isVisible().catch(() => false);

    if (newBtnVisible) {
      const newBtnBox = await newBtn.boundingBox();
      if (newBtnBox) {
        await captureWithAnnotation(
          page,
          "ai-template-new-button",
          [
            {
              rect: { x: newBtnBox.x - 4, y: newBtnBox.y - 4, width: newBtnBox.width + 8, height: newBtnBox.height + 8 },
              label: "新規テンプレート作成",
              color: "purple",
            },
          ],
          OUTPUT_DIR
        );
      }

      // 新規テンプレートエディタを開く
      await newBtn.click();
      await page.waitForTimeout(400);

      const templateEditor = page.locator("[class*='template-editor'], [aria-label*='テンプレート編集']").first();
      const editorVisible = await templateEditor.isVisible().catch(() => false);

      if (editorVisible) {
        const editorBox = await templateEditor.boundingBox();
        if (editorBox) {
          await captureWithAnnotation(
            page,
            "ai-template-custom-editor",
            [
              {
                rect: { x: editorBox.x - 4, y: editorBox.y - 4, width: editorBox.width + 8, height: editorBox.height + 8 },
                label: "カスタムテンプレートエディタ",
                color: "blue",
              },
            ],
            OUTPUT_DIR
          );
        }
        await page.keyboard.press("Escape");
      } else {
        await captureStep(page, "ai-template-custom-editor", OUTPUT_DIR);
      }
    } else {
      await captureStep(page, "ai-template-new-button", OUTPUT_DIR);
      await captureStep(page, "ai-template-custom-editor", OUTPUT_DIR);
    }

    await captureStep(page, "ai-template-overview", OUTPUT_DIR);
  });
});
