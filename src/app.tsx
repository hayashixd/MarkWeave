import { AppShell } from './components/layout/AppShell';
import { AppErrorBoundary } from './components/ErrorBoundary/AppErrorBoundary';

function App() {
  return (
    <AppErrorBoundary>
      {/* スキップナビゲーション: Tab キーで最初に表示される (accessibility-design.md §5.3) */}
      <a href="#editor-panel" className="skip-link">
        メインコンテンツへスキップ
      </a>
      <AppShell />
      {/* ARIA ライブリージョン: スクリーンリーダー向けアナウンス専用 (accessibility-design.md §6.1) */}
      <div
        id="aria-live-region"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <div
        id="aria-alert-region"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </AppErrorBoundary>
  );
}

export default App;
