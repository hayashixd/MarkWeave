/**
 * マニュアル用スクリーンショット撮影シナリオ: コードブロック・引用・水平線
 *
 * 注意:
 * - コードブロックは WYSIWYG の InputRule (```lang + Enter) がテスト環境でハングするため、
 *   ソースモードのスクリーンショットで代替する。
 * - 引用・水平線は WYSIWYG の InputRule で直接入力する。
 * - モード切替は menu-editor-mode カスタムイベント経由（CodeMirror の Ctrl+/ 消費を回避）。
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/code-block";

async function switchToSource(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("menu-editor-mode", { detail: { mode: "source" } })
    );
  });
  await page.waitForTimeout(600);
}

test.describe("マニュアル撮影: コードブロック・引用・水平線", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test.setTimeout(60000);

  test("コードブロック・引用・水平線の使い方をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    const editor = page.locator(".ProseMirror");
    await editor.click();

    // ── Step 1: コードブロック（ソースモードで Markdown を入力してスクリーンショット） ──
    // WYSIWYG の ```lang + Enter InputRule はテスト環境でブラウザをハングさせるため
    // ソースモードで直接入力し、Markdown ソースの見た目を撮影する。
    await page.keyboard.type("# コードブロックのサンプル");
    await page.waitForTimeout(200);

    await switchToSource(page);

    const sourceEditor = page.locator(".cm-editor");
    const sourceActive = await sourceEditor.first().isVisible().catch(() => false);

    if (sourceActive) {
      await sourceEditor.first().click();
      await page.waitForTimeout(200);
      await page.keyboard.press("Control+End");
      await page.waitForTimeout(100);
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.keyboard.type("```javascript");
      await page.keyboard.press("Enter");
      await page.keyboard.type("function greet(name) {");
      await page.keyboard.press("Enter");
      await page.keyboard.type('  return "Hello, " + name;');
      await page.keyboard.press("Enter");
      await page.keyboard.type("}");
      await page.keyboard.press("Enter");
      await page.keyboard.type("```");
      await page.waitForTimeout(300);
    }

    // ソースモードのまま撮影（コードブロック Markdown の見た目を記録）
    await captureStep(page, "code-block-source", OUTPUT_DIR);

    // ── Step 2: 引用ブロック（WYSIWYG で InputRule 使用） ──
    // ページをリロードして WYSIWYG モードに戻す
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();
    await editor.click();

    await page.keyboard.type("> これは引用ブロックです。");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    await page.keyboard.type("> 複数行の引用を書くことができます。");
    await page.waitForTimeout(300);

    const blockquote = editor.locator("blockquote").first();
    const quoteVisible = await blockquote.isVisible().catch(() => false);

    if (quoteVisible) {
      const quoteBox = await blockquote.boundingBox();
      if (quoteBox) {
        await captureWithAnnotation(
          page,
          "blockquote-result",
          [
            {
              rect: { x: quoteBox.x, y: quoteBox.y, width: quoteBox.width, height: quoteBox.height },
              label: "引用ブロック (> text)",
              color: "green",
            },
          ],
          OUTPUT_DIR
        );
      } else {
        await captureStep(page, "blockquote-result", OUTPUT_DIR);
      }
    } else {
      await captureStep(page, "blockquote-result", OUTPUT_DIR);
    }

    // ── Step 3: 水平線（WYSIWYG で InputRule 使用） ──
    // 引用ブロックを抜ける
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);
    await page.keyboard.type("水平線の前のテキスト");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);
    await page.keyboard.type("---");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    await page.keyboard.type("水平線の下のテキスト");
    await page.waitForTimeout(300);

    const hr = editor.locator("hr").first();
    const hrVisible = await hr.isVisible().catch(() => false);

    if (hrVisible) {
      const hrBox = await hr.boundingBox();
      if (hrBox) {
        await captureWithAnnotation(
          page,
          "horizontal-rule",
          [
            {
              rect: { x: hrBox.x, y: hrBox.y - 10, width: hrBox.width, height: 30 },
              label: "水平線 (---)",
              color: "orange",
            },
          ],
          OUTPUT_DIR
        );
      } else {
        await captureStep(page, "horizontal-rule", OUTPUT_DIR);
      }
    } else {
      await captureStep(page, "horizontal-rule", OUTPUT_DIR);
    }

    await captureStep(page, "blocks-overview", OUTPUT_DIR);
  });
});
