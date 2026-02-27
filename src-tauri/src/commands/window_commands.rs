/// タイトルバーに未保存マーカーを反映する。
///
/// window-tab-session-design.md §3.3 に準拠:
/// - dirty=true: 「● filename - Markdown Editor」
/// - dirty=false: 「filename - Markdown Editor」
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
                format!("● {} - Markdown Editor", name)
            } else {
                format!("{} - Markdown Editor", name)
            }
        }
        None => "Markdown Editor".to_string(),
    };
    window
        .set_title(&title)
        .map_err(|e| format!("タイトルバーの更新に失敗しました: {}", e))
}
