export interface QueryResultRow {
  path: string;
  name: string;
  title: string | null;
  fields: Record<string, string | number | null>;
}

export interface MetadataQueryResult {
  columns: string[];
  rows: (string | number | null)[][];
}

export interface IndexResult {
  indexedFiles: number;
  skippedFiles: number;
  durationMs: number;
}
