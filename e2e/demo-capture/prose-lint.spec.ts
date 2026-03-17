/**
 * デモ GIF 撮影: 文章スタイル Lint（Prose Lint）
 *
 * "Write → Polish → Publish" の "Polish" を伝えるデモ。
 * AI 不要・ローカルで動く文章品質チェックの価値を示す。
 * 出力: doc-public/demo-gifs/prose-lint.gif
 *
 * フレーム構成:
 *   1. 問題のある文章が入力された WYSIWYG エディタ
 *      （長い文・ですます/だ混在・冗長表現を含む）
 *   2. Ctrl+Shift+8 で Lint パネルを開いた状態
 *      → 指摘事項が一覧表示される
 *   3. 指摘項目をクリック → エディタが該当行にジャンプ
 */
import { test, expect } from '@playwright/test';
import { GifRecorder } from '../helpers/gif';

const OUTPUT_PATH = 'doc-public/demo-gifs/prose-lint.gif';

test.describe('デモ GIF 撮影: 文章スタイル Lint', () => {
  test.setTimeout(120_000);

  test('prose-lint', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const recorder = new GifRecorder({
      width: 1280,
      height: 720,
      defaultDelay: 1000,
      quality: 8,
    });

    // ── コンテンツを入力（意図的に問題のある文章） ──────────
    await page.goto('/');
    await expect(page.locator('.editor-container')).toBeVisible();

    // showAdvancedTabs を有効化（DEV モードで window に公開されたストアを使用）
    await page.evaluate(async () => {
      const store = (window as Record<string, unknown>).__markweaveSettingsStore as {
        getState: () => { updateSettings: (p: unknown) => Promise<void> };
      } | undefined;
      if (store) {
        await store.getState().updateSettings({ sidebar: { showAdvancedTabs: true } });
      }
    });
    await page.waitForTimeout(300);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // 記事タイトル
    await page.keyboard.type('# Rust で CLI ツールを作る方法');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    // 長い文（SENT001: >100 文字）
    await page.keyboard.type('Rust はシステムプログラミング言語であり、メモリ安全性をコンパイル時に保証することができるため、C や C++ の代替として多くの開発者に選ばれており、近年では WebAssembly のターゲット言語としても注目を集めています。');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    // 冗長表現（STYLE003: ことができる）
    await page.keyboard.type('cargo コマンドを使用することで依存関係を管理することができます。');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    // 文体混在（STYLE001: ですます vs だ）
    await page.keyboard.type('エラー処理は Result 型を使います。');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Option 型は値の有無を表現するための型だ。');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(300);

    // ── Frame 1: 問題のある文章が入力された状態 ──────────
    await recorder.addFrame(page, 2000);

    // ── Lint パネルを開く（tauri-menu-action 経由） ───────
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('tauri-menu-action', { detail: 'view_lint' })
      );
    });
    await page.waitForTimeout(1200); // デバウンス(500ms) + Lint計算 + React再描画

    // ── Frame 2: Lint パネルが開いて指摘事項が表示された状態 ──
    await recorder.addFrame(page, 2800);

    // ── 最初の指摘項目をクリック（エディタジャンプのデモ） ──
    const firstIssue = page.locator('[class*="issue-item"], [class*="IssueItem"]').first();
    const issueVisible = await firstIssue.isVisible().catch(() => false);
    if (issueVisible) {
      await firstIssue.click();
      await page.waitForTimeout(600);
    }

    // ── Frame 3: 該当行にジャンプ / パネルの詳細が見える状態 ──
    await recorder.addFrame(page, 2500);

    // ── GIF を保存 ────────────────────────────────────────
    await recorder.save(OUTPUT_PATH);
  });
});
