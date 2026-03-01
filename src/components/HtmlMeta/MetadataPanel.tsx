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
    <div className="space-y-3 text-sm">
      <h3 className="text-sm font-medium text-gray-700 mb-2">ページ設定</h3>

      {/* タイトル */}
      <div className="flex items-center gap-2">
        <label htmlFor="meta-title" className="text-xs text-gray-500 w-24 flex-shrink-0">
          タイトル
        </label>
        <input
          id="meta-title"
          type="text"
          value={metadata.title}
          onChange={handleTitleChange}
          placeholder="ページタイトルを入力"
          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {/* ディスクリプション */}
      <div className="flex items-center gap-2">
        <label htmlFor="meta-description" className="text-xs text-gray-500 w-24 flex-shrink-0">
          説明
        </label>
        <input
          id="meta-description"
          type="text"
          value={metadata.description}
          onChange={handleDescriptionChange}
          placeholder="ページの説明を入力"
          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {/* CSSリンク */}
      <div>
        <div className="text-xs text-gray-500 mb-1">CSS ファイル</div>
        {metadata.cssLinks.length > 0 && (
          <ul className="space-y-1 mb-1">
            {metadata.cssLinks.map((link, i) => (
              <li key={i} className="flex items-center gap-1 pl-2">
                <span className="text-xs text-gray-600 font-mono truncate flex-1">{link}</span>
                <button
                  type="button"
                  onClick={() => removeCssLink(i)}
                  aria-label="CSS リンクを削除"
                  className="text-gray-400 hover:text-red-500 text-xs px-1"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={newCssLink}
            onChange={(e) => setNewCssLink(e.target.value)}
            onKeyDown={handleCssKeyDown}
            placeholder="CSS ファイルのパスまたは URL"
            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            type="button"
            onClick={addCssLink}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 border border-gray-300 rounded hover:bg-gray-200"
          >
            追加
          </button>
        </div>
      </div>

      {/* JSリンク */}
      <div>
        <div className="text-xs text-gray-500 mb-1">JavaScript ファイル</div>
        {metadata.jsLinks.length > 0 && (
          <ul className="space-y-1 mb-1">
            {metadata.jsLinks.map((link, i) => (
              <li key={i} className="flex items-center gap-1 pl-2">
                <span className="text-xs text-gray-600 font-mono truncate flex-1">{link}</span>
                <button
                  type="button"
                  onClick={() => removeJsLink(i)}
                  aria-label="JS リンクを削除"
                  className="text-gray-400 hover:text-red-500 text-xs px-1"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={newJsLink}
            onChange={(e) => setNewJsLink(e.target.value)}
            onKeyDown={handleJsKeyDown}
            placeholder="JS ファイルのパスまたは URL"
            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            type="button"
            onClick={addJsLink}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 border border-gray-300 rounded hover:bg-gray-200"
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
};

export default MetadataPanel;
