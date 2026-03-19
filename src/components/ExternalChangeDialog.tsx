/**
 * 外部変更検知ダイアログ
 *
 * CLAUDE.md §2 に準拠:
 * 未保存のファイルが外部プロセス（Git、Dropbox 等）で変更された場合、
 * 自動リロードせずにユーザーへ選択肢を提示する。
 */

interface ExternalChangeDialogProps {
  fileName: string;
  onKeep: () => void;
  onReload: () => void;
}

export function ExternalChangeDialog({ fileName, onKeep, onReload }: ExternalChangeDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="bg-white rounded-lg shadow-xl w-[460px] max-w-[90vw] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="ファイルが外部で変更されました"
      >
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            ファイルが外部で変更されました
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            <span className="font-medium text-gray-800">{fileName}</span>{' '}
            が外部プログラム（Dropbox、Git 等）によって変更されました。
            どちらの内容を使用しますか？
          </p>
        </div>

        <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
          <p className="text-xs text-amber-700">
            「ディスクから再読み込み」を選ぶと、エディタの未保存の変更は失われます。
          </p>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onKeep}
            className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            エディタの内容を保持
          </button>
          <button
            onClick={onReload}
            className="px-4 py-1.5 text-sm text-white bg-indigo-600 hover:bg-indigo-500 rounded font-medium transition-colors"
          >
            ディスクから再読み込み
          </button>
        </div>
      </div>
    </div>
  );
}
