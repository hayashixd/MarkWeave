/**
 * マニュアル用スクリーンショット撮影シナリオ: プラットフォームプロファイル（Zenn / Qiita）
 *
 * 撮影対象:
 *   01_profile-selector.png  — 汎用 / Zenn / Qiita の 3 択セレクター
 *   02_zenn-form.png          — Zenn プロファイル専用フォーム
 *   03_qiita-form.png         — Qiita プロファイル専用フォーム
 *   04_warnings.png           — Qiita プロファイル時の構文警告
 *   05_zenn-palette.png       — Zenn 記法挿入パレット（ツールバー直下）
 *   06_copy-buttons.png       — Markdown コピーボタン群
 */
import { test, expect } from "@playwright/test";
import {
  captureStep,
  captureWithAnnotation,
  resetStepCounter,
} from "../helpers/screenshot";

const OUTPUT_DIR = "docs/manual-screenshots/platform-profile";

test.describe("マニュアル撮影: プラットフォームプロファイル（Zenn / Qiita）", () => {
  test.beforeEach(() => {
    resetStepCounter();
  });

  test("プラットフォームプロファイルの切り替えをスクリーンショットで記録する", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    // ── 事前準備: 警告テスト用に Zenn 固有記法を本文に入力 ──
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("# Zenn / Qiita 向け記事サンプル");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type(":::message");
    await page.keyboard.press("Enter");
    await page.keyboard.type("この構文は Zenn 固有です。Qiita プロファイル選択時に警告が表示されます。");
    await page.keyboard.press("Enter");
    await page.keyboard.type(":::");
    await page.waitForTimeout(300);

    // ── Front Matter パネルを開く ──
    // 初回は "Front Matter を追加" ボタンが表示される
    const addFmBtn = page.locator(".front-matter-panel__add-btn");
    const addBtnVisible = await addFmBtn.isVisible().catch(() => false);
    if (addBtnVisible) {
      await addFmBtn.click();
      await page.waitForTimeout(500); // liveBodyMarkdown が同期されるまで待機
    } else {
      // 既に FM がある場合: ヘッダーをクリックして展開
      const fmHeader = page.locator(".front-matter-panel__header");
      const headerVisible = await fmHeader.isVisible().catch(() => false);
      if (headerVisible) {
        const isExpanded = await page
          .locator(".front-matter-panel--expanded")
          .isVisible()
          .catch(() => false);
        if (!isExpanded) {
          await fmHeader.click();
          await page.waitForTimeout(400);
        }
      }
    }

    // ── Step 1: プロファイルセレクター (01_profile-selector.png) ──
    const profileSelector = page.locator(
      ".front-matter-panel__profile-selector"
    );
    const selectorVisible = await profileSelector.isVisible().catch(() => false);

    if (selectorVisible) {
      const selectorBox = await profileSelector.boundingBox();
      if (selectorBox) {
        await captureWithAnnotation(
          page,
          "profile-selector",
          [
            {
              rect: {
                x: selectorBox.x - 4,
                y: selectorBox.y - 4,
                width: selectorBox.width + 8,
                height: selectorBox.height + 8,
              },
              label: "プロファイルセレクター（汎用 / Zenn / Qiita）",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      } else {
        await captureStep(page, "profile-selector", OUTPUT_DIR);
      }
    } else {
      await captureStep(page, "profile-selector", OUTPUT_DIR);
    }

    // ── Step 2: Zenn プロファイルフォーム (02_zenn-form.png) ──
    const zennBtn = page
      .locator(".front-matter-panel__profile-btn")
      .filter({ hasText: "Zenn" });
    const zennBtnVisible = await zennBtn.isVisible().catch(() => false);
    if (zennBtnVisible) {
      await zennBtn.click();
      await page.waitForTimeout(400);
    }

    const fmBody = page.locator(".front-matter-panel__body");
    const fmBodyVisible = await fmBody.isVisible().catch(() => false);
    if (fmBodyVisible) {
      const fmBodyBox = await fmBody.boundingBox();
      if (fmBodyBox) {
        await captureWithAnnotation(
          page,
          "zenn-form",
          [
            {
              rect: {
                x: fmBodyBox.x,
                y: fmBodyBox.y,
                width: fmBodyBox.width,
                height: fmBodyBox.height,
              },
              label: "Zenn プロファイル — title / emoji / type / topics フォーム",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      } else {
        await captureStep(page, "zenn-form", OUTPUT_DIR);
      }
    } else {
      await captureStep(page, "zenn-form", OUTPUT_DIR);
    }

    // ── Step 3: Qiita プロファイルフォーム (03_qiita-form.png) ──
    const qiitaBtn = page
      .locator(".front-matter-panel__profile-btn")
      .filter({ hasText: "Qiita" });
    const qiitaBtnVisible = await qiitaBtn.isVisible().catch(() => false);
    if (qiitaBtnVisible) {
      await qiitaBtn.click();
      await page.waitForTimeout(400);
    }

    const fmBodyQ = page.locator(".front-matter-panel__body");
    const fmBodyQVisible = await fmBodyQ.isVisible().catch(() => false);
    if (fmBodyQVisible) {
      const fmBodyQBox = await fmBodyQ.boundingBox();
      if (fmBodyQBox) {
        await captureWithAnnotation(
          page,
          "qiita-form",
          [
            {
              rect: {
                x: fmBodyQBox.x,
                y: fmBodyQBox.y,
                width: fmBodyQBox.width,
                height: fmBodyQBox.height,
              },
              label: "Qiita プロファイル — title / tags / private フォーム",
              color: "green",
            },
          ],
          OUTPUT_DIR
        );
      } else {
        await captureStep(page, "qiita-form", OUTPUT_DIR);
      }
    } else {
      await captureStep(page, "qiita-form", OUTPUT_DIR);
    }

    // ── Step 4: 構文警告 (04_warnings.png) ──
    // Qiita プロファイル時、:::message を含む本文があると警告が表示される
    const warningsContainer = page.locator(
      ".front-matter-panel__body .space-y-1"
    );
    const warningsVisible = await warningsContainer
      .isVisible()
      .catch(() => false);

    if (warningsVisible) {
      const warningsBox = await warningsContainer.boundingBox();
      if (warningsBox) {
        await captureWithAnnotation(
          page,
          "warnings",
          [
            {
              rect: {
                x: warningsBox.x - 4,
                y: warningsBox.y - 4,
                width: warningsBox.width + 8,
                height: warningsBox.height + 8,
              },
              label: "プラットフォーム別構文警告",
              color: "orange",
            },
          ],
          OUTPUT_DIR
        );
      } else {
        await captureStep(page, "warnings", OUTPUT_DIR);
      }
    } else {
      // 警告が出ない場合（liveBodyMarkdown 未設定等）はフォーム全体を撮影
      await captureStep(page, "warnings", OUTPUT_DIR);
    }

    // ── Step 5: Zenn 記法パレット (05_zenn-palette.png) ──
    // Zenn プロファイルに戻すとツールバー直下にパレットが表示される
    const zennBtn2 = page
      .locator(".front-matter-panel__profile-btn")
      .filter({ hasText: "Zenn" });
    const zennBtn2Visible = await zennBtn2.isVisible().catch(() => false);
    if (zennBtn2Visible) {
      await zennBtn2.click();
      await page.waitForTimeout(400);
    }

    const palette = page.locator(".zenn-syntax-palette");
    const paletteVisible = await palette.isVisible().catch(() => false);

    if (paletteVisible) {
      const paletteBox = await palette.boundingBox();
      if (paletteBox) {
        await captureWithAnnotation(
          page,
          "zenn-palette",
          [
            {
              rect: {
                x: paletteBox.x,
                y: paletteBox.y,
                width: paletteBox.width,
                height: paletteBox.height,
              },
              label: "Zenn 記法パレット（Zenn プロファイル時のみ）",
              color: "blue",
            },
          ],
          OUTPUT_DIR
        );
      } else {
        await captureStep(page, "zenn-palette", OUTPUT_DIR);
      }
    } else {
      await captureStep(page, "zenn-palette", OUTPUT_DIR);
    }

    // ── Step 6: コピーボタン群 (06_copy-buttons.png) ──
    // Zenn プロファイル時: "Markdown をコピー" + "Qiita 用に変換してコピー" の 2 ボタン
    const copyBtnPrimary = page
      .locator(".front-matter-panel__body button")
      .filter({ hasText: "Markdown をコピー" })
      .first();
    const copyBtnVisible = await copyBtnPrimary.isVisible().catch(() => false);

    if (copyBtnVisible) {
      // ボタン行のコンテナ（border-t を持つ flex ラッパー）を取得
      const copyRow = page.locator(
        ".front-matter-panel__body .border-t.border-gray-100.flex"
      );
      const copyRowVisible = await copyRow.isVisible().catch(() => false);

      if (copyRowVisible) {
        const copyRowBox = await copyRow.boundingBox();
        if (copyRowBox) {
          await captureWithAnnotation(
            page,
            "copy-buttons",
            [
              {
                rect: {
                  x: copyRowBox.x - 4,
                  y: copyRowBox.y - 4,
                  width: copyRowBox.width + 8,
                  height: copyRowBox.height + 8,
                },
                label: "Markdown コピーボタン群",
                color: "purple",
              },
            ],
            OUTPUT_DIR
          );
        } else {
          await captureStep(page, "copy-buttons", OUTPUT_DIR);
        }
      } else {
        // コンテナが見つからない場合はボタン単体の位置を使用
        const btnBox = await copyBtnPrimary.boundingBox();
        if (btnBox) {
          await captureWithAnnotation(
            page,
            "copy-buttons",
            [
              {
                rect: {
                  x: btnBox.x - 4,
                  y: btnBox.y - 4,
                  width: btnBox.width + 8,
                  height: btnBox.height + 8,
                },
                label: "Markdown コピーボタン",
                color: "purple",
              },
            ],
            OUTPUT_DIR
          );
        } else {
          await captureStep(page, "copy-buttons", OUTPUT_DIR);
        }
      }
    } else {
      await captureStep(page, "copy-buttons", OUTPUT_DIR);
    }
  });
});
