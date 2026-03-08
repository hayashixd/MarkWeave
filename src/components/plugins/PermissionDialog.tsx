/**
 * 権限確認ダイアログ
 *
 * plugin-api-design.md §6（プラグイン登録フロー）に準拠。
 * プラグインインストール時にユーザーへ権限を提示し、承認/拒否を求める。
 */

import type { PluginManifest, PluginPermission } from '../../plugins/plugin-api';

interface PermissionDialogProps {
  manifest: PluginManifest;
  onApprove: () => void;
  onDeny: () => void;
}

const PERMISSION_LABELS: Record<PluginPermission, string> = {
  'editor:read':     'エディタのドキュメント内容を読み取る',
  'editor:write':    'エディタのドキュメントを変更する',
  'editor:command':  'エディタコマンドを発行する',
  'clipboard:read':  'クリップボードを読み取る',
  'clipboard:write': 'クリップボードに書き込む',
  'fs:read':         'ワークスペース内のファイルを読み取る',
  'fs:write':        'ワークスペース内のファイルを書き込む',
  'network:fetch':   '外部 URL へアクセスする（インターネット通信）',
  'ui:toolbar':      'ツールバーにボタンを追加する',
  'ui:sidebar':      'サイドバーにパネルを追加する',
  'ui:menu':         'メニューにアイテムを追加する',
  'ui:dialog':       'ダイアログを表示する',
  'ui:toast':        'トースト通知を表示する',
};

const SENSITIVE_PERMISSIONS: PluginPermission[] = [
  'fs:read',
  'fs:write',
  'network:fetch',
  'clipboard:read',
  'clipboard:write',
];

export function PermissionDialog({ manifest, onApprove, onDeny }: PermissionDialogProps) {
  const hasSensitive = manifest.permissions.some((p) =>
    SENSITIVE_PERMISSIONS.includes(p as PluginPermission),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-[480px] max-w-[90vw] max-h-[80vh] flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">プラグインのアクセス許可</h2>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-medium text-gray-700">{manifest.name}</span>{' '}
            (v{manifest.version}) が以下の権限を要求しています。
          </p>
          {manifest.author && (
            <p className="text-xs text-gray-400 mt-0.5">作者: {manifest.author}</p>
          )}
        </div>

        {/* 権限リスト */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {hasSensitive && (
            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
              ⚠️ このプラグインは高い権限を要求しています。信頼できる発行元のプラグインのみインストールしてください。
            </div>
          )}

          <ul className="space-y-1.5">
            {manifest.permissions.map((perm) => {
              const isSensitive = SENSITIVE_PERMISSIONS.includes(perm as PluginPermission);
              return (
                <li key={perm} className="flex items-start gap-2 text-sm">
                  <span
                    className={`mt-0.5 text-base leading-none ${isSensitive ? 'text-amber-500' : 'text-gray-400'}`}
                  >
                    {isSensitive ? '⚠' : '•'}
                  </span>
                  <span className={isSensitive ? 'text-amber-800' : 'text-gray-700'}>
                    {PERMISSION_LABELS[perm as PluginPermission] ?? perm}
                  </span>
                </li>
              );
            })}
          </ul>

          {manifest.description && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">{manifest.description}</p>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onDeny}
            className="px-4 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onApprove}
            className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            許可してインストール
          </button>
        </div>
      </div>
    </div>
  );
}
