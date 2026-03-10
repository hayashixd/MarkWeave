export interface QueryAST {
  select: string[];
  where: WhereCondition[];
  orderBy?: { field: string; direction: 'ASC' | 'DESC' };
  limit?: number;
  view: 'table' | 'list' | 'calendar';
}

export interface WhereCondition {
  field: string;
  operator:
    | 'CONTAINS'
    | '='
    | '!='
    | '>'
    | '<'
    | '>='
    | '<='
    | 'BETWEEN'
    | 'IS NULL'
    | 'IS NOT NULL';
  value?: string | number;
  value2?: string | number; // BETWEEN の上限値
}

const BUILTIN_FIELDS = new Set([
  'title',
  'name',
  'path',
  'created',
  'modified',
  'wordcount',
  'size',
  'tags',
  'tasks',
  'tasks_done',
  'links',
  'backlinks',
]);

export function parseQuery(queryText: string): QueryAST {
  const lines = queryText
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const ast: QueryAST = { select: [], where: [], view: 'table' };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^SELECT\s+/i.test(line)) {
      ast.select = line
        .replace(/^SELECT\s+/i, '')
        .split(',')
        .map((f) => f.trim().toLowerCase());
    } else if (/^FROM\s+/i.test(line)) {
      // FROM files は固定なのでスキップ
    } else if (/^WHERE\s+/i.test(line)) {
      let whereText = line.replace(/^WHERE\s+/i, '');
      while (i + 1 < lines.length && /^AND\s+/i.test(lines[i + 1])) {
        i++;
        whereText += ' AND ' + lines[i].replace(/^AND\s+/i, '');
      }
      ast.where = parseWhereClause(whereText);
    } else if (/^ORDER BY\s+/i.test(line)) {
      const m = line.match(/^ORDER BY\s+(\w+)\s*(ASC|DESC)?$/i);
      if (m) {
        ast.orderBy = {
          field: m[1].toLowerCase(),
          direction: (m[2]?.toUpperCase() as 'ASC' | 'DESC') ?? 'DESC',
        };
      }
    } else if (/^LIMIT\s+(\d+)$/i.test(line)) {
      ast.limit = parseInt(line.replace(/^LIMIT\s+/i, ''), 10);
    } else if (/^VIEW\s+(table|list|calendar)$/i.test(line)) {
      ast.view = line.replace(/^VIEW\s+/i, '').toLowerCase() as
        | 'table'
        | 'list'
        | 'calendar';
    }
    i++;
  }

  return ast;
}

export function astToSql(ast: QueryAST): string {
  const fmKeys = ast.select.filter((f) => !BUILTIN_FIELDS.has(f));
  const needsTags =
    ast.select.includes('tags') || ast.where.some((c) => c.field === 'tags');
  const needsTasks =
    ast.select.some((f) => f === 'tasks' || f === 'tasks_done') ||
    ast.where.some((c) => c.field === 'tasks' || c.field === 'tasks_done');

  // SELECT 句の構築
  const selectCols: string[] = [
    'f.id',
    'f.path',
    'f.name',
    'f.title',
    'f.created_at',
    'f.modified_at',
    'f.word_count',
    'f.size_bytes',
  ];
  if (needsTags) {
    selectCols.push('GROUP_CONCAT(DISTINCT t.tag) AS tags');
  }
  if (needsTasks) {
    selectCols.push(
      'SUM(CASE WHEN tk.checked = 0 THEN 1 ELSE 0 END) AS tasks',
      'SUM(CASE WHEN tk.checked = 1 THEN 1 ELSE 0 END) AS tasks_done',
    );
  }
  // frontmatter キーを MAX(CASE...) パターンで選択
  fmKeys.forEach((key) => {
    selectCols.push(
      `MAX(CASE WHEN fm_all.key = '${key}' THEN fm_all.value END) AS "${key}"`,
    );
  });

  // FROM + JOIN
  let sql = `SELECT ${selectCols.join(', ')}\nFROM files f\n`;
  if (needsTags) {
    sql += `LEFT JOIN tags t ON t.file_id = f.id\n`;
  }
  if (needsTasks) {
    sql += `LEFT JOIN tasks tk ON tk.file_id = f.id\n`;
  }
  if (fmKeys.length > 0) {
    sql += `LEFT JOIN frontmatter fm_all ON fm_all.file_id = f.id\n`;
  }

  // WHERE 句
  const whereParts: string[] = [];
  for (const cond of ast.where) {
    whereParts.push(conditionToSql(cond));
  }
  if (whereParts.length > 0) {
    sql += `WHERE ${whereParts.join('\nAND ')}\n`;
  }

  sql += `GROUP BY f.id\n`;

  // ORDER BY
  if (ast.orderBy) {
    const col = builtinToColumn(ast.orderBy.field);
    sql += `ORDER BY ${col} ${ast.orderBy.direction}\n`;
  }

  // LIMIT
  if (ast.limit) {
    sql += `LIMIT ${ast.limit}\n`;
  }

  return sql;
}

function conditionToSql(cond: WhereCondition): string {
  if (cond.field === 'tags') {
    if (cond.operator === 'CONTAINS') {
      return `EXISTS (SELECT 1 FROM tags t2 WHERE t2.file_id = f.id AND t2.tag = ${quote(cond.value)})`;
    }
  }
  if (!BUILTIN_FIELDS.has(cond.field)) {
    // frontmatter フィールド
    const col = `(SELECT fm.value FROM frontmatter fm WHERE fm.file_id = f.id AND fm.key = ${quote(cond.field)} LIMIT 1)`;
    return `${col} ${operatorToSql(cond.operator)} ${quote(cond.value)}`;
  }
  const col = builtinToColumn(cond.field);
  if (cond.operator === 'BETWEEN') {
    return `${col} BETWEEN ${quote(cond.value)} AND ${quote(cond.value2)}`;
  }
  if (cond.operator === 'IS NULL') return `${col} IS NULL`;
  if (cond.operator === 'IS NOT NULL') return `${col} IS NOT NULL`;
  if (cond.operator === 'CONTAINS') {
    return `${col} LIKE ${quote('%' + cond.value + '%')}`;
  }
  return `${col} ${operatorToSql(cond.operator)} ${quote(cond.value)}`;
}

function builtinToColumn(field: string): string {
  const map: Record<string, string> = {
    title: 'f.title',
    name: 'f.name',
    path: 'f.path',
    created: 'f.created_at',
    modified: 'f.modified_at',
    wordcount: 'f.word_count',
    size: 'f.size_bytes',
  };
  return map[field] ?? field;
}

function quote(v: unknown): string {
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function operatorToSql(op: string): string {
  return op === 'CONTAINS' ? 'LIKE' : op;
}

function parseWhereClause(text: string): WhereCondition[] {
  return text.split(/\bAND\b/i).map((part) => {
    const trimmed = part.trim();
    const betweenM = trimmed.match(
      /^(\w+)\s+BETWEEN\s+["']?([^"']+)["']?\s+AND\s+["']?([^"']+)["']?$/i,
    );
    if (betweenM) {
      return {
        field: betweenM[1].toLowerCase(),
        operator: 'BETWEEN' as const,
        value: betweenM[2],
        value2: betweenM[3],
      };
    }
    const containsM = trimmed.match(
      /^(\w+)\s+CONTAINS\s+["']([^"']+)["']$/i,
    );
    if (containsM) {
      return {
        field: containsM[1].toLowerCase(),
        operator: 'CONTAINS' as const,
        value: containsM[2],
      };
    }
    const isNullM = trimmed.match(/^(\w+)\s+IS\s+NULL$/i);
    if (isNullM) {
      return {
        field: isNullM[1].toLowerCase(),
        operator: 'IS NULL' as const,
      };
    }
    const isNotNullM = trimmed.match(/^(\w+)\s+IS\s+NOT\s+NULL$/i);
    if (isNotNullM) {
      return {
        field: isNotNullM[1].toLowerCase(),
        operator: 'IS NOT NULL' as const,
      };
    }
    const opM = trimmed.match(
      /^(\w+)\s*(!=|>=|<=|>|<|=)\s*["']?([^"']+)["']?$/,
    );
    if (opM) {
      const val = opM[3];
      const numVal = Number(val);
      return {
        field: opM[1].toLowerCase(),
        operator: opM[2] as WhereCondition['operator'],
        value: isNaN(numVal) ? val : numVal,
      };
    }
    return { field: trimmed, operator: 'IS NOT NULL' as const };
  });
}
