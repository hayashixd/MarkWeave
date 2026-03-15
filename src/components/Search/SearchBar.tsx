/**
 * 検索・置換バー
 *
 * search-design.md §2.4 に準拠:
 * - Ctrl+F で開くフローティングバー（エディタ右上）
 * - Ctrl+H で置換バーを追加表示
 * - インクリメンタル検索（デバウンス 100ms）
 * - 大文字/小文字区別、正規表現、単語単位のオプション
 * - Enter / F3 で次のマッチ、Shift+Enter / Shift+F3 で前のマッチ
 * - Escape で閉じる
 */

import type React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import {
  setSearchQuery,
  gotoNextMatch,
  gotoPrevMatch,
  replaceCurrentMatch,
  replaceAllMatches,
  clearSearch,
  searchPluginKey,
} from '../../extensions/SearchExtension';
import type { SearchOptions } from '../../extensions/SearchExtension';

interface SearchBarProps {
  editor: Editor;
  showReplace: boolean;
  onClose: () => void;
  onToggleReplace: () => void;
}

export function SearchBar({
  editor,
  showReplace,
  onClose,
  onToggleReplace,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
  });
  const [matchInfo, setMatchInfo] = useState({ current: 0, total: 0 });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // マウント時に検索入力にフォーカス
  useEffect(() => {
    searchInputRef.current?.focus();
    // 選択テキストがある場合、検索クエリに自動設定
    const { from, to } = editor.state.selection;
    if (from !== to) {
      const selectedText = editor.state.doc.textBetween(from, to);
      if (selectedText && selectedText.length < 200) {
        setQuery(selectedText);
      }
    }
  }, [editor]);

  // 検索実行（デバウンス付き）
  const executeSearch = useCallback(
    (q: string, opts: SearchOptions) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const result = setSearchQuery(editor.view, q, opts);
        setMatchInfo({
          current: result.matches.length > 0 ? 1 : 0,
          total: result.matches.length,
        });
      }, 100);
    },
    [editor],
  );

  // クエリ変更時に検索実行
  useEffect(() => {
    executeSearch(query, options);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, options, executeSearch]);

  // クリーンアップ: コンポーネントがアンマウントされたら検索ハイライトをクリア
  useEffect(() => {
    return () => {
      clearSearch(editor.view);
    };
  }, [editor]);

  // マッチ情報の更新（プラグイン状態から読み取り）
  const updateMatchInfo = useCallback(() => {
    const state = searchPluginKey.getState(editor.view.state);
    if (state) {
      setMatchInfo({
        current: state.matches.length > 0 ? state.currentIndex + 1 : 0,
        total: state.matches.length,
      });
    }
  }, [editor]);

  const handleNext = useCallback(() => {
    gotoNextMatch(editor.view);
    updateMatchInfo();
  }, [editor, updateMatchInfo]);

  const handlePrev = useCallback(() => {
    gotoPrevMatch(editor.view);
    updateMatchInfo();
  }, [editor, updateMatchInfo]);

  const handleReplace = useCallback(() => {
    replaceCurrentMatch(editor.view, replacement, options);
    updateMatchInfo();
  }, [editor, replacement, options, updateMatchInfo]);

  const handleReplaceAll = useCallback(() => {
    const count = replaceAllMatches(editor.view, replacement);
    setMatchInfo({ current: 0, total: 0 });
    if (count > 0) {
      // トーストに置換件数を表示することも将来的に可能
    }
  }, [editor, replacement]);

  const handleClose = useCallback(() => {
    clearSearch(editor.view);
    onClose();
  }, [editor, onClose]);

  const toggleOption = useCallback(
    (key: keyof SearchOptions) => {
      setOptions((prev: SearchOptions) => ({ ...prev, [key]: !prev[key] }));
    },
    [],
  );

  // キーボードイベント処理
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // IME 変換中は無視
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        editor.commands.focus();
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleNext();
        return;
      }

      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        handlePrev();
        return;
      }

      if (e.key === 'F3' && !e.shiftKey) {
        e.preventDefault();
        handleNext();
        return;
      }

      if (e.key === 'F3' && e.shiftKey) {
        e.preventDefault();
        handlePrev();
        return;
      }

      // Alt+C: 大文字/小文字区別トグル
      if (e.altKey && e.key === 'c') {
        e.preventDefault();
        toggleOption('caseSensitive');
        return;
      }

      // Alt+R: 正規表現トグル
      if (e.altKey && e.key === 'r') {
        e.preventDefault();
        toggleOption('regex');
        return;
      }

      // Alt+W: 単語単位トグル
      if (e.altKey && e.key === 'w') {
        e.preventDefault();
        toggleOption('wholeWord');
        return;
      }
    },
    [handleClose, handleNext, handlePrev, toggleOption, editor],
  );

  // 置換入力でのキーダウン
  const handleReplaceKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        editor.commands.focus();
        return;
      }

      if (e.key === 'Enter' && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleReplace();
        return;
      }

      // Ctrl+Alt+Enter: 全て置換
      if (e.key === 'Enter' && e.ctrlKey && e.altKey) {
        e.preventDefault();
        handleReplaceAll();
        return;
      }
    },
    [handleClose, handleReplace, handleReplaceAll, editor],
  );

  return (
    <div
      className="search-bar"
      role="search"
      aria-label="ドキュメント内検索"
      onKeyDown={handleKeyDown}
    >
      {/* 検索入力行 */}
      <div className="search-bar__row">
        <div className="search-bar__toggle-replace">
          <button
            type="button"
            onClick={onToggleReplace}
            className="search-bar__expand-btn"
            aria-label={showReplace ? '置換を隠す' : '置換を表示'}
            title={showReplace ? '置換を隠す' : '置換を表示'}
          >
            {showReplace ? '▾' : '▸'}
          </button>
        </div>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="検索..."
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          className="search-bar__input"
          aria-label="検索キーワード"
        />
        <div className="search-bar__options">
          <button
            type="button"
            className={`search-bar__option-btn ${options.caseSensitive ? 'search-bar__option-btn--active' : ''}`}
            onClick={() => toggleOption('caseSensitive')}
            title="大文字/小文字を区別 (Alt+C)"
            aria-pressed={options.caseSensitive}
            aria-label="大文字/小文字を区別"
          >
            Aa
          </button>
          <button
            type="button"
            className={`search-bar__option-btn ${options.wholeWord ? 'search-bar__option-btn--active' : ''}`}
            onClick={() => toggleOption('wholeWord')}
            title="単語単位で検索 (Alt+W)"
            aria-pressed={options.wholeWord}
            aria-label="単語単位で検索"
          >
            \b
          </button>
          <button
            type="button"
            className={`search-bar__option-btn ${options.regex ? 'search-bar__option-btn--active' : ''}`}
            onClick={() => toggleOption('regex')}
            title="正規表現を使用 (Alt+R)"
            aria-pressed={options.regex}
            aria-label="正規表現を使用"
          >
            .*
          </button>
        </div>
        <span
          className="search-bar__count"
          aria-live="polite"
          aria-atomic="true"
        >
          {query
            ? matchInfo.total > 0
              ? `${matchInfo.current} / ${matchInfo.total} 件`
              : '見つかりません'
            : ''}
        </span>
        <div className="search-bar__nav">
          <button
            type="button"
            onClick={handlePrev}
            disabled={matchInfo.total === 0}
            aria-label="前の一致箇所"
            title="前の一致箇所 (Shift+Enter)"
            className="search-bar__nav-btn"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={matchInfo.total === 0}
            aria-label="次の一致箇所"
            title="次の一致箇所 (Enter)"
            className="search-bar__nav-btn"
          >
            ↓
          </button>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="search-bar__close-btn"
          aria-label="検索を閉じる"
          title="閉じる (Escape)"
        >
          ×
        </button>
      </div>

      {/* 置換入力行 */}
      {showReplace && (
        <div className="search-bar__row search-bar__replace-row">
          <div className="search-bar__toggle-replace" />
          <input
            type="text"
            placeholder="置換..."
            value={replacement}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReplacement(e.target.value)}
            onKeyDown={handleReplaceKeyDown}
            className="search-bar__input"
            aria-label="置換テキスト"
          />
          <div className="search-bar__replace-actions">
            <button
              type="button"
              onClick={handleReplace}
              disabled={matchInfo.total === 0}
              className="search-bar__action-btn"
              title="置換 (Enter)"
              aria-label="現在のマッチを置換"
            >
              置換
            </button>
            <button
              type="button"
              onClick={handleReplaceAll}
              disabled={matchInfo.total === 0}
              className="search-bar__action-btn"
              title="全て置換 (Ctrl+Alt+Enter)"
              aria-label="全てのマッチを置換"
            >
              全置換
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
