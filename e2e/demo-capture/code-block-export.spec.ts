/**
 * デモ GIF 撮影: コードブロック記述 → HTML エクスポート
 *
 * "コードを書いてすぐ綺麗な HTML が出る" を数秒で伝えるデモ。
 * 出力: doc-public/demo-gifs/code-block-export.gif
 *
 * フレーム構成:
 *   1. 空のエディタ（WYSIWYG 起動直後）
 *   2. WYSIWYG でタイトルを入力した状態
 *   3. ソースモードへ切り替え、コードブロック入り Markdown を入力した状態
 *   4. HTML エクスポートダイアログを開いた状態
 *
 * 注意: テスト環境では source → WYSIWYG の切り替えが不安定なため、
 *       ソースモードのままエクスポートダイアログを開く構成にしている。
 *       (code-block.spec.ts と同様の制約)
 */
import { test, expect } from '@playwright/test';
import { GifRecorder } from '../helpers/gif';

const OUTPUT_PATH = 'doc-public/demo-gifs/code-block-export.gif';

/** ソースモードに切り替えるカスタムイベント */
async function switchToSource(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('menu-editor-mode', { detail: { mode: 'source' } })
    );
  });
  await page.waitForTimeout(700);
}

/** HTML エクスポートダイアログを開くカスタムイベント */
async function openHtmlExportDialog(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('tauri-menu-action', { detail: 'file_export_html' })
    );
  });
  await page.waitForTimeout(900);
}

/** ソースモードに追記するコードブロック行（行ごとの配列） */
const CODE_BLOCK_LINES = [
  '',
  "Here's a simple function:",
  '',
  '```javascript',
  'function greet(name) {',
  "  return 'Hello, ' + name + '!';",
  '}',
  '',
  'console.log(greet("World"));',
  '```',
  '',
  'Run this to print **Hello, World!** to the console.',
];

test.describe('デモ GIF 撮影: コードブロック → HTML エクスポート', () => {
  test.setTimeout(120_000);

  test('code-block-export', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const recorder = new GifRecorder({
      width: 1280,
      height: 720,
      defaultDelay: 1000,
      quality: 8,
    });

    // ── Frame 1: アプリ起動、空の WYSIWYG エディタ ──────
    await page.goto('/');
    await expect(page.locator('.editor-container')).toBeVisible();
    await page.waitForTimeout(500);
    await recorder.addFrame(page, 1200);

    // ── WYSIWYG でタイトルを入力 ─────────────────────────
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('# Getting Started with JavaScript');
    await page.waitForTimeout(300);

    // ── Frame 2: WYSIWYG にタイトルが入力された状態 ──────
    await recorder.addFrame(page, 1500);

    // ── ソースモードに切り替え ────────────────────────────
    await switchToSource(page);

    const sourceEditor = page.locator('.cm-editor').first();
    await expect(sourceEditor).toBeVisible();
    await sourceEditor.click();
    await page.waitForTimeout(200);

    // 末尾に移動してコードブロックを追記
    await page.keyboard.press('Control+End');
    await page.waitForTimeout(100);
    for (const line of CODE_BLOCK_LINES) {
      if (line.length > 0) {
        await page.keyboard.type(line);
      }
      await page.keyboard.press('Enter');
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(400);

    // ── Frame 3: ソースモードにコードブロック入り Markdown ──
    await recorder.addFrame(page, 1800);

    // ── HTML エクスポートダイアログを開く ─────────────────
    await openHtmlExportDialog(page);

    // ── Frame 4: HTML エクスポートダイアログ ──────────────
    await recorder.addFrame(page, 2500);

    // ── GIF を保存 ────────────────────────────────────────
    await recorder.save(OUTPUT_PATH);
  });
});
