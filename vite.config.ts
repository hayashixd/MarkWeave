import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";

// https://v2.tauri.app/start/frontend/vite/
const host = process.env.TAURI_DEV_HOST;

const _require = createRequire(import.meta.url);

/**
 * mermaid.min.js を public/vendor/ にコピーする Vite プラグイン。
 *
 * mermaid-sandbox.html は Vite バンドラーを通らない静的ファイルのため、
 * ESM の import('/node_modules/...') はプロダクションビルドで機能しない。
 * mermaid.min.js（globalThis.mermaid に単体エクスポートする単一ファイル）を
 * public/vendor/ にコピーし、<script src="/vendor/mermaid.min.js"> で読み込む。
 *
 * buildStart は dev サーバー起動時・ビルド時の両方で呼ばれるため、
 * 開発・本番どちらでも同じファイルが使われる。
 */
function copyMermaidForSandboxPlugin(): Plugin {
  return {
    name: "copy-mermaid-for-sandbox",
    buildStart() {
      const src = _require.resolve("mermaid/dist/mermaid.min.js");
      const destDir = path.resolve(__dirname, "public/vendor");
      const dest = path.join(destDir, "mermaid.min.js");
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }
      copyFileSync(src, dest);
    },
  };
}

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), copyMermaidForSandboxPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
