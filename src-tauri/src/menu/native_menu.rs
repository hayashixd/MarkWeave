// Native menu - OS ネイティブのメニューバー管理
// app-shell-design.md §2 に準拠

use tauri::menu::{
    AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
};
use tauri::{AppHandle, Emitter, Wry};

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
}

/// ネイティブメニューバーを構築してアプリに設定する
pub fn build_menu(app: &AppHandle<Wry>) -> Result<(), Box<dyn std::error::Error>> {
    // ─── ファイルメニュー ───
    let file_submenu = SubmenuBuilder::new(app, "ファイル")
        .item(
            &MenuItemBuilder::with_id(ids::FILE_NEW, "新規ファイル")
                .accelerator("CmdOrCtrl+N")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::FILE_OPEN, "開く...")
                .accelerator("CmdOrCtrl+O")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::FILE_OPEN_FOLDER, "フォルダを開く...")
                .accelerator("CmdOrCtrl+Shift+O")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::FILE_RECENT_FILES, "最近使ったファイル...")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::FILE_RECENT_WORKSPACES, "最近のワークスペース...")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(ids::FILE_SAVE, "保存")
                .accelerator("CmdOrCtrl+S")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::FILE_SAVE_AS, "名前を付けて保存...")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?,
        )
        .separator()
        .item(
            &SubmenuBuilder::new(app, "エクスポート")
                .item(
                    &MenuItemBuilder::with_id(ids::FILE_EXPORT_HTML, "HTML にエクスポート...")
                        .accelerator("CmdOrCtrl+Shift+E")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::with_id(ids::FILE_EXPORT_PDF, "PDF にエクスポート...")
                        .accelerator("CmdOrCtrl+Alt+P")
                        .build(app)?,
                )
                .separator()
                .item(
                    &MenuItemBuilder::with_id(
                        ids::FILE_EXPORT_WORD,
                        "Word (.docx) にエクスポート...",
                    )
                    .accelerator("CmdOrCtrl+Alt+W")
                    .build(app)?,
                )
                .item(
                    &MenuItemBuilder::with_id(ids::FILE_EXPORT_LATEX, "LaTeX にエクスポート...")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::with_id(ids::FILE_EXPORT_EPUB, "ePub にエクスポート...")
                        .build(app)?,
                )
                .build()?,
        )
        .item(
            &SubmenuBuilder::new(app, "別名で保存")
                .item(
                    &MenuItemBuilder::with_id(ids::FILE_SAVE_AS_MD, "Markdown として保存...")
                        .accelerator("CmdOrCtrl+Shift+M")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::with_id(ids::FILE_SAVE_AS_HTML, "HTML として保存...")
                        .accelerator("CmdOrCtrl+Shift+H")
                        .build(app)?,
                )
                .build()?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(ids::FILE_TEMPLATE_NEW, "テンプレートから新規作成...")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::FILE_DAILY_NOTE, "デイリーノート作成")
                .accelerator("CmdOrCtrl+Alt+D")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(ids::FILE_PRINT, "印刷...")
                .accelerator("CmdOrCtrl+P")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("アプリを終了"))?)
        .build()?;

    // ─── 編集メニュー ───
    let edit_submenu = SubmenuBuilder::new(app, "編集")
        .item(&PredefinedMenuItem::undo(app, Some("元に戻す"))?)
        .item(&PredefinedMenuItem::redo(app, Some("やり直す"))?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, Some("切り取り"))?)
        .item(&PredefinedMenuItem::copy(app, Some("コピー"))?)
        .item(&PredefinedMenuItem::paste(app, Some("貼り付け"))?)
        .item(
            &MenuItemBuilder::with_id(ids::EDIT_PASTE_PLAIN, "プレーンテキストとして貼り付け")
                .accelerator("CmdOrCtrl+Shift+V")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::select_all(app, Some("すべて選択"))?)
        .separator()
        .item(
            &MenuItemBuilder::with_id(ids::EDIT_FIND, "検索...")
                .accelerator("CmdOrCtrl+F")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::EDIT_FIND_REPLACE, "検索と置換...")
                .accelerator("CmdOrCtrl+H")
                .build(app)?,
        )
        .separator()
        .item(&MenuItemBuilder::with_id(ids::EDIT_TEXT_STATS, "文書統計...").build(app)?)
        .separator()
        .item(
            &MenuItemBuilder::with_id(ids::EDIT_PREFERENCES, "設定...")
                .accelerator("CmdOrCtrl+,")
                .build(app)?,
        )
        .build()?;

    // ─── 表示メニュー ───
    let view_submenu = SubmenuBuilder::new(app, "表示")
        .item(
            &SubmenuBuilder::new(app, "エディタモード")
                .item(
                    &MenuItemBuilder::with_id(ids::VIEW_MODE_WYSIWYG, "WYSIWYG モード")
                        .build(app)?,
                )
                .item(&MenuItemBuilder::with_id(ids::VIEW_MODE_SOURCE, "ソース表示").build(app)?)
                .build()?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_SIDEBAR_TOGGLE, "サイドバーの表示/非表示")
                .accelerator("CmdOrCtrl+Shift+L")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_OUTLINE, "アウトラインパネル")
                .accelerator("CmdOrCtrl+Shift+1")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_FILES, "ファイルパネル")
                .accelerator("CmdOrCtrl+Shift+2")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_AI_TEMPLATES, "AI テンプレート")
                .accelerator("CmdOrCtrl+Shift+3")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_BACKLINKS, "バックリンク")
                .accelerator("CmdOrCtrl+Shift+4")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_TAGS, "タグビュー")
                .accelerator("CmdOrCtrl+Shift+5")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_FLOATING_TOC, "フローティング目次")
                .accelerator("CmdOrCtrl+Shift+T")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_SPLIT_PANE, "ペイン分割")
                .accelerator("CmdOrCtrl+\\")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_FOCUS_MODE, "フォーカスモード")
                .accelerator("F8")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_TYPEWRITER_MODE, "タイプライターモード")
                .accelerator("F9")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_ZEN_MODE, "Zen モード")
                .accelerator("F11")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_ZOOM_RESET, "実際のサイズ")
                .accelerator("CmdOrCtrl+0")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_ZOOM_IN, "拡大")
                .accelerator("CmdOrCtrl+=")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::VIEW_ZOOM_OUT, "縮小")
                .accelerator("CmdOrCtrl+-")
                .build(app)?,
        )
        .build()?;

    // ─── ヘルプメニュー ───
    let help_submenu = SubmenuBuilder::new(app, "ヘルプ")
        .item(
            &MenuItemBuilder::with_id(ids::HELP_SHORTCUTS, "キーボードショートカット一覧")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::about(
            app,
            Some("バージョン情報"),
            Some(
                AboutMetadataBuilder::new()
                    .name(Some("Markdown Editor"))
                    .version(Some(env!("CARGO_PKG_VERSION")))
                    .build(),
            ),
        )?)
        .item(&MenuItemBuilder::with_id(ids::HELP_FEEDBACK, "フィードバックを送る...").build(app)?)
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
