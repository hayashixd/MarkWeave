/**
 * エディタ領域の Error Boundary。
 *
 * error-handling-design.md §4.3 に準拠。
 * エディタが 1 つクラッシュしても他のタブは動作し続ける。
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../../utils/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class EditorErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('EditorErrorBoundary caught error', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <p className="text-gray-600 mb-2">
            このタブの表示中にエラーが発生しました。
          </p>
          <p className="text-gray-500 text-sm mb-4">
            ファイルの内容は保持されています。
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            再試行
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
