// Native menu - OS ネイティブのメニューバー管理
// app-shell-design.md §2 に準拠

use tauri::menu::{
    AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
};
use tauri::{AppHandle, Emitter, Wry};

/// メニュー表示言語
#[derive(Debug, Clone, Copy)]
pub enum Lang {
    Ja,
    En,
}

/// 言語に応じたラベルを返す
#[inline]
fn l<'a>(lang: Lang, ja: &'a str, en: &'a str) -> &'a str {
    match lang {
        Lang::Ja => ja,
        Lang::En => en,
    }
}

/// メニューアイテム ID 定数
mod ids {
    // ファイルメニュー
    pub const FILE_NEW: &str = "file_new";
    pub const FILE_OPEN: &str = "file_open";
    pub const FILE_OPEN_FOLDER: &str = "file_open_folder";
    pub const FILE_RECENT_FILES: &str = "file_recent_files";
    pub const FILE_RECENT_WORKSPACES: &str = "file_recent_workspaces";
    pub const FILE_SAVE: &str = "file_save";
    pub const FILE_SAVE_AS: &str = "file_save_as";
    pub const FILE_EXPORT_HTML: &str = "file_export_html";
    pub const FILE_EXPORT_PDF: &str = "file_export_pdf";
    pub const FILE_EXPORT_WORD: &str = "file_export_word";
    pub const FILE_EXPORT_LATEX: &str = "file_export_latex";
    pub const FILE_EXPORT_EPUB: &str = "file_export_epub";
    pub const FILE_SAVE_AS_MD: &str = "file_save_as_md";
    pub const FILE_SAVE_AS_HTML: &str = "file_save_as_html";
    pub const FILE_TEMPLATE_NEW: &str = "file_template_new";
    pub const FILE_DAILY_NOTE: &str = "file_daily_note";
    pub const FILE_PRINT: &str = "file_print";
    // 編集メニュー
    pub const EDIT_PASTE_PLAIN: &str = "edit_paste_plain";
    pub const EDIT_FIND: &str = "edit_find";
    pub const EDIT_FIND_REPLACE: &str = "edit_find_replace";
    pub const EDIT_TEXT_STATS: &str = "edit_text_stats";
    pub const EDIT_PREFERENCES: &str = "edit_preferences";
    // 表示メニュー
    pub const VIEW_MODE_WYSIWYG: &str = "view_mode_wysiwyg";
    pub const VIEW_MODE_SOURCE: &str = "view_mode_source";
    pub const VIEW_SIDEBAR_TOGGLE: &str = "view_sidebar_toggle";
    pub const VIEW_OUTLINE: &str = "view_outline";
    pub const VIEW_FILES: &str = "view_files";
    pub const VIEW_AI_TEMPLATES: &str = "view_ai_templates";
    pub const VIEW_BACKLINKS: &str = "view_backlinks";
    pub const VIEW_TAGS: &str = "view_tags";
    pub const VIEW_GIT: &str = "view_git";
    pub const VIEW_LINT: &str = "view_lint";
    pub const VIEW_FLOATING_TOC: &str = "view_floating_toc";
    pub const VIEW_SPLIT_PANE: &str = "view_split_pane";
    pub const VIEW_FOCUS_MODE: &str = "view_focus_mode";
    pub const VIEW_TYPEWRITER_MODE: &str = "view_typewriter_mode";
    pub const VIEW_ZEN_MODE: &str = "view_zen_mode";
    pub const VIEW_ZOOM_RESET: &str = "view_zoom_reset";
    pub const VIEW_ZOOM_IN: &str = "view_zoom_in";
    pub const VIEW_ZOOM_OUT: &str = "view_zoom_out";
    // ヘルプメニュー
    pub const HELP_SHORTCUTS: &str = "help_shortcuts";
    pub const HELP_VERSION: &str = "help_version";
    pub const HELP_FEEDBACK: &str = "help_feedback";
    pub const HELP_CHECK_UPDATES: &str = "help_check_updates";
}

/// ネイティブメニューバーを構築してアプリに設定する
pub fn build_menu(app: &AppHandle<Wry>, lang: Lang) -> Result<(), Box<dyn std::error::Error>> {
    // ─── ファイルメニュー ───
    let file_submenu = SubmenuBuilder::new(app, l(lang, "ファイル", "File"))
        .item(
            &MenuItemBuilder::with_id(ids::FILE_NEW, l(lang, "新規ファイル", "New File"))
                .accelerator("CmdOrCtrl+N")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::FILE_OPEN, l(lang, "開く...", "Open..."))
                .accelerator("CmdOrCtrl+O")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(
                ids::FILE_OPEN_FOLDER,
                l(lang, "フォルダを開く...", "Open Folder..."),
            )
            .accelerator("CmdOrCtrl+Shift+O")
            .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(
                ids::FILE_RECENT_FILES,
                l(lang, "最近使ったファイル...", "Recent Files..."),
            )
            .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(
                ids::FILE_RECENT_WORKSPACES,
                l(lang, "最近のワークスペース...", "Recent Workspaces..."),
            )
            .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(ids::FILE_SAVE, l(lang, "保存", "Save"))
                .accelerator("CmdOrCtrl+S")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::FILE_SAVE_AS, l(lang, "名前を付けて保存...", "Save As..."))
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?,
        )
        .separator()
        .item(
            &SubmenuBuilder::new(app, l(lang, "エクスポート", "Export"))
                .item(
                    &MenuItemBuilder::with_id(
                        ids::FILE_EXPORT_HTML,
                        l(lang, "HTML にエクスポート...", "Export to HTML..."),
                    )
                    .accelerator("CmdOrCtrl+Shift+E")
                    .build(app)?,
                )
                .item(
                    &MenuItemBuilder::with_id(
                        ids::FILE_EXPORT_PDF,
                        l(lang, "PDF にエクスポート...", "Export to PDF..."),
                    )
                    .accelerator("CmdOrCtrl+Alt+P")
                    .build(app)?,
                )
                .separator()
                .item(
                    &MenuItemBuilder::with_id(
                        ids::FILE_EXPORT_WORD,
                        l(lang, "Word (.docx) にエクスポート...", "Export to Word (.docx)..."),
                    )
                    .accelerator("CmdOrCtrl+Alt+W")
                    .build(app)?,
                )
                .item(
                    &MenuItemBuilder::with_id(
                        ids::FILE_EXPORT_LATEX,
                        l(lang, "LaTeX にエクスポート...", "Export to LaTeX..."),
                    )
                    .build(app)?,
                )
                .item(
                    &MenuItemBuilder::with_id(
                        ids::FILE_EXPORT_EPUB,
                        l(lang, "ePub にエクスポート...", "Export to ePub..."),
                    )
                    .build(app)?,
                )
                .build()?,
        )
        .item(
            &SubmenuBuilder::new(app, l(lang, "別名で保存", "Save Copy As"))
                .item(
                    &MenuItemBuilder::with_id(
                        ids::FILE_SAVE_AS_MD,
                        l(lang, "Markdown として保存...", "Save as Markdown..."),
                    )
                    .accelerator("CmdOrCtrl+Shift+M")
                    .build(app)?,
                )
                .item(
                    &MenuItemBuilder::with_id(
                        ids::FILE_SAVE_AS_HTML,
                        l(lang, "HTML として保存...", "Save as HTML..."),
                    )
                    .accelerator("CmdOrCtrl+Shift+H")
                    .build(app)?,
                )
                .build()?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(
                ids::FILE_TEMPLATE_NEW,
                l(lang, "テンプレートから新規作成...", "New from Template..."),
            )
            .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(
                ids::FILE_DAILY_NOTE,
                l(lang, "デイリーノート作成", "Create Daily Note"),
            )
            .accelerator("CmdOrCtrl+Alt+D")
            .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(ids::FILE_PRINT, l(lang, "印刷...", "Print..."))
                .accelerator("CmdOrCtrl+P")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some(l(lang, "アプリを終了", "Quit")))?)
        .build()?;

    // ─── 編集メニュー ───
    let edit_submenu = SubmenuBuilder::new(app, l(lang, "編集", "Edit"))
        .item(&PredefinedMenuItem::undo(app, Some(l(lang, "元に戻す", "Undo")))?)
        .item(&PredefinedMenuItem::redo(app, Some(l(lang, "やり直す", "Redo")))?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, Some(l(lang, "切り取り", "Cut")))?)
        .item(&PredefinedMenuItem::copy(app, Some(l(lang, "コピー", "Copy")))?)
        .item(&PredefinedMenuItem::paste(app, Some(l(lang, "貼り付け", "Paste")))?)
        .item(
            &MenuItemBuilder::with_id(
                ids::EDIT_PASTE_PLAIN,
                l(lang, "プレーンテキストとして貼り付け", "Paste as Plain Text"),
            )
            .accelerator("CmdOrCtrl+Shift+V")
            .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::select_all(app, Some(l(lang, "すべて選択", "Select All")))?)
        .separator()
        .item(
            &MenuItemBuilder::with_id(ids::EDIT_FIND, l(lang, "検索...", "Find..."))
                .accelerator("CmdOrCtrl+F")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(
                ids::EDIT_FIND_REPLACE,
                l(lang, "検索と置換...", "Find and Replace..."),
            )
            .accelerator("CmdOrCtrl+H")
            .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(
                ids::EDIT_TEXT_STATS,
                l(lang, "文書統計...", "Document Statistics..."),
            )
            .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(ids::EDIT_PREFERENCES, l(lang, "設定...", "Preferences..."))
                .accelerator("CmdOrCtrl+,")
                .build(app)?,
        )
        .build()?;

    // ─── 表示メニュー ───
    let view_submenu = SubmenuBuilder::new(app, l(lang, "表示", "View"))
        .item(
            &SubmenuBuilder::new(app, l(lang, "エディタモード", "Editor Mode"))
                .item(
                    &MenuItemBuilder::with_id(
                        ids::VIEW_MODE_WYSIWYG,
                        l(lang, "WYSIWYG モード", "WYSIWYG Mode"),
                    )
                    .build(app)?,
                )
                .item(
                    &MenuItemBuilder::with_id(
                        ids::VIEW_MODE_SOURCE,
                        l(lang, "ソース表示", "Source Mode"),
                    )
                    .build(app)?,
                )
                .build()?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(
                ids::VIEW_SIDEBAR_TOGGLE,
                l(lang, "サイドバーの表示/非表示", "Toggle Sidebar"),
            )
            .accelerator("CmdOrCtrl+Shift+L")
            .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(
                ids::VIEW_OUTLINE,
                l(lang, "アウトラインパネル", "Outline Panel"),
            )
            .accelerator("CmdOrCtrl+Shift+1")
            .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_FILES, l(lang, "ファイルパネル", "File Panel"))
                .accelerator("CmdOrCtrl+Shift+2")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(
                ids::VIEW_AI_TEMPLATES,
                l(lang, "AI テンプレート", "AI Templates"),
            )
            .accelerator("CmdOrCtrl+Shift+3")
            .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_BACKLINKS, l(lang, "バックリンク", "Backlinks"))
                .accelerator("CmdOrCtrl+Shift+4")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_TAGS, l(lang, "タグビュー", "Tag View"))
                .accelerator("CmdOrCtrl+Shift+5")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_GIT, l(lang, "Git パネル", "Git Panel"))
                .accelerator("CmdOrCtrl+Shift+7")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_LINT, l(lang, "Lint パネル", "Lint Panel"))
                .accelerator("CmdOrCtrl+Shift+8")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(
                ids::VIEW_FLOATING_TOC,
                l(lang, "フローティング目次", "Floating TOC"),
            )
            .accelerator("CmdOrCtrl+Shift+T")
            .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_SPLIT_PANE, l(lang, "ペイン分割", "Split Pane"))
                .accelerator("CmdOrCtrl+\\")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(
                ids::VIEW_FOCUS_MODE,
                l(lang, "フォーカスモード", "Focus Mode"),
            )
            .accelerator("F8")
            .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(
                ids::VIEW_TYPEWRITER_MODE,
                l(lang, "タイプライターモード", "Typewriter Mode"),
            )
            .accelerator("F9")
            .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_ZEN_MODE, l(lang, "Zen モード", "Zen Mode"))
                .accelerator("F11")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(
                ids::VIEW_ZOOM_RESET,
                l(lang, "実際のサイズ", "Actual Size"),
            )
            .accelerator("CmdOrCtrl+0")
            .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_ZOOM_IN, l(lang, "拡大", "Zoom In"))
                .accelerator("CmdOrCtrl+=")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_ZOOM_OUT, l(lang, "縮小", "Zoom Out"))
                .accelerator("CmdOrCtrl+-")
                .build(app)?,
        )
        .build()?;

    // ─── ヘルプメニュー ───
    let help_submenu = SubmenuBuilder::new(app, l(lang, "ヘルプ", "Help"))
        .item(
            &MenuItemBuilder::with_id(
                ids::HELP_SHORTCUTS,
                l(lang, "キーボードショートカット一覧", "Keyboard Shortcuts"),
            )
            .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::about(
            app,
            Some(l(lang, "バージョン情報", "About MarkWeave")),
            Some(
                AboutMetadataBuilder::new()
                    .name(Some("MarkWeave"))
                    .version(Some(env!("CARGO_PKG_VERSION")))
                    .build(),
            ),
        )?)
        .item(
            &MenuItemBuilder::with_id(
                ids::HELP_CHECK_UPDATES,
                l(lang, "アップデートを確認...", "Check for Updates..."),
            )
            .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(
                ids::HELP_FEEDBACK,
                l(lang, "フィードバックを送る...", "Send Feedback..."),
            )
            .build(app)?,
        )
        .build()?;

    // メニューバーを組み立てる
    let menu = MenuBuilder::new(app)
        .item(&file_submenu)
        .item(&edit_submenu)
        .item(&view_submenu)
        .item(&help_submenu)
        .build()?;

    app.set_menu(menu)?;

    Ok(())
}

/// メニューイベントを処理し、フロントエンドにイベントを転送する
pub fn setup_menu_event_handler(app: &AppHandle<Wry>) {
    let app_handle = app.clone();
    app.on_menu_event(move |_app, event| {
        let id = event.id().0.as_str();
        // フロントエンドに menu-action イベントとして転送
        let _ = app_handle.emit("menu-action", id);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn l_returns_japanese() {
        assert_eq!(l(Lang::Ja, "ファイル", "File"), "ファイル");
    }

    #[test]
    fn l_returns_english() {
        assert_eq!(l(Lang::En, "ファイル", "File"), "File");
    }
}
