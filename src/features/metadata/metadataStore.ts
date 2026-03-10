import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { parseQuery, astToSql } from './query-parser';
import type {
  QueryResultRow,
  MetadataQueryResult,
  IndexResult,
} from './types';

interface MetadataQueryStore {
  /** クエリを実行して結果を返す（キャッシュ付き）*/
  executeQuery: (queryText: string) => Promise<QueryResultRow[]>;
  /** ファイル保存時に呼ばれるインデックス更新 */
  updateIndex: (filePath: string, workspaceRoot: string) => Promise<void>;
  /** ワークスペース変更時に全インデックスを再構築 */
  rebuildIndex: (workspaceRoot: string) => Promise<IndexResult>;
  /** キャッシュをクリア */
  clearCache: () => void;
}

const queryCache = new Map<string, QueryResultRow[]>();

export const useMetadataStore = create<MetadataQueryStore>(() => ({
  executeQuery: async (queryText: string) => {
    const cacheKey = queryText.trim();
    if (queryCache.has(cacheKey)) return queryCache.get(cacheKey)!;

    const ast = parseQuery(queryText);
    const sql = astToSql(ast);
    const result = await invoke<MetadataQueryResult>(
      'execute_metadata_query',
      { sql },
    );

    // MetadataQueryResult を QueryResultRow[] に変換
    const rows: QueryResultRow[] = result.rows.map((row) => {
      const fields: Record<string, string | number | null> = {};
      result.columns.forEach((col, idx) => {
        fields[col] = row[idx];
      });
      return {
        path: (fields['path'] as string) ?? '',
        name: (fields['name'] as string) ?? '',
        title: (fields['title'] as string) ?? null,
        fields,
      };
    });

    queryCache.set(cacheKey, rows);
    return rows;
  },

  updateIndex: async (filePath: string, workspaceRoot: string) => {
    await invoke('update_metadata_for_file', {
      filePath,
      workspaceRoot,
    });
    queryCache.clear();
  },

  rebuildIndex: async (workspaceRoot: string) => {
    const result = await invoke<IndexResult>('index_workspace_metadata', {
      rootPath: workspaceRoot,
    });
    queryCache.clear();
    return result;
  },

  clearCache: () => {
    queryCache.clear();
  },
}));
