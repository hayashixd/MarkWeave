import { useEffect, useState, useCallback } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { parseQuery } from './query-parser';
import { useMetadataStore } from './metadataStore';
import { TableView } from './views/TableView';
import { ListView } from './views/ListView';
import type { QueryResultRow } from './types';
import { ProgressBar } from '../../components/common/ProgressBar';

export function QueryBlockView({ node }: NodeViewProps) {
  const [rows, setRows] = useState<QueryResultRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const executeQuery = useMetadataStore((s) => s.executeQuery);

  const queryText = node.attrs.query as string;
  const ast = (() => {
    try {
      return parseQuery(queryText);
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    if (!ast) {
      setError('クエリ構文エラー');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    executeQuery(queryText)
      .then((result) => {
        setRows(result);
        setError(null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [queryText]); // eslint-disable-line react-hooks/exhaustive-deps

  const openFile = useCallback((row: QueryResultRow) => {
    import('@tauri-apps/api/core').then(({ invoke }) =>
      invoke('read_file', { path: row.path }).catch(() => {
        // ファイルオープンはタブストア経由で行う（将来的に統合）
      }),
    );
  }, []);

  const reload = useCallback(() => {
    if (!ast) return;
    useMetadataStore.getState().clearCache();
    setLoading(true);
    executeQuery(queryText)
      .then((result) => {
        setRows(result);
        setError(null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [queryText, ast, executeQuery]);

  return (
    <NodeViewWrapper>
      <div
        className="query-block"
        contentEditable={false}
        style={{
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '6px',
          margin: '8px 0',
          overflow: 'hidden',
          background: 'var(--query-bg, #fafbfc)',
        }}
      >
        {/* ヘッダー */}
        <div
          className="query-block-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            background: 'var(--query-header-bg, #f0f4f8)',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            fontSize: '0.8rem',
            color: 'var(--text-muted, #718096)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600 }}>クエリ</span>
            <code
              style={{
                fontSize: '0.75rem',
                background: 'var(--code-bg, #edf2f7)',
                padding: '1px 4px',
                borderRadius: '3px',
              }}
            >
              {queryText.split('\n')[0]}
              {queryText.includes('\n') ? '...' : ''}
            </code>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{rows.length} 件</span>
            <button
              onClick={reload}
              title="再読み込み"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                padding: '0 2px',
              }}
            >
              ↺
            </button>
          </div>
        </div>

        {loading && (
          <div style={{ padding: '10px 12px' }}>
            <ProgressBar indeterminate label="クエリを実行中" />
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div
            className="query-error"
            style={{
              padding: '8px 12px',
              color: 'var(--error-color, #e53e3e)',
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}

        {/* 結果表示 */}
        {!loading && !error && ast && (
          <div style={{ padding: '4px' }}>
            {ast.view === 'table' && (
              <TableView rows={rows} fields={ast.select} onRowClick={openFile} />
            )}
            {ast.view === 'list' && (
              <ListView rows={rows} fields={ast.select} onRowClick={openFile} />
            )}
            {ast.view === 'calendar' && (
              <div
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  color: 'var(--text-muted, #718096)',
                }}
              >
                カレンダービューは Phase 8 で実装予定です
              </div>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
