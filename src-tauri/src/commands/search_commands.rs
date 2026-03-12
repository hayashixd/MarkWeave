//! ワークスペース横断全文検索用 Tauri コマンド。
//!
//! tauri-ipc-interface.md §4 / search-design.md §3.2 に準拠。
//! Rust の `walkdir` + `regex` クレートで内製する。

use serde::{Deserialize, Serialize};
use std::path::Path;
use walkdir::WalkDir;

/// 検索リクエスト引数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchWorkspaceArgs {
    pub root_path: String,
    pub query: String,
    pub is_regex: bool,
    pub case_sensitive: bool,
    pub include_patterns: Option<Vec<String>>,
    pub exclude_patterns: Option<Vec<String>>,
    pub max_results: Option<usize>,
}

/// 検索マッチ結果
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub file_path: String,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

/// 検索結果
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchWorkspaceResult {
    pub matches: Vec<SearchMatch>,
    pub total_files: usize,
    pub searched_files: usize,
    pub truncated: bool,
}

/// glob パターンとファイルパスのマッチング（簡易実装）
fn matches_glob(pattern: &str, path: &str) -> bool {
    let pattern = pattern.trim();
    if pattern.is_empty() {
        return false;
    }

    // "*.ext" パターン
    if let Some(ext) = pattern.strip_prefix("*.") {
        return path.ends_with(&format!(".{}", ext));
    }

    // "dir/**" パターン
    if let Some(prefix) = pattern.strip_suffix("/**") {
        let prefix_normalized = prefix.replace('\\', "/");
        let path_normalized = path.replace('\\', "/");
        return path_normalized.contains(&prefix_normalized);
    }

    path.contains(pattern)
}

/// パスがフィルタ条件に一致するかチェック
fn should_include(
    path: &str,
    include: &Option<Vec<String>>,
    exclude: &Option<Vec<String>>,
) -> bool {
    // exclude チェック
    if let Some(patterns) = exclude {
        for pat in patterns {
            if matches_glob(pat, path) {
                return false;
            }
        }
    }

    // include チェック（指定がなければ全許可）
    if let Some(patterns) = include {
        if patterns.is_empty() {
            return true;
        }
        for pat in patterns {
            if matches_glob(pat, path) {
                return true;
            }
        }
        return false;
    }

    true
}

/// ワークスペース横断全文検索を実行する Tauri コマンド。
///
/// tauri-ipc-interface.md §4 `search_workspace` に準拠。
/// search-design.md §3.2 の設計に従い、walkdir + regex で検索する。
#[tauri::command]
pub async fn search_workspace(
    root_path: String,
    query: String,
    is_regex: bool,
    case_sensitive: bool,
    include_patterns: Option<Vec<String>>,
    exclude_patterns: Option<Vec<String>>,
    max_results: Option<usize>,
) -> Result<SearchWorkspaceResult, String> {
    let root = Path::new(&root_path);
    if !root.is_dir() {
        return Err(format!(
            "FILE_NOT_FOUND: ディレクトリが見つかりません: {}",
            root_path
        ));
    }

    let max = max_results.unwrap_or(1000);

    // 正規表現を構築
    let re = if is_regex {
        regex::RegexBuilder::new(&query)
            .case_insensitive(!case_sensitive)
            .build()
            .map_err(|e| format!("INVALID_REGEX: 無効な正規表現: {}", e))?
    } else {
        let escaped = regex::escape(&query);
        regex::RegexBuilder::new(&escaped)
            .case_insensitive(!case_sensitive)
            .build()
            .map_err(|e| format!("INVALID_REGEX: 検索パターンの構築に失敗: {}", e))?
    };

    let mut matches: Vec<SearchMatch> = Vec::new();
    let mut total_files: usize = 0;
    let mut searched_files: usize = 0;
    let mut truncated = false;

    for entry in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            // 隠しディレクトリをスキップ
            let name = e.file_name().to_string_lossy();
            !name.starts_with('.')
        })
    {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        if !entry.file_type().is_file() {
            continue;
        }

        total_files += 1;

        let path_str = entry.path().to_string_lossy().to_string();

        // フィルタ
        if !should_include(&path_str, &include_patterns, &exclude_patterns) {
            continue;
        }

        // テキストファイルのみ検索（バイナリはスキップ）
        let content = match std::fs::read_to_string(entry.path()) {
            Ok(c) => c,
            Err(_) => continue, // 読み取り不可またはバイナリ
        };

        searched_files += 1;

        // 相対パスに変換
        let relative_path = entry
            .path()
            .strip_prefix(root)
            .unwrap_or(entry.path())
            .to_string_lossy()
            .replace('\\', "/");

        for (line_idx, line) in content.lines().enumerate() {
            if matches.len() >= max {
                truncated = true;
                break;
            }

            for m in re.find_iter(line) {
                if matches.len() >= max {
                    truncated = true;
                    break;
                }

                matches.push(SearchMatch {
                    file_path: relative_path.clone(),
                    line_number: line_idx + 1,
                    line_content: line.to_string(),
                    match_start: m.start(),
                    match_end: m.end(),
                });
            }
        }

        if truncated {
            break;
        }
    }

    log::info!(
        "search_workspace: found {} matches in {}/{} files (truncated: {})",
        matches.len(),
        searched_files,
        total_files,
        truncated
    );

    Ok(SearchWorkspaceResult {
        matches,
        total_files,
        searched_files,
        truncated,
    })
}
