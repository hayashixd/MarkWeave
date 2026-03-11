import { describe, it, expect } from 'vitest';
import { parseQuery, astToSql } from './query-parser';
import type { WhereCondition } from './query-parser';

describe('parseQuery', () => {
  it('基本的な SELECT / FROM / VIEW をパースできる', () => {
    const ast = parseQuery(`
      SELECT title, tags, modified
      FROM files
      VIEW table
    `);
    expect(ast.select).toEqual(['title', 'tags', 'modified']);
    expect(ast.view).toBe('table');
    expect(ast.where).toEqual([]);
  });

  it('ORDER BY と LIMIT をパースできる', () => {
    const ast = parseQuery(`
      SELECT title
      FROM files
      ORDER BY modified DESC
      LIMIT 10
      VIEW list
    `);
    expect(ast.orderBy).toEqual({ field: 'modified', direction: 'DESC' });
    expect(ast.limit).toBe(10);
    expect(ast.view).toBe('list');
  });

  it('WHERE CONTAINS 条件をパースできる', () => {
    const ast = parseQuery(`
      SELECT title
      FROM files
      WHERE tags CONTAINS "project"
      VIEW table
    `);
    expect(ast.where).toHaveLength(1);
    expect(ast.where[0]).toEqual({
      field: 'tags',
      operator: 'CONTAINS',
      value: 'project',
    });
  });

  it('WHERE に複数の AND 条件をパースできる', () => {
    const ast = parseQuery(`
      SELECT title, tags, status
      FROM files
      WHERE tags CONTAINS "project"
      AND status = "active"
      AND wordcount > 500
      VIEW table
    `);
    expect(ast.where).toHaveLength(3);
    expect(ast.where[0].operator).toBe('CONTAINS');
    expect(ast.where[1]).toEqual({
      field: 'status',
      operator: '=',
      value: 'active',
    });
    expect(ast.where[2]).toEqual({
      field: 'wordcount',
      operator: '>',
      value: 500,
    });
  });

  it('IS NULL / IS NOT NULL をパースできる', () => {
    const ast = parseQuery(`
      SELECT title
      FROM files
      WHERE author IS NOT NULL
      AND priority IS NULL
      VIEW table
    `);
    expect(ast.where).toHaveLength(2);
    expect(ast.where[0]).toEqual({ field: 'author', operator: 'IS NOT NULL' });
    expect(ast.where[1]).toEqual({ field: 'priority', operator: 'IS NULL' });
  });
});

describe('parseQuery - BETWEEN...AND 文法堅牢化', () => {
  it('BETWEEN...AND を条件区切りの AND と誤認しない', () => {
    const ast = parseQuery(`
      SELECT title, date
      FROM files
      WHERE tags CONTAINS "meeting"
      AND date BETWEEN "2026-01-01" AND "2026-03-31"
      ORDER BY date ASC
      VIEW table
    `);
    expect(ast.where).toHaveLength(2);
    expect(ast.where[0]).toEqual({
      field: 'tags',
      operator: 'CONTAINS',
      value: 'meeting',
    });
    expect(ast.where[1]).toEqual({
      field: 'date',
      operator: 'BETWEEN',
      value: '2026-01-01',
      value2: '2026-03-31',
    });
  });

  it('BETWEEN の後に更に AND 条件が続く場合も正しくパースできる', () => {
    const ast = parseQuery(`
      SELECT title, date, status
      FROM files
      WHERE date BETWEEN "2026-01-01" AND "2026-03-31"
      AND status = "active"
      VIEW table
    `);
    expect(ast.where).toHaveLength(2);
    expect(ast.where[0]).toEqual({
      field: 'date',
      operator: 'BETWEEN',
      value: '2026-01-01',
      value2: '2026-03-31',
    });
    expect(ast.where[1]).toEqual({
      field: 'status',
      operator: '=',
      value: 'active',
    });
  });

  it('BETWEEN が先頭条件でも正しくパースできる', () => {
    const ast = parseQuery(`
      SELECT title
      FROM files
      WHERE modified BETWEEN "2026-02-01" AND "2026-02-28"
      VIEW list
    `);
    expect(ast.where).toHaveLength(1);
    expect(ast.where[0]).toEqual({
      field: 'modified',
      operator: 'BETWEEN',
      value: '2026-02-01',
      value2: '2026-02-28',
    });
  });

  it('複数の BETWEEN 条件を含むクエリを正しくパースできる', () => {
    const ast = parseQuery(`
      SELECT title
      FROM files
      WHERE created BETWEEN "2026-01-01" AND "2026-06-30"
      AND modified BETWEEN "2026-03-01" AND "2026-03-31"
      VIEW table
    `);
    expect(ast.where).toHaveLength(2);
    expect(ast.where[0].operator).toBe('BETWEEN');
    expect(ast.where[0].value).toBe('2026-01-01');
    expect(ast.where[0].value2).toBe('2026-06-30');
    expect(ast.where[1].operator).toBe('BETWEEN');
    expect(ast.where[1].value).toBe('2026-03-01');
    expect(ast.where[1].value2).toBe('2026-03-31');
  });

  it('BETWEEN + CONTAINS + 比較演算子が混在するクエリ', () => {
    const ast = parseQuery(`
      SELECT title, tags, date, wordcount
      FROM files
      WHERE tags CONTAINS "project"
      AND date BETWEEN "2026-01-01" AND "2026-12-31"
      AND wordcount >= 1000
      VIEW table
    `);
    expect(ast.where).toHaveLength(3);
    expect(ast.where[0].operator).toBe('CONTAINS');
    expect(ast.where[1].operator).toBe('BETWEEN');
    expect(ast.where[1].value).toBe('2026-01-01');
    expect(ast.where[1].value2).toBe('2026-12-31');
    expect(ast.where[2]).toEqual({
      field: 'wordcount',
      operator: '>=',
      value: 1000,
    });
  });

  it('文字列リテラル内の "between" を BETWEEN キーワードと誤認しない', () => {
    const ast = parseQuery(`
      SELECT title, status
      FROM files
      WHERE title CONTAINS "foo between bar"
      AND status = "active"
      VIEW table
    `);
    expect(ast.where).toHaveLength(2);
    expect(ast.where[0]).toEqual({
      field: 'title',
      operator: 'CONTAINS',
      value: 'foo between bar',
    });
    expect(ast.where[1]).toEqual({
      field: 'status',
      operator: '=',
      value: 'active',
    });
  });

  it('引用符なしの BETWEEN 値もパースできる', () => {
    const ast = parseQuery(`
      SELECT title
      FROM files
      WHERE wordcount BETWEEN 100 AND 5000
      VIEW table
    `);
    expect(ast.where).toHaveLength(1);
    expect(ast.where[0].operator).toBe('BETWEEN');
  });
});

describe('astToSql', () => {
  it('BETWEEN 条件を正しい SQL に変換する', () => {
    const ast = parseQuery(`
      SELECT title, date
      FROM files
      WHERE date BETWEEN "2026-01-01" AND "2026-03-31"
      VIEW table
    `);
    const sql = astToSql(ast);
    expect(sql).toContain("BETWEEN '2026-01-01' AND '2026-03-31'");
  });

  it('frontmatter フィールドの BETWEEN を正しい SQL に変換する', () => {
    const ast = parseQuery(`
      SELECT title, priority
      FROM files
      WHERE priority BETWEEN "1" AND "5"
      VIEW table
    `);
    const sql = astToSql(ast);
    expect(sql).toContain("BETWEEN '1' AND '5'");
    expect(sql).toContain('fm.key');
  });

  it('BETWEEN と他の条件が混在する SQL を正しく生成する', () => {
    const ast = parseQuery(`
      SELECT title, tags, date
      FROM files
      WHERE tags CONTAINS "meeting"
      AND date BETWEEN "2026-01-01" AND "2026-03-31"
      VIEW table
    `);
    const sql = astToSql(ast);
    expect(sql).toContain('EXISTS (SELECT 1 FROM tags t2');
    expect(sql).toContain("BETWEEN '2026-01-01' AND '2026-03-31'");
  });
});
