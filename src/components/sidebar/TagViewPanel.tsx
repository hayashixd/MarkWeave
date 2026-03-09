/**
 * タグビューパネル
 *
 * Phase 7 知識管理強化: YAML Front Matter の tags を横断収集・フィルタ表示。
 *
 * 機能:
 * - 開いている全タブの Front Matter から tags を収集
 * - タグごとにファイル数を集計して一覧表示
 * - フィルタ入力でタグを絞り込み
 * - タグクリックでそのタグを持つファイル一覧を展開
 * - ファイル名クリックでタブを切り替え
 *
 * 制限:
 * - スキャン対象は「現在開いているタブ」のみ（バックエンドインデックスは Phase 7.5）
 */

import { useState, useMemo } from 'react';
import { useTabStore } from '../../store/tabStore';
import { parseFrontMatter, parseYamlFields } from '../../lib/frontmatter';

interface TagEntry {
  tag: string;
  files: { tabId: string; fileName: string; filePath: string | null }[];
}

export function TagViewPanel() {
  const { tabs, setActiveTab } = useTabStore();
  const [filter, setFilter] = useState('');
  const [expandedTag, setExpandedTag] = useState<string | null>(null);

  const tagEntries = useMemo<TagEntry[]>(() => {
    const tagMap = new Map<string, TagEntry['files']>();

    for (const tab of tabs) {
      const { yaml } = parseFrontMatter(tab.content);
      if (!yaml) continue;

      const fields = parseYamlFields(yaml);
      if (!fields.tags || fields.tags.length === 0) continue;

      for (const tag of fields.tags) {
        const normalized = tag.toLowerCase().trim();
        if (!normalized) continue;

        if (!tagMap.has(normalized)) {
          tagMap.set(normalized, []);
        }
        tagMap.get(normalized)!.push({
          tabId: tab.id,
          fileName: tab.fileName,
          filePath: tab.filePath,
        });
      }
    }

    return Array.from(tagMap.entries())
      .map(([tag, files]) => ({ tag, files }))
      .sort((a, b) => b.files.length - a.files.length || a.tag.localeCompare(b.tag));
  }, [tabs]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return tagEntries;
    const q = filter.trim().toLowerCase();
    return tagEntries.filter((entry) => entry.tag.includes(q));
  }, [tagEntries, filter]);

  const totalTags = tagEntries.length;

  const handleTagClick = (tag: string) => {
    setExpandedTag((prev) => (prev === tag ? null : tag));
  };

  const handleFileClick = (tabId: string) => {
    setActiveTab(tabId);
  };

  return (
    <div className="tagview-panel">
      <div className="tagview-panel__header">
        <span className="tagview-panel__title">タグ一覧</span>
        <span className="tagview-panel__count">{totalTags}種</span>
      </div>

      <div className="tagview-panel__filter">
        <input
          type="text"
          className="tagview-panel__filter-input"
          placeholder="タグを検索…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="タグフィルタ"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="tagview-panel__empty">
          <p>
            {totalTags === 0
              ? 'タグが見つかりませんでした。'
              : '一致するタグがありません。'}
          </p>
          <p className="tagview-panel__empty-hint">
            {totalTags === 0
              ? 'Front Matter に tags フィールドを追加するとここに表示されます。'
              : 'フィルタ条件を変更してみてください。'}
          </p>
        </div>
      ) : (
        <ul className="tagview-panel__list">
          {filtered.map((entry) => (
            <li key={entry.tag} className="tagview-panel__item">
              <button
                type="button"
                className={`tagview-panel__tag-button ${expandedTag === entry.tag ? 'tagview-panel__tag-button--expanded' : ''}`}
                onClick={() => handleTagClick(entry.tag)}
                title={`${entry.tag} (${entry.files.length}ファイル)`}
              >
                <span className="tagview-panel__tag-icon" aria-hidden="true">
                  {expandedTag === entry.tag ? '▼' : '▶'}
                </span>
                <span className="tagview-panel__tag-name">#{entry.tag}</span>
                <span className="tagview-panel__tag-count">{entry.files.length}</span>
              </button>

              {expandedTag === entry.tag && (
                <ul className="tagview-panel__file-list">
                  {entry.files.map((file) => (
                    <li key={file.tabId} className="tagview-panel__file-item">
                      <button
                        type="button"
                        className="tagview-panel__file-name"
                        onClick={() => handleFileClick(file.tabId)}
                        title={file.filePath ?? file.fileName}
                      >
                        {file.fileName}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="tagview-panel__footer">
        ※ 開いているタブのみをスキャン
      </div>
    </div>
  );
}
