/**
 * アプリ全体の Error Boundary。
 *
 * error-handling-design.md §4.2 に準拠。
 * 致命的エラーをキャッチし、再起動ボタン付きのフォールバック画面を表示する。
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../../utils/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('AppErrorBoundary caught error', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen p-8 text-center">
          <h1 className="text-xl font-semibold mb-4">
            予期しないエラーが発生しました
          </h1>
          <p className="text-gray-600 mb-2">
            申し訳ありません。エディタが予期しないエラーで停止しました。
          </p>
          <p className="text-gray-500 text-sm mb-6">
            ログファイルを確認して問題を報告してください。
          </p>
          <button
            type="button"
            onClick={() => location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            再起動
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
