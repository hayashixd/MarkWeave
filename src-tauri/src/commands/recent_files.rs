/**
 * Windows ジャンプリスト・最近使ったファイル登録コマンド
 *
 * window-tab-session-design.md §4.2 に準拠。
 *
 * Windows では `SHAddToRecentDocs` を呼び出すことで
 * タスクバーのジャンプリストと「最近使ったファイル」の両方に
 * ファイルを登録できる。macOS / Linux では何もしない。
 */

/// ファイルを Windows のジャンプリストと「最近使ったファイル」に登録する。
///
/// Windows のみ `SHAddToRecentDocs`（SHARD_PATHW）を呼び出す。
/// macOS / Linux では no-op。
#[tauri::command]
pub fn add_to_recent_documents(path: String) {
    #[cfg(target_os = "windows")]
    {
        use windows::core::HSTRING;
        use windows::Win32::UI::Shell::SHAddToRecentDocs;

        let hpath = HSTRING::from(&path);
        // SHARD_PATHW = 0x0000_0003: パス文字列として渡す。
        // Windows が自動的にジャンプリストと「最近使ったファイル」の両方に登録する。
        unsafe {
            SHAddToRecentDocs(0x0000_0003, Some(hpath.as_ptr() as _));
        }
        log::info!("add_to_recent_documents (Windows): {}", path);
    }

    #[cfg(not(target_os = "windows"))]
    {
        // macOS / Linux では将来対応。現時点は no-op。
        let _ = path;
    }
}
