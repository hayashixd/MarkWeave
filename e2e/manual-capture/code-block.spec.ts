/**
 * マニュアル用スクリーンショット撮影シナリオ: コードブロック・引用・水平線
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/code-block";

test.describe("マニュアル撮影: コードブロック・引用・水平線", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("コードブロック・引用・水平線の使い方をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    const editor = page.locator(".ProseMirror");
    await editor.click();

    // ── Step 1: ソースモードでコードブロックを入力（WYSIWYG変換後のキーボードブロックを回避） ──
    await page.keyboard.type("# コードブロックのサンプル");
    await page.waitForTimeout(300);

    // ソースモードに切り替えてコードブロックを入力
    await page.keyboard.press("Control+/");
    await page.waitForTimeout(600);

    const sourceEditor = page.locator(".cm-editor");
    const sourceActive = await sourceEditor.first().isVisible().catch(() => false);

    if (sourceActive) {
      // CodeMirror がフォーカスを持つまで待機してからクリックでフォーカス確定
      await sourceEditor.first().click();
      await page.waitForTimeout(300);
      // ソースモードで末尾に移動してコードブロックを追加
      await page.keyboard.press("Control+End");
      await page.waitForTimeout(200);
      await page.keyboard.press("Enter");
      await page.keyboard.type("```javascript");
      await page.waitForTimeout(100);
      await page.keyboard.press("Enter");
      await page.keyboard.type("function greet(name) {");
      await page.waitForTimeout(100);
      await page.keyboard.press("Enter");
      await page.keyboard.type("  console.log(`Hello, ${name}!`);");
      await page.waitForTimeout(100);
      await page.keyboard.press("Enter");
      await page.keyboard.type("}");
      await page.waitForTimeout(100);
      await page.keyboard.press("Enter");
      await page.keyboard.type("```");
      await page.waitForTimeout(300);

      // WYSIWYGに戻す
      await page.keyboard.press("Control+/");
      await page.waitForTimeout(800);
    }
    await page.waitForTimeout(500);

    const codeBlock = editor.locator("pre, .code-block, [class*='code-block']").first();
    const codeVisible = await codeBlock.isVisible().catch(() => false);

    if (codeVisible) {
      const codeBox = await codeBlock.boundingBox();
      if (codeBox) {
        await captureWithAnnotation(
          page,
          "code-block-result",
          [
            {
              rect: { x: codeBox.x, y: codeBox.y, width: codeBox.width, height: codeBox.height },
              label: "シンタックスハイライト付きコードブロック",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      }
    } else {
      await captureStep(page, "code-block-result", OUTPUT_DIR);
    }

    // ── Step 2: 引用ブロック ──
    // ソースモードで引用を追加
    await page.keyboard.press("Control+/");
    await page.waitForTimeout(500);
    const srcEditor2 = page.locator(".cm-editor, .cm-content");
    const src2Active = await srcEditor2.first().isVisible().catch(() => false);
    if (src2Active) {
      await page.keyboard.press("Control+End");
      await page.waitForTimeout(100);
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.keyboard.type("> これは引用ブロックです。");
      await page.waitForTimeout(100);
      await page.keyboard.press("Enter");
      await page.keyboard.type("> 複数行の引用を書くことができます。");
      await page.waitForTimeout(200);
      await page.keyboard.press("Control+/");
      await page.waitForTimeout(500);
    }
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
      }
    } else {
      await captureStep(page, "blockquote-result", OUTPUT_DIR);
    }

    // ── Step 3: 水平線 ──
    await page.keyboard.press("Control+/");
    await page.waitForTimeout(500);
    const srcEditor3 = page.locator(".cm-editor, .cm-content");
    const src3Active = await srcEditor3.first().isVisible().catch(() => false);
    if (src3Active) {
      await page.keyboard.press("Control+End");
      await page.waitForTimeout(100);
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.keyboard.type("---");
      await page.waitForTimeout(100);
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.keyboard.type("水平線の下のテキスト");
      await page.waitForTimeout(200);
      await page.keyboard.press("Control+/");
      await page.waitForTimeout(500);
    }
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
      }
    } else {
      await captureStep(page, "horizontal-rule", OUTPUT_DIR);
    }

    await captureStep(page, "blocks-overview", OUTPUT_DIR);
  });
});
