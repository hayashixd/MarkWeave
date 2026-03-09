import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";
import "./styles.css";
import { themeManager } from "./themes/theme-manager";
import { useSettingsStore } from "./store/settingsStore";
import { useSnippetStore } from "./store/snippetStore";

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
