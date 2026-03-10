import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";
import "./styles.css";
import { themeManager } from "./themes/theme-manager";
import { useSettingsStore } from "./store/settingsStore";
import { useSnippetStore } from "./store/snippetStore";

// パフォーマンス計測: 起動時間 (performance-design.md §8.1)
const appStartTime = performance.now();

// アプリ起動時にテーマを初期化する（theme-design.md §6.1）
// settingsStore からテーマ設定を読み込み、DOM に適用する
async function initializeApp() {
  await useSettingsStore.getState().loadSettings();
  const { theme } = useSettingsStore.getState().settings.appearance;
  themeManager.initialize(theme);

  // スニペットを読み込む
  await useSnippetStore.getState().loadSnippets();
}

initializeApp();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// パフォーマンス計測: 初回マウント完了時間を記録 (performance-design.md §8.1)
requestAnimationFrame(() => {
  const mountTime = performance.now() - appStartTime;
  console.log(`[Perf] App mount: ${mountTime.toFixed(1)}ms`);
});
