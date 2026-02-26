/**
 * トースト通知の表示コンテナ。
 *
 * error-handling-design.md §6.1 に準拠。
 * 画面右下に最大3件まで積み上げて表示。
 */

import { useToastStore } from '../../store/toastStore';
import type { Toast, ToastSeverity } from '../../store/toastStore';

const SEVERITY_STYLES: Record<ToastSeverity, string> = {
  info: 'bg-green-50 border-green-300 text-green-800',
  warning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  error: 'bg-red-50 border-red-300 text-red-800',
};

const SEVERITY_ICONS: Record<ToastSeverity, string> = {
  info: '\u2713',
  warning: '\u26A0',
  error: '\u2717',
};

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className={`flex items-start gap-2 px-3 py-2 rounded border shadow-md text-sm ${SEVERITY_STYLES[toast.severity]}`}
    >
      <span className="flex-shrink-0 mt-0.5">
        {SEVERITY_ICONS[toast.severity]}
      </span>
      <span className="flex-1">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={toast.action.onClick}
          className="underline text-xs whitespace-nowrap"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="text-current opacity-50 hover:opacity-100 ml-1"
        aria-label="閉じる"
      >
        &times;
      </button>
    </div>
  );
}
