import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useToastStore } from './toastStore';

// crypto.randomUUID のモック
vi.stubGlobal('crypto', {
  randomUUID: () => `test-${Date.now()}-${Math.random()}`,
});

describe('toastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('show でトーストを追加できる', () => {
    useToastStore.getState().show('info', 'テスト通知');
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0]!.severity).toBe('info');
    expect(useToastStore.getState().toasts[0]!.message).toBe('テスト通知');
  });

  it('最大3件まで保持する', () => {
    const { show } = useToastStore.getState();
    show('info', '1');
    show('info', '2');
    show('info', '3');
    show('info', '4');
    expect(useToastStore.getState().toasts).toHaveLength(3);
    // 最新の3件が残る
    expect(useToastStore.getState().toasts[2]!.message).toBe('4');
  });

  it('dismiss でトーストを削除できる', () => {
    useToastStore.getState().show('error', 'エラー');
    const id = useToastStore.getState().toasts[0]!.id;
    useToastStore.getState().dismiss(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('action 付きトーストを作成できる', () => {
    const action = { label: '詳細', onClick: () => {} };
    useToastStore.getState().show('warning', '警告', action);
    expect(useToastStore.getState().toasts[0]!.action).toEqual(action);
  });
});
