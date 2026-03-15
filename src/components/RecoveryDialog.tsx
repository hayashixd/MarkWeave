/**
 * クラッシュリカバリダイアログ。
 *
 * window-tab-session-design.md §10.4 に準拠:
 * - 前回のクラッシュで未保存だったファイルの一覧を表示
 * - ユーザーに「復元する」か「破棄して最新ファイルを開く」を選択させる
 */

import type { RecoveryEntry } from '../store/crash-recovery';

interface RecoveryDialogProps {
  entries: RecoveryEntry[];
  onRestore: (entries: RecoveryEntry[]) => void;
  onDiscard: () => void;
}

/** ファイルパスからベースネームを取得する */
function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export function RecoveryDialog({ entries, onRestore, onDiscard }: RecoveryDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="bg-white rounded-lg shadow-xl w-[480px] max-w-[90vw] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="前回の変更を復元しますか？"
      >
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            前回の変更を復元しますか？
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            前回の終了時に保存されていない変更が見つかりました。
            復元すると、チェックポイント（最大30秒前）の状態に戻ります。
          </p>
        </div>

        <div className="px-5 py-3 max-h-[200px] overflow-auto">
          <ul className="space-y-1.5">
            {entries.map((e) => (
              <li key={e.filePath} className="flex items-center gap-2 text-sm">
                <span className="text-gray-800 font-medium truncate">
                  {basename(e.filePath)}
                </span>
                <span className="text-gray-400 text-xs flex-shrink-0">
                  {new Date(e.checkpointAt).toLocaleString('ja-JP')} 時点
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onDiscard}
            className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            破棄して最新ファイルを開く
          </button>
          <button
            onClick={() => onRestore(entries)}
            className="px-4 py-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded transition-colors"
          >
            復元する
          </button>
        </div>
      </div>
    </div>
  );
}
