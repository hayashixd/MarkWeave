import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";
import "./styles.css";
import { themeManager } from "./themes/theme-manager";
import { useSettingsStore } from "./store/settingsStore";

// アプリ起動時にテーマを初期化する（theme-design.md §6.1）
// settingsStore からテーマ設定を読み込み、DOM に適用する
async function initializeTheme() {
  await useSettingsStore.getState().loadSettings();
  const { theme } = useSettingsStore.getState().settings.appearance;
  themeManager.initialize(theme);
}

initializeTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
