import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiContextMenu } from './AiContextMenu';
import type { AiContextMenuState } from './AiContextMenu';

// ── ヘルパー ──────────────────────────────────────────────────────────────────

const visibleMenu: AiContextMenuState = { visible: true, x: 100, y: 200 };
const hiddenMenu: AiContextMenuState = { visible: false, x: 0, y: 0 };

function renderMenu(
  overrides: Partial<{
    menu: AiContextMenuState;
    hasSelection: boolean;
    onAiEdit: () => void;
    onAiProofread: () => void;
    onAiRewrite: () => void;
    onAiSummarize: () => void;
    onAiTranslate: () => void;
    onClose: () => void;
  }> = {},
) {
  const props = {
    menu: visibleMenu,
    hasSelection: false,
    onAiEdit: vi.fn(),
    onAiProofread: vi.fn(),
    onAiRewrite: vi.fn(),
    onAiSummarize: vi.fn(),
    onAiTranslate: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<AiContextMenu {...props} />), props };
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe('AiContextMenu', () => {
  describe('表示制御', () => {
    it('visible=false のとき何もレンダリングしない', () => {
      const { container } = renderMenu({ menu: hiddenMenu });
      expect(container.firstChild).toBeNull();
    });

    it('visible=true のときメニューがレンダリングされる', () => {
      renderMenu();
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('メニューが指定の座標に配置される', () => {
      renderMenu({ menu: { visible: true, x: 300, y: 400 } });
      const menu = screen.getByRole('menu');
      expect(menu).toHaveStyle({ left: '300px', top: '400px' });
    });
  });

  describe('AI で編集... ボタン', () => {
    it('常に表示される', () => {
      renderMenu({ hasSelection: false });
      expect(screen.getByRole('menuitem', { name: /AI で編集/ })).toBeInTheDocument();
    });

    it('選択あり時も表示される', () => {
      renderMenu({ hasSelection: true });
      expect(screen.getByRole('menuitem', { name: /AI で編集/ })).toBeInTheDocument();
    });

    it('クリックで onClose → onAiEdit が呼ばれる', () => {
      const onAiEdit = vi.fn();
      const onClose = vi.fn();
      renderMenu({ onAiEdit, onClose });
      fireEvent.click(screen.getByRole('menuitem', { name: /AI で編集/ }));
      expect(onClose).toHaveBeenCalledOnce();
      expect(onAiEdit).toHaveBeenCalledOnce();
    });

    it('ショートカットキー "Ctrl+Shift+I" が表示される', () => {
      renderMenu();
      expect(screen.getByText('Ctrl+Shift+I')).toBeInTheDocument();
    });
  });

  describe('選択なし（hasSelection=false）', () => {
    it('校正 / リライト / 要約 / 翻訳 ボタンが表示されない', () => {
      renderMenu({ hasSelection: false });
      expect(screen.queryByRole('menuitem', { name: 'AI 校正' })).toBeNull();
      expect(screen.queryByRole('menuitem', { name: 'AI リライト' })).toBeNull();
      expect(screen.queryByRole('menuitem', { name: 'AI 要約' })).toBeNull();
      expect(screen.queryByRole('menuitem', { name: 'AI 翻訳' })).toBeNull();
    });
  });

  describe('選択あり（hasSelection=true）', () => {
    it('校正 / リライト / 要約 / 翻訳 ボタンが全て表示される', () => {
      renderMenu({ hasSelection: true });
      expect(screen.getByRole('menuitem', { name: 'AI 校正' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'AI リライト' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'AI 要約' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'AI 翻訳' })).toBeInTheDocument();
    });

    it('AI 校正クリックで onAiProofread が呼ばれる', () => {
      const onAiProofread = vi.fn();
      const onClose = vi.fn();
      renderMenu({ hasSelection: true, onAiProofread, onClose });
      fireEvent.click(screen.getByRole('menuitem', { name: 'AI 校正' }));
      expect(onClose).toHaveBeenCalledOnce();
      expect(onAiProofread).toHaveBeenCalledOnce();
    });

    it('AI リライトクリックで onAiRewrite が呼ばれる', () => {
      const onAiRewrite = vi.fn();
      const onClose = vi.fn();
      renderMenu({ hasSelection: true, onAiRewrite, onClose });
      fireEvent.click(screen.getByRole('menuitem', { name: 'AI リライト' }));
      expect(onAiRewrite).toHaveBeenCalledOnce();
    });

    it('AI 要約クリックで onAiSummarize が呼ばれる', () => {
      const onAiSummarize = vi.fn();
      renderMenu({ hasSelection: true, onAiSummarize });
      fireEvent.click(screen.getByRole('menuitem', { name: 'AI 要約' }));
      expect(onAiSummarize).toHaveBeenCalledOnce();
    });

    it('AI 翻訳クリックで onAiTranslate が呼ばれる', () => {
      const onAiTranslate = vi.fn();
      renderMenu({ hasSelection: true, onAiTranslate });
      fireEvent.click(screen.getByRole('menuitem', { name: 'AI 翻訳' }));
      expect(onAiTranslate).toHaveBeenCalledOnce();
    });
  });

  describe('Escape キーで閉じる', () => {
    it('Escape キーで onClose が呼ばれる', () => {
      const onClose = vi.fn();
      renderMenu({ onClose });
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('メニューが非表示なら keydown リスナーは登録されない', () => {
      const onClose = vi.fn();
      renderMenu({ menu: hiddenMenu, onClose });
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('メニュー外クリックで閉じる', () => {
    it('メニュー外の要素をクリックすると onClose が呼ばれる', () => {
      const onClose = vi.fn();
      renderMenu({ onClose });
      // document 自体に pointerdown を発行してメニュー外クリックをシミュレート
      fireEvent.pointerDown(document.body);
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe('aria 属性', () => {
    it('role="menu" が設定されている', () => {
      renderMenu();
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('aria-label="AI 操作メニュー" が設定されている', () => {
      renderMenu();
      expect(screen.getByRole('menu', { name: 'AI 操作メニュー' })).toBeInTheDocument();
    });
  });
});
