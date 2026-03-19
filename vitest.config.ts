import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// カバレッジ実行時（pnpm test:coverage）は性能テストを除外する。
// 理由: v8 インスツルメンテーションのオーバーヘッドで性能閾値が破綻するため。
// 性能テストは pnpm test（通常実行）または pnpm test:perf で別途実行する。
const isCoverageRun = process.env.npm_lifecycle_event === "test:coverage";

const PERF_TEST_EXCLUDES = [
  "src/lib/__tests__/large-file-threshold.test.ts",
  "src/extensions/__tests__/virtual-scroll-perf.test.ts",
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: isCoverageRun ? PERF_TEST_EXCLUDES : [],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/test/**",
        "src/vite-env.d.ts",
        "src/main.tsx",
        // Tauri ランタイム依存のため jsdom では計測不能
        "src/ipc/**",
        // React UI コンポーネントは E2E (Playwright) で担保。
        // 単体テストのカバレッジ数値に含めない
        "src/components/**",
      ],
      thresholds: {
        // 「退行防止ライン」: components / ipc を除外した実測値 (2026-03-19)
        // 新機能追加時にこの数値を少しずつ引き上げる。
        // 目標: statements/lines 65%, functions 70%（IME・ファイル競合・AI エラー等のテスト追加で段階的に引き上げ）
        statements: 53,
        branches: 84,
        functions: 63,
        lines: 53,
      },
    },
  },
});
