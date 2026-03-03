/**
 * MetadataPanel.tsx
 *
 * HTMLファイルの <head> メタデータを GUI で編集するパネルコンポーネント。
 *
 * 編集できる項目:
 *   - <title>
 *   - <meta name="description">
 *   - <link rel="stylesheet" href="...">  の追加・削除
 *   - <script src="..."> の追加・削除
 *
 * 設計書: docs/05_Features/HTML/html-editing-design.md §4.3
 */

import React, { useState } from 'react';
import type { HtmlMetadata } from '../../core/parser/html-parser';

interface MetadataPanelProps {
  /** 現在のメタデータ */
  metadata: HtmlMetadata;
  /** メタデータが変更されたときのコールバック */
  onChange: (updated: HtmlMetadata) => void;
}

/**
 * HTMLメタデータ編集パネル。
 */
export const MetadataPanel: React.FC<MetadataPanelProps> = ({
  metadata,
  onChange,
}) => {
  const [newCssLink, setNewCssLink] = useState('');
  const [newJsLink, setNewJsLink] = useState('');

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...metadata, title: e.target.value });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...metadata, description: e.target.value });
  };

  const addCssLink = () => {
    if (!newCssLink.trim()) return;
    onChange({ ...metadata, cssLinks: [...metadata.cssLinks, newCssLink.trim()] });
    setNewCssLink('');
  };

  const removeCssLink = (index: number) => {
    const updated = metadata.cssLinks.filter((_, i) => i !== index);
    onChange({ ...metadata, cssLinks: updated });
  };

  const addJsLink = () => {
    if (!newJsLink.trim()) return;
    onChange({ ...metadata, jsLinks: [...metadata.jsLinks, newJsLink.trim()] });
    setNewJsLink('');
  };

  const removeJsLink = (index: number) => {
    const updated = metadata.jsLinks.filter((_, i) => i !== index);
    onChange({ ...metadata, jsLinks: updated });
  };

  const handleCssKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCssLink();
    }
  };

  const handleJsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addJsLink();
    }
  };

  return (
    <div className="text-sm">
      {/* 基本情報セクション */}
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center mb-3">
        <label htmlFor="meta-title" className="text-xs text-gray-500 font-medium">
          タイトル
        </label>
        <input
          id="meta-title"
          type="text"
          value={metadata.title}
          onChange={handleTitleChange}
          placeholder="ページタイトルを入力"
          className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-colors"
        />

        <label htmlFor="meta-description" className="text-xs text-gray-500 font-medium">
          説明
        </label>
        <input
          id="meta-description"
          type="text"
          value={metadata.description}
          onChange={handleDescriptionChange}
          placeholder="ページの説明を入力"
          className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-colors"
        />
      </div>

      {/* リソースリンクセクション */}
      <div className="flex gap-4">
        {/* CSSリンク */}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 font-medium mb-1.5">CSS ファイル</div>
          {metadata.cssLinks.length > 0 ? (
            <ul className="space-y-1 mb-1.5">
              {metadata.cssLinks.map((link, i) => (
                <li key={i} className="flex items-center gap-1 group bg-white border border-gray-200 rounded px-2 py-0.5">
                  <span className="text-xs text-gray-600 font-mono truncate flex-1" title={link}>{link}</span>
                  <button
                    type="button"
                    onClick={() => removeCssLink(i)}
                    aria-label={`${link} を削除`}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-red-50"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M3.17 3.17a.5.5 0 01.7 0L6 5.3l2.13-2.13a.5.5 0 01.7.7L6.71 6l2.12 2.13a.5.5 0 01-.7.7L6 6.71 3.87 8.83a.5.5 0 01-.7-.7L5.3 6 3.17 3.87a.5.5 0 010-.7z" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-gray-400 mb-1.5 italic">なし</div>
          )}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newCssLink}
              onChange={(e) => setNewCssLink(e.target.value)}
              onKeyDown={handleCssKeyDown}
              placeholder="パスまたは URL を入力して Enter"
              className="flex-1 min-w-0 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-colors"
            />
            <button
              type="button"
              onClick={addCssLink}
              disabled={!newCssLink.trim()}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 border border-gray-300 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              追加
            </button>
          </div>
        </div>

        {/* JSリンク */}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 font-medium mb-1.5">JavaScript ファイル</div>
          {metadata.jsLinks.length > 0 ? (
            <ul className="space-y-1 mb-1.5">
              {metadata.jsLinks.map((link, i) => (
                <li key={i} className="flex items-center gap-1 group bg-white border border-gray-200 rounded px-2 py-0.5">
                  <span className="text-xs text-gray-600 font-mono truncate flex-1" title={link}>{link}</span>
                  <button
                    type="button"
                    onClick={() => removeJsLink(i)}
                    aria-label={`${link} を削除`}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-red-50"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M3.17 3.17a.5.5 0 01.7 0L6 5.3l2.13-2.13a.5.5 0 01.7.7L6.71 6l2.12 2.13a.5.5 0 01-.7.7L6 6.71 3.87 8.83a.5.5 0 01-.7-.7L5.3 6 3.17 3.87a.5.5 0 010-.7z" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-gray-400 mb-1.5 italic">なし</div>
          )}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newJsLink}
              onChange={(e) => setNewJsLink(e.target.value)}
              onKeyDown={handleJsKeyDown}
              placeholder="パスまたは URL を入力して Enter"
              className="flex-1 min-w-0 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-colors"
            />
            <button
              type="button"
              onClick={addJsLink}
              disabled={!newJsLink.trim()}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 border border-gray-300 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              追加
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetadataPanel;
