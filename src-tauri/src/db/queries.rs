use rusqlite::{Connection, Result};
use serde::Serialize;

#[derive(Serialize)]
pub struct MetadataQueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
}

/// パース済み SQL を実行してカラム名と行データを返す
pub fn execute_query(conn: &Connection, sql: &str) -> Result<MetadataQueryResult, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| format!("SQL 準備エラー: {}", e))?;

    let column_count = stmt.column_count();
    let columns: Vec<String> = (0..column_count)
        .map(|i| stmt.column_name(i).unwrap_or("?").to_string())
        .collect();

    let rows = stmt
        .query_map([], |row| {
            let mut values = Vec::with_capacity(column_count);
            for i in 0..column_count {
                let val = match row.get_ref(i) {
                    Ok(rusqlite::types::ValueRef::Null) => serde_json::Value::Null,
                    Ok(rusqlite::types::ValueRef::Integer(v)) => {
                        serde_json::Value::Number(serde_json::Number::from(v))
                    }
                    Ok(rusqlite::types::ValueRef::Real(v)) => serde_json::json!(v),
                    Ok(rusqlite::types::ValueRef::Text(v)) => {
                        serde_json::Value::String(String::from_utf8_lossy(v).to_string())
                    }
                    Ok(rusqlite::types::ValueRef::Blob(_)) => serde_json::Value::Null,
                    Err(_) => serde_json::Value::Null,
                };
                values.push(val);
            }
            Ok(values)
        })
        .map_err(|e| format!("SQL 実行エラー: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("行の読み取りエラー: {}", e))?;

    Ok(MetadataQueryResult { columns, rows })
}
