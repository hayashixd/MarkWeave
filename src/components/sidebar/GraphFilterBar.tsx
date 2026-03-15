/**
 * グラフフィルタバー
 *
 * wikilinks-backlinks-design.md §11.5 に準拠。
 * タグによるフィルタリングと孤立ノード非表示オプションを提供する。
 */

interface GraphFilterBarProps {
  allTags: string[];
  filterTags: string[];
  onFilterChange: (tags: string[]) => void;
  hideIsolated: boolean;
  onHideIsolatedChange: (v: boolean) => void;
}

export function GraphFilterBar({
  allTags,
  filterTags,
  onFilterChange,
  hideIsolated,
  onHideIsolatedChange,
}: GraphFilterBarProps) {
  const availableTags = allTags.filter((t) => !filterTags.includes(t));

  return (
    <div className="graph-filter-bar">
      <div className="graph-filter-bar__tags">
        {filterTags.map((tag) => (
          <span key={tag} className="graph-filter-bar__chip">
            #{tag}
            <button
              type="button"
              onClick={() => onFilterChange(filterTags.filter((t) => t !== tag))}
              className="graph-filter-bar__chip-remove"
              aria-label={`${tag} フィルタを解除`}
            >
              ✕
            </button>
          </span>
        ))}
        {availableTags.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) onFilterChange([...filterTags, e.target.value]);
              e.target.value = '';
            }}
            className="graph-filter-bar__select"
            aria-label="タグを追加"
          >
            <option value="">+ タグ</option>
            {availableTags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
        )}
      </div>
      <label className="graph-filter-bar__checkbox">
        <input
          type="checkbox"
          checked={hideIsolated}
          onChange={(e) => onHideIsolatedChange(e.target.checked)}
        />
        <span>孤立ノード非表示</span>
      </label>
    </div>
  );
}
