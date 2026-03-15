/**
 * 行番号指定ジャンプダイアログ（Ctrl+G）
 *
 * keyboard-shortcuts.md / editor-ux-design.md に準拠。
 * ソースモードでは行番号に直接ジャンプ。
 * WYSIWYG モードではブロック番号でジャンプ。
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface GoToLineDialogProps {
  totalLines: number;
  onGoToLine: (line: number) => void;
  onClose: () => void;
}

export function GoToLineDialog({
  totalLines,
  onGoToLine,
  onClose,
}: GoToLineDialogProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    const line = parseInt(value, 10);
    if (!isNaN(line) && line >= 1 && line <= totalLines) {
      onGoToLine(line);
      onClose();
    }
  }, [value, totalLines, onGoToLine, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [handleSubmit, onClose],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  return (
    <div
      className="goto-line-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-label="行番号ジャンプ"
      aria-modal="true"
    >
      <div className="goto-line-dialog">
        <label className="goto-line-dialog__label">
          行番号を入力 (1〜{totalLines}):
        </label>
        <div className="goto-line-dialog__row">
          <input
            ref={inputRef}
            type="number"
            min={1}
            max={totalLines}
            className="goto-line-dialog__input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`1〜${totalLines}`}
          />
          <button
            type="button"
            className="goto-line-dialog__btn"
            onClick={handleSubmit}
          >
            ジャンプ
          </button>
        </div>
      </div>
    </div>
  );
}
