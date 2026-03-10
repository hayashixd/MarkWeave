import type { QueryResultRow } from '../types';

interface ListViewProps {
  rows: QueryResultRow[];
  fields: string[];
  onRowClick: (row: QueryResultRow) => void;
}

export function ListView({ rows, fields, onRowClick }: ListViewProps) {
  const metaFields = fields.filter((f) => f !== 'title' && f !== 'name');

  return (
    <ul className="metadata-list-view" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {rows.map((row) => (
        <li
          key={row.path}
          onClick={() => onRowClick(row)}
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            borderBottom: '1px solid var(--border-color, #edf2f7)',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor =
              'var(--hover-bg, #f7fafc)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = 'transparent')
          }
        >
          <span
            style={{
              color: 'var(--link-color, #3182ce)',
              fontWeight: 500,
            }}
          >
            {'↗ '}
            {row.title ?? row.name}
          </span>
          {metaFields.length > 0 && (
            <div
              style={{
                marginTop: '2px',
                fontSize: '0.8rem',
                color: 'var(--text-muted, #718096)',
              }}
            >
              {metaFields
                .map((f) => formatMetaValue(f, row.fields[f]))
                .filter(Boolean)
                .join('  ·  ')}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function formatMetaValue(
  field: string,
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) return '';
  if (field === 'tags') {
    return String(value)
      .split(',')
      .map((t) => `#${t.trim()}`)
      .join(' ');
  }
  if (
    field === 'modified' ||
    field === 'modified_at' ||
    field === 'created' ||
    field === 'created_at'
  ) {
    return `更新: ${String(value).slice(0, 10)}`;
  }
  if (field === 'wordcount' || field === 'word_count') {
    return `${value} 字`;
  }
  return String(value);
}
