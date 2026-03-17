import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E テスト設定
 * Vite dev server (port 1420) に対してブラウザテストを実行する。
 *
 * セットアップ:
 *   npx playwright install chromium
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e-results",

  /* テスト全体のタイムアウト（30秒） */
  timeout: 30_000,

  /* expect のタイムアウト（5秒） */
  expect: {
    timeout: 5_000,
  },

  /* CI ではリトライ 2 回、ローカルでは 0 */
  retries: process.env.CI ? 2 : 0,

  /* CI ではワーカー数を 1 に制限 */
  workers: process.env.CI ? 1 : undefined,

  /* レポーター設定 */
  reporter: process.env.CI ? "github" : "html",

  use: {
    /* Vite dev server の URL */
    baseURL: "http://localhost:1420",

    /* テスト失敗時にスクリーンショットを撮る */
    screenshot: "only-on-failure",

    /* テスト失敗時にトレースを記録 */
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /demo-capture|manual-capture/,
    },
    {
      name: "manual-capture",
      testDir: "./e2e/manual-capture",
      use: { ...devices["Desktop Chrome"], headless: false },
    },
    {
      name: "demo-chromium",
      testDir: "./e2e/demo-capture",
      use: { ...devices["Desktop Chrome"], headless: false },
    },
  ],

  /* Vite dev server を自動起動 */
  webServer: {
    command: "pnpm dev",
    port: 1420,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
