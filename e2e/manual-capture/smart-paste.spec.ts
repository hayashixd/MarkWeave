/**
 * マニュアル用スクリーンショット撮影シナリオ: スマートペースト
 *
 * 撮影対象:
 *   01_smart-paste-bar.png     — 確認バー全体表示（アノテーション付き）
 *   02_smart-paste-buttons.png — 操作ボタン部分のクローズアップ
 *   03_smart-paste-overview.png — バーとエディタの全体概要
 *
 * 実装の注意:
 *   SmartPasteExtension は 'ask' モード時に window で 'smart-paste-ask'
 *   カスタムイベントを発火する。TipTapEditor がこれを受信して確認バーを表示する。
 *   E2E 内で直接このイベントを dispatch することでバーを確実に表示できる。
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/smart-paste";

test.describe("マニュアル撮影: スマートペースト", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("スマートペーストの確認バーをスクリーンショットで記録する", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    // ── 事前準備: エディタにコンテンツを入力 ──
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("# スマートペーストのテスト");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type(
      "ここに Web からコピーしたリッチテキストを貼り付けます。"
    );
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);

    // ── 'smart-paste-ask' カスタムイベントを直接 dispatch ──
    // SmartPasteExtension が 'ask' モード時に発行するイベントをシミュレートする。
    // TipTapEditor がこのイベントを受信して SmartPasteBar を表示する。
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("smart-paste-ask", {
          detail: {
            html:
              "<h2>Web からコピーしたコンテンツ</h2>" +
              "<p>これは <strong>太字</strong> と <em>斜体</em> を含む書式付きテキストです。</p>" +
              "<ul><li>リスト項目 1</li><li>リスト項目 2</li></ul>" +
              '<p><a href="https://example.com">リンク付きテキスト</a></p>',
            plainText:
              "Web からコピーしたコンテンツ\nこれは太字と斜体を含む書式付きテキストです。",
          },
        })
      );
    });

    // バーが React の状態更新でレンダリングされるまで待機
    await page.waitForTimeout(400);

    // ── Step 1: スマートペーストバー全体（アノテーション付き） ──
    const smartPasteBar = page.locator(".smart-paste-bar");
    const barVisible = await smartPasteBar.isVisible().catch(() => false);

    if (barVisible) {
      const barBox = await smartPasteBar.boundingBox();
      if (barBox) {
        await captureWithAnnotation(
          page,
          "smart-paste-bar",
          [
            {
              rect: barBox,
              label: "スマートペーストバー",
              color: "#2563eb",
            },
          ],
          OUTPUT_DIR
        );
      } else {
        await captureStep(page, "smart-paste-bar", OUTPUT_DIR);
      }
    } else {
      await captureStep(page, "smart-paste-bar", OUTPUT_DIR);
    }

    // ── Step 2: 操作ボタンのクローズアップ ──
    const actionsArea = page.locator(".smart-paste-bar__actions");
    const actionsVisible = await actionsArea.isVisible().catch(() => false);

    if (actionsVisible) {
      const actionsBox = await actionsArea.boundingBox();
      if (actionsBox) {
        const expandedBox = {
          x: Math.max(0, actionsBox.x - 8),
          y: Math.max(0, actionsBox.y - 8),
          width: actionsBox.width + 16,
          height: actionsBox.height + 16,
        };
        await captureWithAnnotation(
          page,
          "smart-paste-buttons",
          [
            {
              rect: expandedBox,
              label: "貼り付け方法を選択",
              color: "#2563eb",
            },
          ],
          OUTPUT_DIR
        );
      } else {
        await captureStep(page, "smart-paste-buttons", OUTPUT_DIR);
      }
    } else {
      await captureStep(page, "smart-paste-buttons", OUTPUT_DIR);
    }

    // ── Step 3: 全体概要（バーとエディタ内容の全景） ──
    await captureStep(page, "smart-paste-overview", OUTPUT_DIR);
  });
});
