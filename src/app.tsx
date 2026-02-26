import { AppShell } from './components/layout/AppShell';
import { AppErrorBoundary } from './components/ErrorBoundary/AppErrorBoundary';

function App() {
  return (
    <AppErrorBoundary>
      <AppShell />
    </AppErrorBoundary>
  );
}

export default App;
