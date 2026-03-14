/**
 * マニュアル用スクリーンショット撮影シナリオ: 数式・Mermaid図表
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/math-mermaid";

test.describe("マニュアル撮影: 数式・Mermaid図表", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("数式とMermaid図表の使い方をスクリーンショットで記録する", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    const editor = page.locator(".ProseMirror");
    await editor.click();

    await page.keyboard.type("# 数式・図表のサンプル");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");

    // ── Step 1: インライン数式 ──
    await page.keyboard.type("インライン数式: $E = mc^2$");
    await page.waitForTimeout(500);

    const inlineMath = editor.locator(".katex, [class*='math'], .math-inline").first();
    const mathVisible = await inlineMath.isVisible().catch(() => false);

    if (mathVisible) {
      const mathBox = await inlineMath.boundingBox();
      if (mathBox) {
        await captureWithAnnotation(
          page,
          "inline-math",
          [
            {
              rect: { x: mathBox.x, y: mathBox.y, width: mathBox.width, height: mathBox.height },
              label: "インライン数式 ($...$)",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      }
    } else {
      await captureStep(page, "inline-math", OUTPUT_DIR);
    }

    // ── Step 2: ブロック数式 ──
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("$$");
    await page.keyboard.press("Enter");
    await page.keyboard.type("\\sum_{i=1}^{n} x_i = \\frac{n(n+1)}{2}");
    await page.keyboard.press("Enter");
    await page.keyboard.type("$$");
    await page.waitForTimeout(800);

    await captureStep(page, "block-math", OUTPUT_DIR);

    // ── Step 3: Mermaidフローチャート（ソースモードで入力して回避） ──
    await page.keyboard.press("Control+/");
    await page.waitForTimeout(600);

    const srcEditor3 = page.locator(".cm-editor, .cm-content");
    const src3Active = await srcEditor3.first().isVisible().catch(() => false);

    if (src3Active) {
      await page.keyboard.press("Control+End");
      await page.waitForTimeout(100);
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.keyboard.type("```mermaid");
      await page.waitForTimeout(100);
      await page.keyboard.press("Enter");
      await page.keyboard.type("graph TD");
      await page.waitForTimeout(100);
      await page.keyboard.press("Enter");
      await page.keyboard.type("    A[開始] --> B{条件}");
      await page.waitForTimeout(100);
      await page.keyboard.press("Enter");
      await page.keyboard.type("    B -->|Yes| C[処理A]");
      await page.waitForTimeout(100);
      await page.keyboard.press("Enter");
      await page.keyboard.type("    B -->|No| D[処理B]");
      await page.waitForTimeout(100);
      await page.keyboard.press("Enter");
      await page.keyboard.type("```");
      await page.waitForTimeout(200);

      // WYSIWYGに戻す
      await page.keyboard.press("Control+/");
      await page.waitForTimeout(800);
    }
    await page.waitForTimeout(1200);

    const mermaidDiagram = editor.locator(".mermaid, [class*='mermaid'], svg").first();
    const diagramVisible = await mermaidDiagram.isVisible().catch(() => false);

    if (diagramVisible) {
      const diagramBox = await mermaidDiagram.boundingBox();
      if (diagramBox) {
        await captureWithAnnotation(
          page,
          "mermaid-flowchart",
          [
            {
              rect: { x: diagramBox.x, y: diagramBox.y, width: diagramBox.width, height: diagramBox.height },
              label: "Mermaid フローチャート",
              color: "green",
            },
          ],
          OUTPUT_DIR
        );
      }
    } else {
      await captureStep(page, "mermaid-flowchart", OUTPUT_DIR);
    }

    await captureStep(page, "math-mermaid-overview", OUTPUT_DIR);
  });
});
