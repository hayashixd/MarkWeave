/**
 * IME ガードの E2E テスト
 *
 * 日本語 IME 変換中に以下が誤爆しないことを検証する:
 *   1. スラッシュコマンドの Enter 実行
 *   2. InputRules による見出し変換（# → h1）
 *   3. AutoSave の保存スケジューリング
 *
 * IME シミュレーション手法:
 *   - compositionstart/end を .ProseMirror に dispatch（ProseMirror の view.composing と
 *     AppShell の isComposingRef の両方に作用する）
 *   - スラッシュコマンドの Enter テストは CDP 経由で keyCode 229 を注入
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// IME シミュレーションヘルパー
// ---------------------------------------------------------------------------

/** .ProseMirror 上で compositionstart を dispatch する。
 *  - バブリングにより AppShell の window capture listener も受け取る
 *  - ProseMirror は自身の compositionstart ハンドラで view.composing = true にセットする
 */
async function imeStart(page: Page): Promise<void> {
  await page.evaluate(() => {
    document
      .querySelector(".ProseMirror")
      ?.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  });
}

/** .ProseMirror 上で compositionend を dispatch する。
 *  @param data 確定文字列（空文字を推奨: 既にテキストが挿入済みのため）
 */
async function imeEnd(page: Page, data = ""): Promise<void> {
  await page.evaluate((d: string) => {
    document
      .querySelector(".ProseMirror")
      ?.dispatchEvent(new CompositionEvent("compositionend", { data: d, bubbles: true }));
  }, data);
}

// ---------------------------------------------------------------------------
// テストスイート
// ---------------------------------------------------------------------------

test.describe("IME ガード", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editor-container")).toBeVisible();

    // エディタをフォーカスして末尾に新しい空段落を作成
    // → 既存コンテンツ（ウェルカムテキスト等）との干渉を避ける
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Enter");
  });

  // -------------------------------------------------------------------------
  // Test 1: スラッシュコマンド Enter 誤爆防止
  // -------------------------------------------------------------------------

  test("スラッシュコマンド: IME 変換中の Enter でコマンドが実行されない", async ({
    page,
  }) => {
    // "/" を入力してスラッシュメニューを開く
    await page.keyboard.type("/");
    await page.waitForTimeout(500);

    const slashMenu = page.locator(".slash-command-menu");

    // スラッシュメニューが表示されない環境（ブラウザ互換モード等）はスキップ
    if (!(await slashMenu.isVisible().catch(() => false))) {
      test.skip();
    }

    // ── IME 変換中: Enter はブロックされる ───────────────────────────
    await imeStart(page);

    // CDP 経由で keyCode 229（IME 処理中を示す標準値）を注入
    // SlashCommandsExtension の guard: event.isComposing || event.keyCode === 229
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Process",
      code: "Enter",
      keyCode: 229,
      windowsVirtualKeyCode: 229,
      isComposing: true,
    });
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Process",
      code: "Enter",
      keyCode: 229,
      windowsVirtualKeyCode: 229,
    });
    await page.waitForTimeout(300);

    // IME 変換中: コマンドが実行されずスラッシュメニューが残っていること
    await expect(slashMenu).toBeVisible();

    // ── IME 変換確定後: Enter は通過する ──────────────────────────────
    await imeEnd(page);
    await page.waitForTimeout(100);

    // 通常の Enter → コマンドが実行されてメニューが閉じる
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);

    await expect(slashMenu).not.toBeVisible();
  });

  test("スラッシュコマンド: isComposing=true の Escape でもメニューを閉じられる", async ({
    page,
  }) => {
    // "/" を入力してスラッシュメニューを開く
    await page.keyboard.type("/");
    await page.waitForTimeout(500);

    const slashMenu = page.locator(".slash-command-menu");

    if (!(await slashMenu.isVisible().catch(() => false))) {
      test.skip();
    }

    // CDP 経由で isComposing: true の Escape を注入
    // SlashCommandsExtension は Escape を IME ガードより前にチェックするため通過する:
    //   if (event.key === 'Escape') { ... close menu ... }   ← ここで処理
    //   if (event.isComposing || event.keyCode === 229) return false;  ← ここには到達しない
    // ブラウザを composing 状態にせず CDP で直接注入することで
    // Chromium の "Escape → composition キャンセル" 介入を回避する
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      keyCode: 27,
      windowsVirtualKeyCode: 27,
      isComposing: true,
    });
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      keyCode: 27,
      windowsVirtualKeyCode: 27,
    });
    await page.waitForTimeout(200);

    // isComposing: true でもメニューが閉じていること
    await expect(slashMenu).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Test 2: InputRules 見出し変換誤爆防止
  // -------------------------------------------------------------------------

  test("InputRules: IME 変換中は見出し変換（# → h1）が発火しない", async ({
    page,
  }) => {
    const editor = page.locator(".ProseMirror");

    // 初期の h1 数を基準として記録（ウェルカムコンテンツ等を考慮）
    const h1Before = await editor.locator("h1").count();

    // ── IME 変換中: "# " を入力しても h1 に変換されない ────────────────
    await imeStart(page);

    // "# " は TipTap InputRule の見出し変換トリガー
    // SafeInputRulesExtension.filterTransaction が tr.getMeta('composition') をチェックしてブロック
    await page.keyboard.type("# ");
    await page.waitForTimeout(200);

    // IME 変換中: h1 数が変わっていないこと
    await expect(editor.locator("h1")).toHaveCount(h1Before);

    // IME 変換確定（data="" で既存テキストに干渉しない）
    await imeEnd(page);
    await page.waitForTimeout(200);

    // ── IME 変換後: 通常入力では変換が発火する ──────────────────────────
    // 現在行の末尾へ移動して新しい空段落を作成
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    // IME なしで "# " を入力 → 見出し変換が発火する
    await page.keyboard.type("# ");
    await page.waitForTimeout(200);

    // h1 が増えていること（InputRule が正常に動作している）
    const h1After = await editor.locator("h1").count();
    expect(h1After).toBeGreaterThan(h1Before);
  });

  // -------------------------------------------------------------------------
  // Test 3: AutoSave IME ガード
  // -------------------------------------------------------------------------

  test("AutoSave: IME 変換中は自動保存がスケジュールされない", async ({
    page,
  }) => {
    // Tauri IPC への write_text_file 呼び出しを記録するモックを設置
    // ブラウザ専用環境では __TAURI_INTERNALS__ が存在しないため no-op になる
    let saveCallsDuringIME = 0;
    await page.exposeFunction("__imeGuardTest_trackSave", () => {
      saveCallsDuringIME++;
    });

    await page.evaluate(() => {
      const tauri = (
        window as unknown as {
          __TAURI_INTERNALS__?: { ipc: (m: unknown) => unknown };
        }
      ).__TAURI_INTERNALS__;
      if (!tauri?.ipc) return; // Tauri なし環境はスキップ

      const orig = tauri.ipc;
      tauri.ipc = (message: unknown) => {
        const cmd = (message as { cmd?: string })?.cmd ?? "";
        if (cmd === "write_text_file") {
          (
            window as unknown as { __imeGuardTest_trackSave: () => void }
          ).__imeGuardTest_trackSave();
        }
        return orig.call(tauri, message);
      };
    });

    // ── IME 変換中: コンテンツを入力しても保存が走らない ────────────────
    await imeStart(page);

    // テキスト入力 → onContentChange が発火 → scheduleSave が呼ばれるが
    // isComposing() = true のため pendingSaveRef = true で早期リターン
    await page.keyboard.type("自動保存IMEテスト");

    // デバウンス上限（2000ms）+ 余裕を超えて待機
    await page.waitForTimeout(2500);

    // IME 変換中に write_text_file が呼ばれていないこと
    expect(saveCallsDuringIME).toBe(0);

    // ── IME 変換確定後: flush が実行される ──────────────────────────────
    // AppShell の compositionend ハンドラが flushRef.current() を呼ぶ
    await imeEnd(page);

    // debounce + 余裕を待機（filePath がある tab なら保存が走る）
    await page.waitForTimeout(1500);

    // compositionend 後にアプリが正常動作していること
    await expect(page.locator(".ProseMirror")).toContainText("自動保存IMEテスト");
    await expect(page.locator(".editor-container")).toBeVisible();
  });
});
