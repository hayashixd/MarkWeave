/// タイトルバーに未保存マーカーを反映する。
///
/// window-tab-session-design.md §3.3 に準拠:
/// - dirty=true: 「● filename - MarkWeave」
/// - dirty=false: 「filename - MarkWeave」
/// - filename が None の場合はアプリ名のみ表示
#[tauri::command]
pub fn set_title_dirty(
    window: tauri::Window,
    dirty: bool,
    file_name: Option<String>,
) -> Result<(), String> {
    let title = match file_name {
        Some(name) => {
            if dirty {
                format!("● {} - MarkWeave", name)
            } else {
                format!("{} - MarkWeave", name)
            }
        }
        None => "MarkWeave".to_string(),
    };
    window
        .set_title(&title)
        .map_err(|e| format!("タイトルバーの更新に失敗しました: {}", e))
}

/// アプリケーションを再起動する。
///
/// tauri-ipc-interface.md §8 に準拠:
/// - 単一起動モードと競合しないよう Tauri の再起動 API を利用する
#[tauri::command]
pub fn restart_app(app: tauri::AppHandle) -> Result<(), String> {
    app.restart();
    Ok(())
}
