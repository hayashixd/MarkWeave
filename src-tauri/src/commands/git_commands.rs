//! Git 統合コマンド。
//!
//! git-integration-design.md に準拠。
//! git2 クレートを使用し、外部 `git` コマンドへの依存を避ける。

use git2::{DiffOptions, Repository, StatusOptions};
use serde::Serialize;

// ────────────────────────────────── 型定義 ──────────────────────────────────

/// ファイルの Git 状態。tauri-ipc-interface.md §7 に準拠。
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
    pub path: String,
    pub status: String, // "modified" | "added" | "deleted" | "renamed" | "untracked" | "conflicted"
    pub staged: bool,
}

/// ブランチ情報とサマリーカウント。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchInfo {
    pub branch: Option<String>,
    pub modified_count: usize,
    pub untracked_count: usize,
    pub staged_count: usize,
    pub conflicted_count: usize,
}

/// コミット情報。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitInfo {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author: String,
    pub author_email: String,
    pub timestamp: i64,
}

/// コミット結果。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitResult {
    pub sha: String,
    pub short_sha: String,
}

// ────────────────────────────── ヘルパー関数 ──────────────────────────────

fn map_git2_status(st: git2::Status) -> (&'static str, bool) {
    // 返り値: (status_label, staged)
    // staged 側の変更を優先し、次に working tree 側を見る
    if st.is_conflicted() {
        return ("conflicted", false);
    }
    if st.is_index_new() {
        return ("added", true);
    }
    if st.is_index_modified() {
        return ("modified", true);
    }
    if st.is_index_deleted() {
        return ("deleted", true);
    }
    if st.is_index_renamed() {
        return ("renamed", true);
    }
    if st.is_wt_new() {
        return ("untracked", false);
    }
    if st.is_wt_modified() {
        return ("modified", false);
    }
    if st.is_wt_deleted() {
        return ("deleted", false);
    }
    if st.is_wt_renamed() {
        return ("renamed", false);
    }
    ("modified", false)
}

fn open_repo(repo_path: &str) -> Result<Repository, String> {
    Repository::open(repo_path).map_err(|e| format!("Git リポジトリを開けません: {}", e))
}

// ──────────────────────────── Tauri コマンド ────────────────────────────

/// ワークスペースの Git ステータスを取得する。
#[tauri::command]
pub async fn git_status(repo_path: String) -> Result<Vec<GitFileStatus>, String> {
    // ブロッキング操作を tokio のブロッキングスレッドで実行
    tokio::task::spawn_blocking(move || {
        let repo = open_repo(&repo_path)?;
        let mut opts = StatusOptions::new();
        opts.include_untracked(true)
            .recurse_untracked_dirs(true)
            .include_ignored(false);

        let statuses = repo
            .statuses(Some(&mut opts))
            .map_err(|e| format!("Git status の取得に失敗しました: {}", e))?;

        let result: Vec<GitFileStatus> = statuses
            .iter()
            .filter_map(|entry| {
                let path = entry.path()?.to_string();
                let st = entry.status();
                // IGNORED はスキップ
                if st.is_ignored() {
                    return None;
                }

                // ファイルに index 側と working tree 側の両方に変更がある場合、
                // 2 エントリとして返す（staged=true と staged=false）
                let mut items = Vec::new();

                // Index (staged) の変更
                let has_index = st.is_index_new()
                    || st.is_index_modified()
                    || st.is_index_deleted()
                    || st.is_index_renamed();
                // Working tree の変更
                let has_wt = st.is_wt_new()
                    || st.is_wt_modified()
                    || st.is_wt_deleted()
                    || st.is_wt_renamed();
                let is_conflict = st.is_conflicted();

                if is_conflict {
                    items.push(GitFileStatus {
                        path: path.clone(),
                        status: "conflicted".to_string(),
                        staged: false,
                    });
                } else if has_index && has_wt {
                    // 両方の変更がある場合: 2 エントリ
                    let (idx_status, _) = map_git2_status(
                        st & (git2::Status::INDEX_NEW
                            | git2::Status::INDEX_MODIFIED
                            | git2::Status::INDEX_DELETED
                            | git2::Status::INDEX_RENAMED),
                    );
                    items.push(GitFileStatus {
                        path: path.clone(),
                        status: idx_status.to_string(),
                        staged: true,
                    });
                    let wt_status = if st.is_wt_new() {
                        "untracked"
                    } else if st.is_wt_modified() {
                        "modified"
                    } else if st.is_wt_deleted() {
                        "deleted"
                    } else {
                        "renamed"
                    };
                    items.push(GitFileStatus {
                        path,
                        status: wt_status.to_string(),
                        staged: false,
                    });
                } else {
                    let (status, staged) = map_git2_status(st);
                    items.push(GitFileStatus {
                        path,
                        status: status.to_string(),
                        staged,
                    });
                }

                Some(items)
            })
            .flatten()
            .collect();

        Ok(result)
    })
    .await
    .map_err(|e| format!("タスク実行エラー: {}", e))?
}

/// 特定ファイルの diff を unified diff 形式で返す。
#[tauri::command]
pub async fn git_diff(
    repo_path: String,
    file_path: String,
    staged: Option<bool>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = open_repo(&repo_path)?;
        let staged = staged.unwrap_or(false);

        let mut diff_opts = DiffOptions::new();
        diff_opts.pathspec(&file_path);

        let diff = if staged {
            // index vs HEAD
            let head = repo
                .head()
                .and_then(|h| h.peel_to_tree())
                .map_err(|e| format!("HEAD の取得に失敗しました: {}", e))?;
            repo.diff_tree_to_index(Some(&head), None, Some(&mut diff_opts))
        } else {
            // working tree vs index
            repo.diff_index_to_workdir(None, Some(&mut diff_opts))
        }
        .map_err(|e| format!("Diff の取得に失敗しました: {}", e))?;

        let mut output = String::new();
        diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            let origin = line.origin();
            match origin {
                '+' | '-' | ' ' => {
                    output.push(origin);
                }
                _ => {}
            }
            if let Ok(text) = std::str::from_utf8(line.content()) {
                output.push_str(text);
            }
            true
        })
        .map_err(|e| format!("Diff の出力に失敗しました: {}", e))?;

        Ok(output)
    })
    .await
    .map_err(|e| format!("タスク実行エラー: {}", e))?
}

/// ファイルをステージング（git add）する。
#[tauri::command]
pub async fn git_stage(repo_path: String, file_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = open_repo(&repo_path)?;
        let mut index = repo
            .index()
            .map_err(|e| format!("インデックスの取得に失敗しました: {}", e))?;
        index
            .add_path(std::path::Path::new(&file_path))
            .map_err(|e| format!("ステージングに失敗しました: {}", e))?;
        index
            .write()
            .map_err(|e| format!("インデックスの書き込みに失敗しました: {}", e))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("タスク実行エラー: {}", e))?
}

/// ファイルをステージング解除（git restore --staged）する。
#[tauri::command]
pub async fn git_unstage(repo_path: String, file_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = open_repo(&repo_path)?;

        // HEAD のツリーからエントリを取得し、インデックスを更新
        let head = repo.head().and_then(|h| h.peel_to_tree());
        let mut index = repo
            .index()
            .map_err(|e| format!("インデックスの取得に失敗しました: {}", e))?;

        match head {
            Ok(tree) => {
                // HEAD にファイルが存在する場合、HEAD の状態に戻す
                let entry = tree.get_path(std::path::Path::new(&file_path));
                match entry {
                    Ok(te) => {
                        let idx_entry = git2::IndexEntry {
                            ctime: git2::IndexTime::new(0, 0),
                            mtime: git2::IndexTime::new(0, 0),
                            dev: 0,
                            ino: 0,
                            mode: te.filemode() as u32,
                            uid: 0,
                            gid: 0,
                            file_size: 0,
                            id: te.id(),
                            flags: 0,
                            flags_extended: 0,
                            path: file_path.as_bytes().to_vec(),
                        };
                        index.add(&idx_entry).map_err(|e| {
                            format!("インデックスの更新に失敗しました: {}", e)
                        })?;
                    }
                    Err(_) => {
                        // HEAD に無いファイル（新規追加）→ インデックスから削除
                        index.remove_path(std::path::Path::new(&file_path)).map_err(|e| {
                            format!("インデックスからの削除に失敗しました: {}", e)
                        })?;
                    }
                }
            }
            Err(_) => {
                // HEAD が無い（初コミット前）→ インデックスから削除
                index.remove_path(std::path::Path::new(&file_path)).map_err(|e| {
                    format!("インデックスからの削除に失敗しました: {}", e)
                })?;
            }
        }

        index
            .write()
            .map_err(|e| format!("インデックスの書き込みに失敗しました: {}", e))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("タスク実行エラー: {}", e))?
}

/// コミットを実行する。
#[tauri::command]
pub async fn git_commit(repo_path: String, message: String) -> Result<GitCommitResult, String> {
    tokio::task::spawn_blocking(move || {
        let repo = open_repo(&repo_path)?;

        let mut index = repo
            .index()
            .map_err(|e| format!("インデックスの取得に失敗しました: {}", e))?;
        let tree_oid = index
            .write_tree()
            .map_err(|e| format!("ツリーの書き込みに失敗しました: {}", e))?;
        let tree = repo
            .find_tree(tree_oid)
            .map_err(|e| format!("ツリーの取得に失敗しました: {}", e))?;

        let sig = repo
            .signature()
            .map_err(|e| format!("署名の取得に失敗しました（git config で user.name / user.email を設定してください）: {}", e))?;

        // 親コミット（HEAD がある場合）
        let parent_commit = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
        let parents: Vec<&git2::Commit> = parent_commit.iter().collect();

        let oid = repo
            .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
            .map_err(|e| format!("コミットに失敗しました: {}", e))?;

        let sha = oid.to_string();
        let short_sha = sha[..7.min(sha.len())].to_string();

        Ok(GitCommitResult { sha, short_sha })
    })
    .await
    .map_err(|e| format!("タスク実行エラー: {}", e))?
}

/// コミット履歴を取得する。
#[tauri::command]
pub async fn git_log(repo_path: String, limit: Option<usize>) -> Result<Vec<GitCommitInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = open_repo(&repo_path)?;
        let limit = limit.unwrap_or(50);

        let mut revwalk = repo
            .revwalk()
            .map_err(|e| format!("リビジョンウォークの作成に失敗しました: {}", e))?;
        revwalk
            .push_head()
            .map_err(|e| format!("HEAD の解決に失敗しました: {}", e))?;
        revwalk.set_sorting(git2::Sort::TIME).ok();

        let mut commits = Vec::new();
        for oid_result in revwalk.take(limit) {
            let oid = oid_result
                .map_err(|e| format!("OID の取得に失敗しました: {}", e))?;
            let commit = repo
                .find_commit(oid)
                .map_err(|e| format!("コミットの取得に失敗しました: {}", e))?;

            let sha = oid.to_string();
            let short_sha = sha[..7.min(sha.len())].to_string();
            let message = commit.message().unwrap_or("").to_string();
            let author = commit.author();

            commits.push(GitCommitInfo {
                sha,
                short_sha,
                message,
                author: author.name().unwrap_or("").to_string(),
                author_email: author.email().unwrap_or("").to_string(),
                timestamp: author.when().seconds(),
            });
        }

        Ok(commits)
    })
    .await
    .map_err(|e| format!("タスク実行エラー: {}", e))?
}

/// ブランチ情報と変更件数サマリーを取得する。
#[tauri::command]
pub async fn git_branch_info(repo_path: String) -> Result<GitBranchInfo, String> {
    tokio::task::spawn_blocking(move || {
        let repo = open_repo(&repo_path)?;

        // ブランチ名
        let branch = repo
            .head()
            .ok()
            .and_then(|h| {
                if h.is_branch() {
                    h.shorthand().map(|s| s.to_string())
                } else {
                    // detached HEAD
                    h.target().map(|oid| {
                        let s = oid.to_string();
                        s[..7.min(s.len())].to_string()
                    })
                }
            });

        // ステータスサマリー
        let mut opts = StatusOptions::new();
        opts.include_untracked(true)
            .recurse_untracked_dirs(true)
            .include_ignored(false);

        let statuses = repo
            .statuses(Some(&mut opts))
            .map_err(|e| format!("Git status の取得に失敗しました: {}", e))?;

        let mut modified_count = 0usize;
        let mut untracked_count = 0usize;
        let mut staged_count = 0usize;
        let mut conflicted_count = 0usize;

        for entry in statuses.iter() {
            let st = entry.status();
            if st.is_ignored() {
                continue;
            }
            if st.is_conflicted() {
                conflicted_count += 1;
                continue;
            }
            if st.is_index_new()
                || st.is_index_modified()
                || st.is_index_deleted()
                || st.is_index_renamed()
            {
                staged_count += 1;
            }
            if st.is_wt_modified() || st.is_wt_deleted() || st.is_wt_renamed() {
                modified_count += 1;
            }
            if st.is_wt_new() {
                untracked_count += 1;
            }
        }

        Ok(GitBranchInfo {
            branch,
            modified_count,
            untracked_count,
            staged_count,
            conflicted_count,
        })
    })
    .await
    .map_err(|e| format!("タスク実行エラー: {}", e))?
}
