import type { QueryResultRow } from '../types';

const FIELD_LABELS: Record<string, string> = {
  title: 'タイトル',
  name: 'ファイル名',
  path: 'パス',
  created: '作成日',
  created_at: '作成日',
  modified: '更新日',
  modified_at: '更新日',
  wordcount: '文字数',
  word_count: '文字数',
  tags: 'タグ',
  tasks: '未完了タスク',
  tasks_done: '完了タスク',
  size: 'サイズ',
  size_bytes: 'サイズ',
};

interface TableViewProps {
  rows: QueryResultRow[];
  fields: string[];
  onRowClick: (row: QueryResultRow) => void;
}

export function TableView({ rows, fields, onRowClick }: TableViewProps) {
  return (
    <div className="metadata-table-view">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr>
            {fields.map((f) => (
              <th
                key={f}
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  borderBottom: '2px solid var(--border-color, #e2e8f0)',
                  fontWeight: 600,
                }}
              >
                {FIELD_LABELS[f] ?? f}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.path}
              onClick={() => onRowClick(row)}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  'var(--hover-bg, #f7fafc)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = 'transparent')
              }
            >
              {fields.map((f) => (
                <td
                  key={f}
                  style={{
                    padding: '4px 8px',
                    borderBottom: '1px solid var(--border-color, #edf2f7)',
                  }}
                >
                  {f === 'title' || f === 'name' ? (
                    <span style={{ color: 'var(--link-color, #3182ce)' }}>
                      {'↗ '}
                      {row.title ?? row.name}
                    </span>
                  ) : (
                    formatFieldValue(f, row.fields[f])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatFieldValue(
  field: string,
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) return '';
  if (
    field === 'modified' ||
    field === 'modified_at' ||
    field === 'created' ||
    field === 'created_at'
  ) {
    return String(value).slice(0, 10);
  }
  if (field === 'tags') {
    return String(value)
      .split(',')
      .map((t) => `#${t.trim()}`)
      .join(' ');
  }
  return String(value);
}
