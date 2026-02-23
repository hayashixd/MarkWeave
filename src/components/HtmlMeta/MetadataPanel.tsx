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
 *
 * @example
 * <MetadataPanel
 *   metadata={currentMeta}
 *   onChange={(updated) => applyMetadataToDocument(updated)}
 * />
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

  // TODO: スタイルはTailwind CSSまたはCSS Modulesで整備する
  return (
    <div className="metadata-panel">
      <h3>ページ設定</h3>

      {/* タイトル */}
      <section>
        <label htmlFor="meta-title">タイトル</label>
        <input
          id="meta-title"
          type="text"
          value={metadata.title}
          onChange={handleTitleChange}
          placeholder="ページタイトルを入力"
        />
      </section>

      {/* ディスクリプション */}
      <section>
        <label htmlFor="meta-description">説明（meta description）</label>
        <input
          id="meta-description"
          type="text"
          value={metadata.description}
          onChange={handleDescriptionChange}
          placeholder="ページの説明を入力"
        />
      </section>

      {/* CSSリンク */}
      <section>
        <label>CSSファイル</label>
        <ul>
          {metadata.cssLinks.map((link, i) => (
            <li key={i}>
              <span>{link}</span>
              <button onClick={() => removeCssLink(i)} aria-label="削除">×</button>
            </li>
          ))}
        </ul>
        <div>
          <input
            type="text"
            value={newCssLink}
            onChange={(e) => setNewCssLink(e.target.value)}
            placeholder="CSSファイルのパスまたはURL"
          />
          <button onClick={addCssLink}>追加</button>
        </div>
      </section>

      {/* JSリンク */}
      <section>
        <label>JavaScriptファイル</label>
        <ul>
          {metadata.jsLinks.map((link, i) => (
            <li key={i}>
              <span>{link}</span>
              <button onClick={() => removeJsLink(i)} aria-label="削除">×</button>
            </li>
          ))}
        </ul>
        <div>
          <input
            type="text"
            value={newJsLink}
            onChange={(e) => setNewJsLink(e.target.value)}
            placeholder="JSファイルのパスまたはURL"
          />
          <button onClick={addJsLink}>追加</button>
        </div>
      </section>
    </div>
  );
};

export default MetadataPanel;
