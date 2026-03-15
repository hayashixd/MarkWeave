import { test, expect } from "@playwright/test";

test.describe("アプリ起動", () => {
  test("メインレイアウトが表示される", async ({ page }) => {
    await page.goto("/");

    // TabBar が存在する
    await expect(page.locator(".tab-bar")).toBeVisible();

    // StatusBar が存在する
    await expect(page.locator(".status-bar")).toBeVisible();

    // エディタ領域が存在する
    await expect(page.locator(".editor-container")).toBeVisible();
  });

  test("初回起動時に Untitled タブが表示される", async ({ page }) => {
    await page.goto("/");

    const tab = page.getByRole("tab", { selected: true });
    await expect(tab).toBeVisible();
    await expect(tab).toContainText("Untitled-1");
  });

  test("ステータスバーに Markdown と表示される", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".status-bar")).toContainText("Markdown");
  });
});

test.describe("タブ操作", () => {
  test("+ ボタンで新規タブを追加できる", async ({ page }) => {
    await page.goto("/");

    // 初期状態: 1 タブ
    await expect(page.locator(".tab-item")).toHaveCount(1);

    // + ボタンをクリック
    await page.getByRole("button", { name: "+" }).click();

    // 2 タブに増える
    await expect(page.locator(".tab-item")).toHaveCount(2);
  });

  test("タブをクリックして切り替えられる", async ({ page }) => {
    await page.goto("/");

    // 2つ目のタブを追加
    await page.getByRole("button", { name: "+" }).click();

    // 2つ目のタブをクリック
    const secondTab = page.locator(".tab-item").nth(1);
    await secondTab.click();

    await expect(secondTab).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("エディタ", () => {
  test("エディタにテキストを入力できる", async ({ page }) => {
    await page.goto("/");

    // ProseMirror エディタ領域をクリック
    const editor = page.locator(".ProseMirror");
    await editor.click();

    // テキストを入力
    await page.keyboard.type("Hello, world!");

    await expect(editor).toContainText("Hello, world!");
  });

  test("ツールバーが表示される", async ({ page }) => {
    await page.goto("/");

    const toolbar = page.locator(".editor-toolbar");
    await expect(toolbar).toBeVisible();

    // 太字ボタンが存在する
    await expect(page.getByTitle(/太字/)).toBeVisible();

    // 斜体ボタンが存在する
    await expect(page.getByTitle(/斜体/)).toBeVisible();
  });

  test("ツールバーの太字ボタンで太字を適用できる", async ({ page }) => {
    await page.goto("/");

    const editor = page.locator(".ProseMirror");
    await editor.click();

    // テキスト入力 → 全選択 → 太字適用
    await page.keyboard.type("bold text");
    await page.keyboard.press("Control+a");
    await page.getByTitle(/太字/).click();

    // <strong> 要素が存在する
    await expect(editor.locator("strong")).toContainText("bold text");
  });
});
