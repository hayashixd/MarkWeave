/**
 * トースト通知ストア。
 *
 * error-handling-design.md §6.3 に準拠。
 *
 * - Info: 3秒後に自動消去
 * - Warning: 8秒後に自動消去（手動消去も可）
 * - Error: 手動消去のみ
 * - 最大3件まで表示
 */

import { create } from 'zustand';
import { announcePolite, announceAssertive } from '../utils/a11y-announce';

export type ToastSeverity = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  severity: ToastSeverity;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastStore {
  toasts: Toast[];
  show: (severity: ToastSeverity, message: string, action?: Toast['action']) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  show: (severity, message, action) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts.slice(-2), { id, severity, message, action }],
    }));

    // スクリーンリーダーへのアナウンス (accessibility-design.md §6.2)
    if (severity === 'error') {
      announceAssertive(message);
    } else {
      announcePolite(message);
    }

    // 自動消去タイマー
    const delay = severity === 'info' || severity === 'success' ? 3000 : severity === 'warning' ? 8000 : 0;
    if (delay > 0) {
      setTimeout(
        () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
        delay,
      );
    }
  },

  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
