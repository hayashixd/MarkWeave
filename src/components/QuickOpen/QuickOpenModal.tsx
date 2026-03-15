/**
 * クイックオープン（Ctrl+P）モーダル
 *
 * editor-ux-design.md §4 に準拠。
 *
 * ワークスペースのファイル一覧から素早くファイルを検索・オープンする。
 * ワークスペースがない場合は最近使ったファイル履歴を表示する。
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTabStore } from '../../store/tabStore';

interface QuickOpenProps {
  onClose: () => void;
}

interface FileItem {
  name: string;
  path: string;
}

export function QuickOpenModal({ onClose }: QuickOpenProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // タブストアから最近開いたファイルを取得
  const tabs = useTabStore((s) => s.tabs);

  // 最近開いたファイルの一覧を構築
  const recentFiles: FileItem[] = tabs
    .filter((t) => t.filePath)
    .map((t) => ({
      name: t.fileName,
      path: t.filePath!,
    }));

  // クエリでフィルタリング（ファジーマッチ簡易実装）
  const filteredFiles = query.trim()
    ? recentFiles.filter((f) => {
        const q = query.toLowerCase();
        const name = f.name.toLowerCase();
        const path = f.path.toLowerCase();
        return name.includes(q) || path.includes(q);
      })
    : recentFiles;

  // 選択インデックスを範囲内に収める
  useEffect(() => {
    if (selectedIndex >= filteredFiles.length) {
      setSelectedIndex(Math.max(0, filteredFiles.length - 1));
    }
  }, [filteredFiles.length, selectedIndex]);

  // モーダル表示時に入力にフォーカス
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const openFile = useCallback(
    (file: FileItem) => {
      const tabStore = useTabStore.getState();
      // 既存タブがあればフォーカス
      const existingTab = tabStore.tabs.find((t) => t.filePath === file.path);
      if (existingTab) {
        tabStore.setActiveTab(existingTab.id);
      }
      // 新規タブは AppShell のファイルオープンフローに委譲
      // ここではカスタムイベントで通知
      window.dispatchEvent(
        new CustomEvent('quick-open-file', { detail: { path: file.path } }),
      );
      onClose();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) =>
            Math.min(i + 1, filteredFiles.length - 1),
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredFiles[selectedIndex]) {
            openFile(filteredFiles[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredFiles, selectedIndex, openFile, onClose],
  );

  // 背景クリックで閉じる
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <div
      className="quick-open-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-label="クイックオープン"
      aria-modal="true"
    >
      <div className="quick-open-modal" onKeyDown={handleKeyDown}>
        <div className="quick-open-modal__search">
          <span className="quick-open-modal__search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="quick-open-modal__input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="ファイルを開く..."
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <ul className="quick-open-modal__list" role="listbox">
          {filteredFiles.length === 0 ? (
            <li className="quick-open-modal__empty">
              {query ? '一致するファイルがありません' : '最近開いたファイルがありません'}
            </li>
          ) : (
            filteredFiles.map((file, idx) => (
              <li
                key={file.path}
                role="option"
                aria-selected={idx === selectedIndex}
                className={`quick-open-modal__item${idx === selectedIndex ? ' quick-open-modal__item--selected' : ''}`}
                onClick={() => openFile(file)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className="quick-open-modal__file-icon">📄</span>
                <span className="quick-open-modal__file-name">{file.name}</span>
                <span className="quick-open-modal__file-path">{file.path}</span>
              </li>
            ))
          )}
        </ul>
        <div className="quick-open-modal__footer">
          <span>↑↓ で移動</span>
          <span>Enter で開く</span>
          <span>Esc で閉じる</span>
        </div>
      </div>
    </div>
  );
}
