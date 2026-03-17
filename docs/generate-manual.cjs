#!/usr/bin/env node
// マークダウンファイルの編集マニュアル HTML生成スクリプト
// 出力先: doc-public/manuals/user-manual.html
const fs = require('fs');
const path = require('path');

const screenshotBase = path.join(__dirname, 'manual-screenshots');
const outputPath = path.join(__dirname, '..', 'doc-public', 'manuals', 'user-manual-full.html');

function loadImage(relPath) {
  const fullPath = path.join(screenshotBase, relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn('Image not found:', fullPath);
    return null;
  }
  const data = fs.readFileSync(fullPath);
  return 'data:image/png;base64,' + data.toString('base64');
}

// Load all images
const imgs = {
  // headings
  h1: loadImage('headings/01_h1-result.png'),
  h2: loadImage('headings/02_h2-result.png'),
  h3: loadImage('headings/03_h3-result.png'),
  blockDropdown: loadImage('headings/04_block-type-dropdown.png'),
  headingsOverview: loadImage('headings/05_headings-overview.png'),
  // text-formatting
  toolbarOverview: loadImage('text-formatting/01_toolbar-overview.png'),
  italic: loadImage('text-formatting/02_italic-result.png'),
  strikethrough: loadImage('text-formatting/03_strikethrough-result.png'),
  inlineCode: loadImage('text-formatting/04_inline-code-result.png'),
  formattingOverview: loadImage('text-formatting/05_formatting-overview.png'),
  // lists
  bulletList: loadImage('lists/01_bullet-list.png'),
  orderedList: loadImage('lists/02_ordered-list.png'),
  taskList: loadImage('lists/03_task-list.png'),
  listToolbar: loadImage('lists/04_list-toolbar-buttons.png'),
  // source-mode
  wysiwygMode: loadImage('source-mode/01_wysiwyg-mode.png'),
  sourceButton: loadImage('source-mode/02_source-button.png'),
  sourceModeActive: loadImage('source-mode/03_source-mode-active.png'),
  sourceMarkdown: loadImage('source-mode/04_source-markdown-visible.png'),
  backToWysiwyg: loadImage('source-mode/05_back-to-wysiwyg.png'),
  // bold-text
  boldResult: loadImage('bold-text/05_result-bold.png'),
  // tables
  tableSlashMenu: loadImage('tables/01_slash-command-menu.png'),
  tableCreated: loadImage('tables/02_table-created.png'),
  tableOverview: loadImage('tables/03_table-overview.png'),
  // search-replace
  searchBarOpen: loadImage('search-replace/01_search-bar-open.png'),
  searchResultHighlight: loadImage('search-replace/02_search-result-highlight.png'),
  replaceBarOpen: loadImage('search-replace/03_replace-bar-open.png'),
  replaceFieldsFilled: loadImage('search-replace/04_replace-fields-filled.png'),
  searchReplaceOverview: loadImage('search-replace/05_search-replace-overview.png'),
  // tabs
  tabbarOverview: loadImage('tabs/01_tabbar-overview.png'),
  tabUnsavedMarker: loadImage('tabs/02_tab-unsaved-marker.png'),
  newTabButton: loadImage('tabs/03_new-tab-button.png'),
  multipleTabs: loadImage('tabs/04_multiple-tabs.png'),
  tabContextMenu: loadImage('tabs/05_tab-context-menu.png'),
  // outline
  outlinePanel: loadImage('outline/01_outline-panel.png'),
  outlineOverview: loadImage('outline/02_outline-overview.png'),
  // slash-commands
  slashMenuOpen: loadImage('slash-commands/01_slash-menu-open.png'),
  slashFilterHeading: loadImage('slash-commands/02_slash-filter-heading.png'),
  slashMenuGroups: loadImage('slash-commands/03_slash-menu-groups.png'),
  slashMenuSelected: loadImage('slash-commands/04_slash-menu-selected.png'),
  slashCommandExecuted: loadImage('slash-commands/05_slash-command-executed.png'),
  // settings
  settingsDialogOpen: loadImage('settings/01_settings-dialog-open.png'),
  settingsAppearanceTab: loadImage('settings/02_settings-appearance-tab.png'),
  settingsEditorTab: loadImage('settings/03_settings-editor-tab.png'),
  settingsWritingTab: loadImage('settings/04_settings-writing-tab.png'),
  settingsPluginsTab: loadImage('settings/05_settings-plugins-tab.png'),
  // export
  beforeExport: loadImage('export/01_before-export.png'),
  exportDialogHtml: loadImage('export/02_export-dialog-html.png'),
  exportOverview: loadImage('export/03_export-overview.png'),
  exportDialogPdf: loadImage('export/05_export-dialog-pdf.png'),
  exportDialogPandoc: loadImage('export/06_export-dialog-pandoc.png'),
  // ai-copy
  aiCopyButtonToolbar: loadImage('ai-copy/01_ai-copy-button-toolbar.png'),
  aiCopyOptionsDropdown: loadImage('ai-copy/02_ai-copy-options-dropdown.png'),
  aiCopyReportPopover: loadImage('ai-copy/03_ai-copy-report-popover.png'),
  aiCopyCopiedState: loadImage('ai-copy/04_ai-copy-copied-state.png'),
  aiCopyOverview: loadImage('ai-copy/05_ai-copy-overview.png'),
  // ai-template
  aiTemplatePanelOpen: loadImage('ai-template/01_ai-template-panel-open.png'),
  aiTemplateCategoryFilter: loadImage('ai-template/02_ai-template-category-filter.png'),
  aiTemplatePreview: loadImage('ai-template/03_ai-template-preview.png'),
  aiTemplatePlaceholderDialog: loadImage('ai-template/04_ai-template-placeholder-dialog.png'),
  aiTemplateSearch: loadImage('ai-template/05_ai-template-search.png'),
  aiTemplateNewButton: loadImage('ai-template/06_ai-template-new-button.png'),
  aiTemplateCustomEditor: loadImage('ai-template/07_ai-template-custom-editor.png'),
  aiTemplateOverview: loadImage('ai-template/08_ai-template-overview.png'),
  // math-mermaid
  inlineMath: loadImage('math-mermaid/01_inline-math.png'),
  blockMath: loadImage('math-mermaid/02_block-math.png'),
  mermaidFlowchart: loadImage('math-mermaid/03_mermaid-flowchart.png'),
  mathMermaidOverview: loadImage('math-mermaid/04_math-mermaid-overview.png'),
  // code-block
  codeBlockResult: loadImage('code-block/01_code-block-result.png'),
  blockquoteResult: loadImage('code-block/02_blockquote-result.png'),
  horizontalRule: loadImage('code-block/03_horizontal-rule.png'),
  blocksOverview: loadImage('code-block/04_blocks-overview.png'),
  // split-editor
  splitEditorActive: loadImage('split-editor/01_split-editor-active.png'),
  focusMode: loadImage('split-editor/02_focus-mode.png'),
  typewriterMode: loadImage('split-editor/03_typewriter-mode.png'),
  splitOverview: loadImage('split-editor/04_split-overview.png'),
  // workspace
  sidebarOverview: loadImage('workspace/01_sidebar-overview.png'),
  fileTreePanel: loadImage('workspace/02_file-tree-panel.png'),
  statusBar: loadImage('workspace/03_status-bar.png'),
  workspaceOverview: loadImage('workspace/04_workspace-overview.png'),
  // front-matter
  frontMatterPanel: loadImage('front-matter/01_front-matter-panel.png'),
  frontMatterExpanded: loadImage('front-matter/02_front-matter-expanded.png'),
  linkInsertDialog: loadImage('front-matter/03_link-insert-dialog.png'),
  wordCountDialog: loadImage('front-matter/04_word-count-dialog.png'),
  extrasOverview: loadImage('front-matter/05_extras-overview.png'),
  // file-management (新規)
  recentFilesMenu: loadImage('file-management/01_recent-files-menu.png'),
  dailyNote: loadImage('file-management/02_daily-note-created.png'),
  templateDialog: loadImage('file-management/03_template-dialog.png'),
  saveAsMarkdown: loadImage('file-management/04_save-as-markdown.png'),
  printDialog: loadImage('file-management/05_print-dialog.png'),
  // sidebar-panels (新規)
  backlinksPanel: loadImage('sidebar-panels/01_backlinks-panel.png'),
  tagsPanel: loadImage('sidebar-panels/02_tags-panel.png'),
  gitPanel: loadImage('sidebar-panels/03_git-panel.png'),
  sidebarToggle: loadImage('sidebar-panels/04_sidebar-toggle.png'),
  lintPanel: loadImage('sidebar-panels/05_lint-panel.png'),
  // floating-toc (新規)
  floatingToc: loadImage('floating-toc/01_floating-toc.png'),
  zoomControls: loadImage('floating-toc/02_zoom-controls.png'),
  // writing-tools (新規)
  pomodoroTimer: loadImage('writing-tools/01_pomodoro-timer.png'),
  wordSprintWidget: loadImage('writing-tools/02_word-sprint-widget.png'),
  docStatsDialog: loadImage('writing-tools/03_doc-stats-dialog.png'),
  // platform-profile (新規)
  platformProfileSelector: loadImage('platform-profile/01_profile-selector.png'),
  platformProfileZenn: loadImage('platform-profile/02_zenn-form.png'),
  platformProfileQiita: loadImage('platform-profile/03_qiita-form.png'),
  platformWarnings: loadImage('platform-profile/04_warnings.png'),
  zennPalette: loadImage('platform-profile/05_zenn-palette.png'),
  copyButtons: loadImage('platform-profile/06_copy-buttons.png'),
};

function imgTag(src, alt, caption) {
  if (!src) return `<p class="img-missing">[画像: ${alt}]</p>`;
  let html = `<figure><img src="${src}" alt="${alt}">`;
  if (caption) html += `<figcaption>${caption}</figcaption>`;
  html += `</figure>`;
  return html;
}

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>全機能リファレンス — MarkWeave</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f172a;
    --bg-card: #1e293b;
    --border: #334155;
    --text: #f1f5f9;
    --text-muted: #94a3b8;
    --text-dim: #64748b;
    --accent: #818cf8;
    --success: #34d399;
  }
  html { scroll-behavior: smooth; scroll-padding-top: 72px; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.7;
    font-size: 16px;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  nav {
    position: sticky; top: 0; z-index: 100;
    background: rgba(15,23,42,0.92);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
    padding: 0 1.5rem; height: 56px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .nav-logo { font-size: 1.05rem; font-weight: 700; letter-spacing: -0.02em; color: var(--text); text-decoration: none; }
  .nav-links { display: flex; gap: 1.25rem; align-items: center; list-style: none; }
  .nav-links a { color: var(--text-muted); text-decoration: none; font-size: 0.875rem; }
  .nav-links a:hover { color: var(--text); }
  .btn-nav {
    background: var(--accent); color: #0f172a !important; font-weight: 700;
    padding: 0.4rem 1.1rem; border-radius: 6px; font-size: 0.85rem !important;
  }
  .btn-nav:hover { background: #a5b4fc !important; }
  .manual-hero {
    padding: 4rem 1.5rem 3rem;
    border-bottom: 1px solid var(--border);
    background: radial-gradient(ellipse at 20% -20%, rgba(79,70,229,0.18) 0%, transparent 55%);
  }
  .manual-hero .inner { max-width: 960px; margin: 0 auto; }
  .manual-hero .label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--accent); margin-bottom: 0.5rem; }
  .manual-hero h1 { font-size: clamp(1.75rem,4vw,2.5rem); font-weight: 800; letter-spacing: -0.04em; margin-bottom: 0.5rem; }
  .manual-hero p { color: var(--text-muted); font-size: 1rem; }
  .toc {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.5rem 2rem;
    max-width: 960px;
    margin: 2rem auto 0;
  }
  .toc h2 { font-size: 0.72rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.1em; }
  .toc ol { padding-left: 1.25rem; columns: 2; column-gap: 2rem; }
  .toc li { margin-bottom: 0.35rem; break-inside: avoid; font-size: 0.875rem; }
  .toc a { color: var(--text-muted); text-decoration: none; }
  .toc a:hover { color: var(--accent); }
  main { max-width: 960px; margin: 0 auto; padding: 2.5rem 1.5rem 5rem; }
  section {
    background: var(--bg-card);
    border-radius: 12px;
    border: 1px solid var(--border);
    padding: 2.25rem 2.5rem;
    margin-bottom: 2rem;
  }
  section h2 {
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--text);
    border-bottom: 2px solid var(--accent);
    padding-bottom: 0.5rem;
    margin-bottom: 1.25rem;
    letter-spacing: -0.025em;
  }
  section h3 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
    margin: 1.5rem 0 0.6rem;
  }
  p { margin-bottom: 0.75rem; color: var(--text-muted); font-size: 0.9rem; }
  ul, ol { padding-left: 1.5rem; margin-bottom: 0.75rem; }
  li { margin-bottom: 0.3rem; color: var(--text-muted); font-size: 0.9rem; }
  figure { margin: 1.25rem 0; text-align: center; }
  figure img {
    max-width: 100%;
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.3);
  }
  figcaption { margin-top: 0.5rem; font-size: 0.82rem; color: var(--text-dim); font-style: italic; }
  .img-missing {
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 6px;
    padding: 0.75rem 1rem;
    color: #fca5a5;
    font-size: 0.875rem;
  }
  .steps { counter-reset: step; list-style: none; padding: 0; }
  .steps li {
    counter-increment: step;
    display: flex; gap: 1rem; margin-bottom: 1rem; align-items: flex-start;
  }
  .steps li::before {
    content: counter(step);
    background: var(--accent); color: #0f172a;
    border-radius: 50%; width: 26px; height: 26px; min-width: 26px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 0.8rem; margin-top: 2px;
  }
  kbd {
    display: inline-block;
    background: var(--bg);
    border: 1px solid var(--border);
    border-bottom: 3px solid var(--text-dim);
    border-radius: 5px;
    padding: 0.1em 0.5em;
    font-family: "Consolas", monospace;
    font-size: 0.82em;
    color: var(--text-muted);
  }
  code {
    font-family: "Consolas", "Courier New", monospace;
    background: rgba(129,140,248,0.12);
    color: var(--accent);
    padding: 0.1em 0.4em;
    border-radius: 4px;
    font-size: 0.875em;
  }
  .tip {
    background: rgba(52,211,153,0.06);
    border-left: 3px solid var(--success);
    border-radius: 0 6px 6px 0;
    padding: 0.75rem 1rem;
    margin: 1rem 0;
    font-size: 0.875rem;
    color: var(--text-muted);
  }
  .tip strong { color: var(--success); }
  .shortcut-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
  }
  .shortcut-table th {
    background: var(--bg);
    padding: 0.6rem 1rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
  }
  .shortcut-table td {
    padding: 0.6rem 1rem;
    border-bottom: 1px solid rgba(51,65,85,0.5);
    font-size: 0.875rem;
    color: var(--text-muted);
  }
  .shortcut-table tr:last-child td { border-bottom: none; }
  .shortcut-table tr:hover td { background: rgba(129,140,248,0.03); }
  .faq-item { border-bottom: 1px solid var(--border); padding: 1rem 0; }
  .faq-item:first-child { border-top: 1px solid var(--border); }
  .faq-item dt { font-weight: 600; color: var(--text); margin-bottom: 0.35rem; font-size: 0.9rem; }
  .faq-item dd { padding-left: 1rem; color: var(--text-muted); font-size: 0.875rem; }
  footer {
    border-top: 1px solid var(--border);
    text-align: center;
    padding: 1.75rem 1.5rem;
    color: var(--text-dim);
    font-size: 0.82rem;
  }
  footer a { color: var(--text-muted); text-decoration: none; padding: 0.25rem 0.75rem; }
  footer a:hover { color: var(--text); }
  .feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 0.75rem;
    margin: 1rem 0;
  }
  .feature-card {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.9rem 1rem;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .feature-card strong { color: var(--accent); display: block; margin-bottom: 0.2rem; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.875rem; }
  th {
    background: var(--bg); color: var(--text-muted); font-weight: 600; font-size: 0.78rem;
    text-transform: uppercase; letter-spacing: 0.06em; padding: 0.6rem 1rem;
    text-align: left; border-bottom: 1px solid var(--border);
  }
  td { padding: 0.6rem 1rem; border-bottom: 1px solid rgba(51,65,85,0.5); color: var(--text-muted); }
  td:first-child { color: var(--text); font-weight: 500; }
  tr:last-child td { border-bottom: none; }
</style>
</head>
<body>

<nav>
  <a href="../index.html" class="nav-logo">MarkWeave</a>
  <ul class="nav-links">
    <li><a href="../index.html#solutions">機能</a></li>
    <li><a href="../index.html#pricing">価格</a></li>
    <li><a href="user-manual.html">クイックガイド</a></li>
    <li><a href="https://github.com/hayashixd/MarkWeave/releases/latest" class="btn-nav">無料で試す</a></li>
  </ul>
</nav>

<div class="manual-hero">
  <div class="inner">
    <p class="label">Full Reference</p>
    <h1>全機能リファレンス</h1>
    <p>MarkWeave のすべての機能を網羅した詳細マニュアルです。</p>
  </div>
</div>

<div class="toc">
  <h2>目次</h2>
  <ol>
    <li><a href="#intro">はじめに</a></li>
    <li><a href="#quickstart">クイックスタート</a></li>
    <li><a href="#editor-overview">エディタ概要</a></li>
    <li><a href="#headings">見出しの入力</a></li>
    <li><a href="#bold">太字</a></li>
    <li><a href="#text-formatting">テキスト書式設定</a></li>
    <li><a href="#lists">リストの作成</a></li>
    <li><a href="#code-blocks">コードブロック・引用・水平線</a></li>
    <li><a href="#source-mode">ソースモード切替</a></li>
    <li><a href="#slash-commands">スラッシュコマンド</a></li>
    <li><a href="#tables">テーブル編集</a></li>
    <li><a href="#math-mermaid">数式・Mermaid図表</a></li>
    <li><a href="#search-replace">検索・置換</a></li>
    <li><a href="#tabs">タブ管理</a></li>
    <li><a href="#workspace">ワークスペース・ファイル管理</a></li>
    <li><a href="#outline">アウトラインパネル</a></li>
    <li><a href="#split-editor">分割エディタ</a></li>
    <li><a href="#focus-zen">フォーカス・タイプライター・Zenモード</a></li>
    <li><a href="#export">エクスポート</a></li>
    <li><a href="#settings">設定</a></li>
    <li><a href="#front-matter">YAML Front Matter・プラットフォームプロファイル・コピー</a></li>
    <li><a href="#ai-copy">AI コピー機能</a></li>
    <li><a href="#ai-template">AI テンプレートパネル</a></li>
    <li><a href="#file-management">ファイル管理の応用</a></li>
    <li><a href="#sidebar-panels">サイドバーパネル詳細（バックリンク・タグ・Git・Lint）</a></li>
    <li><a href="#view-tools">フローティング目次・ズーム</a></li>
    <li><a href="#writing-tools">執筆ツール</a></li>
    <li><a href="#shortcuts">キーボードショートカット一覧</a></li>
    <li><a href="#faq">FAQ</a></li>
  </ol>
</div>

<main>

  <!-- 1. はじめに -->
  <section id="intro">
    <h2>1. はじめに</h2>
    <h3>1.1 MarkWeave とは</h3>
    <p>
      MarkWeave は Typora にインスパイアされた WYSIWYG Markdown エディタです。
      Markdown の記法を入力すると、リアルタイムで書式が適用されます。
      Markdown と HTML の両方に対応し、豊富な編集機能を備えています。
    </p>
    <div class="feature-grid">
      <div class="feature-card"><strong>WYSIWYG 編集</strong><br>記法を意識せず直感的に編集</div>
      <div class="feature-card"><strong>ソースモード</strong><br>Markdown ソースを直接編集</div>
      <div class="feature-card"><strong>テーブル編集</strong><br>Excel ライクな操作</div>
      <div class="feature-card"><strong>数式・図表</strong><br>KaTeX / Mermaid 対応</div>
      <div class="feature-card"><strong>エクスポート</strong><br>HTML / PDF / Pandoc 対応</div>
      <div class="feature-card"><strong>ワークスペース</strong><br>フォルダ単位でファイル管理</div>
    </div>
    <h3>1.2 対応環境</h3>
    <ul>
      <li>Windows / macOS / Linux（Tauri デスクトップアプリ）</li>
      <li>対応ファイル形式: <code>.md</code>（Markdown）/ <code>.html</code>（HTML）</li>
    </ul>
  </section>

  <!-- 2. クイックスタート -->
  <section id="quickstart">
    <h2>2. クイックスタート</h2>

    <h3>2.1 ファイルを開く</h3>
    <ol class="steps">
      <li>メニューバーの「ファイル」→「開く」を選択、または <kbd>Ctrl</kbd>+<kbd>O</kbd> を押す</li>
      <li>編集対象の <code>.md</code> または <code>.html</code> ファイルを選択</li>
      <li>エディタに内容が表示されたら編集開始</li>
    </ol>

    <h3>2.2 新規ファイルを作成</h3>
    <ul>
      <li>タブバーの <strong>+</strong> ボタンをクリック、または <kbd>Ctrl</kbd>+<kbd>N</kbd></li>
      <li>ファイル名を付けて保存: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd></li>
    </ul>

    <h3>2.3 保存する</h3>
    <ul>
      <li>上書き保存: <kbd>Ctrl</kbd>+<kbd>S</kbd></li>
      <li>名前を付けて保存: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd></li>
    </ul>

    <h3>2.4 表示モードを切り替える</h3>
    <ul>
      <li><strong>WYSIWYG モード</strong>: 直感的な書式編集（デフォルト）</li>
      <li><strong>ソースモード</strong>: Markdown ソースを直接編集（<kbd>Ctrl</kbd>+<kbd>/</kbd>）</li>
      <li><strong>スプリットモード</strong>: 編集しながらプレビューを確認</li>
    </ul>
  </section>

  <!-- 3. エディタ概要 -->
  <section id="editor-overview">
    <h2>3. エディタ概要</h2>
    <p>
      MarkWeave は WYSIWYG 型の Markdown エディタです。
      Markdown の記法を入力すると、リアルタイムで書式が適用されます。
    </p>
    ${imgTag(imgs.toolbarOverview, 'ツールバー概要', '書式ツールバー — よく使う書式ボタンが並んでいます')}
    <h3>画面構成</h3>
    <ul>
      <li><strong>タブバー</strong>: 複数ファイルをタブで管理（上部）</li>
      <li><strong>ツールバー</strong>: 書式設定ボタン（タブバー下）</li>
      <li><strong>エディタ領域</strong>: テキスト編集エリア（中央）</li>
      <li><strong>サイドバー</strong>: ファイルツリー・アウトライン（左側）</li>
      <li><strong>ステータスバー</strong>: ファイル情報・エンコーディング（下部）</li>
    </ul>
    ${imgTag(imgs.workspaceOverview, 'アプリ全体', 'アプリケーション全体の画面構成')}
  </section>

  <!-- 4. 見出しの入力 -->
  <section id="headings">
    <h2>4. 見出しの入力</h2>
    <p>Markdown の見出し記法（<code>#</code>）を入力すると、自動的に見出しに変換されます。</p>

    <h3>H1 見出し（大見出し）</h3>
    <p>行頭に <code># </code>（半角シャープとスペース）を入力します。</p>
    <ol class="steps">
      <li>エディタをクリックしてカーソルを置きます</li>
      <li><code># </code> と入力します（シャープ記号の後にスペース）</li>
      <li>見出しのテキストを入力します</li>
    </ol>
    ${imgTag(imgs.h1, 'H1見出しの結果', 'H1 見出し — 最大の文字サイズで表示されます')}

    <h3>H2 見出し（中見出し）</h3>
    <p>行頭に <code>## </code> を入力します。</p>
    ${imgTag(imgs.h2, 'H2見出しの結果', 'H2 見出し')}

    <h3>H3 見出し（小見出し）</h3>
    <p>行頭に <code>### </code> を入力します。</p>
    ${imgTag(imgs.h3, 'H3見出しの結果', 'H3 見出し')}

    <h3>ブロックタイプドロップダウンから選択</h3>
    <p>ツールバーのドロップダウンメニューから見出しレベルを選択することもできます。</p>
    ${imgTag(imgs.blockDropdown, 'ブロックタイプドロップダウン', 'ドロップダウンから見出しレベルを選択')}
    ${imgTag(imgs.headingsOverview, '見出し一覧', 'H1〜H3の見出しが一覧で表示された状態')}

    <div class="tip">
      <strong>ヒント:</strong> H1〜H6 まで対応しています。<code>######</code>（シャープ6個）で H6 になります。
      キーボードショートカット <kbd>Ctrl</kbd>+<kbd>1</kbd>〜<kbd>6</kbd> でも設定できます。
    </div>
  </section>

  <!-- 5. 太字 -->
  <section id="bold">
    <h2>5. 太字</h2>
    <p>テキストを太字にするには2つの方法があります。</p>

    <h3>方法1: キーボードショートカット</h3>
    <ol class="steps">
      <li>太字にしたいテキストを選択します</li>
      <li><kbd>Ctrl</kbd> + <kbd>B</kbd> を押します</li>
    </ol>

    <h3>方法2: Markdown 記法</h3>
    <p><code>**テキスト**</code>（アスタリスク2個で囲む）と入力すると自動変換されます。</p>

    ${imgTag(imgs.boldResult, '太字の結果', '太字テキスト — **text** の記法で自動変換されます')}

    <div class="tip">
      <strong>ヒント:</strong> ツールバーの <strong>B</strong> ボタンをクリックしても太字を適用できます。
    </div>
  </section>

  <!-- 6. テキスト書式設定 -->
  <section id="text-formatting">
    <h2>6. テキスト書式設定</h2>

    <h3>斜体（イタリック）</h3>
    <p>テキストを斜体にするには:</p>
    <ol class="steps">
      <li>斜体にしたいテキストを選択します</li>
      <li><kbd>Ctrl</kbd> + <kbd>I</kbd> を押すか、<code>*テキスト*</code> と入力します</li>
    </ol>
    ${imgTag(imgs.italic, '斜体の結果', '斜体テキスト — Ctrl+I または *text*')}

    <h3>取り消し線</h3>
    <p>テキストに取り消し線を引くには <code>~~テキスト~~</code> と入力します。</p>
    ${imgTag(imgs.strikethrough, '取り消し線の結果', '取り消し線 — ~~text~~')}

    <h3>インラインコード</h3>
    <p>コードをインラインで表示するにはバッククォート（<code>&#96;</code>）で囲みます。</p>
    <p>例: <code>&#96;const x = 42&#96;</code></p>
    ${imgTag(imgs.inlineCode, 'インラインコードの結果', 'インラインコード — `code`')}

    <h3>書式設定の全体確認</h3>
    ${imgTag(imgs.formattingOverview, '書式設定概要', '各種書式が適用されたエディタの表示')}

    <div class="tip">
      <strong>ヒント:</strong> 複数の書式を組み合わせることもできます。例: <code>**_太字斜体_**</code>
    </div>
  </section>

  <!-- 7. リストの作成 -->
  <section id="lists">
    <h2>7. リストの作成</h2>

    <h3>箇条書きリスト</h3>
    <p>行頭に <code>- </code>（ハイフンとスペース）を入力すると箇条書きリストになります。</p>
    <ol class="steps">
      <li><code>- </code> と入力します</li>
      <li>項目のテキストを入力します</li>
      <li><kbd>Enter</kbd> で次の項目に進みます</li>
      <li>リストを終了するには <kbd>Enter</kbd> を2回押します</li>
    </ol>
    ${imgTag(imgs.bulletList, '箇条書きリスト', '箇条書きリスト — 「-」で始まる行')}

    <h3>番号付きリスト</h3>
    <p>行頭に <code>1. </code>（数字、ピリオド、スペース）を入力します。以降の番号は自動で付きます。</p>
    ${imgTag(imgs.orderedList, '番号付きリスト', '番号付きリスト — 「1.」で始まる行')}

    <h3>タスクリスト</h3>
    <p>チェックボックス付きのタスクリストを作成できます。</p>
    <ul>
      <li><code>- [ ] </code>: 未完了のタスク</li>
      <li><code>- [x] </code>: 完了済みのタスク</li>
      <li>チェックボックスをクリックして完了/未完了を切り替えられます</li>
    </ul>
    ${imgTag(imgs.taskList, 'タスクリスト', 'タスクリスト — チェックボックスをクリックで切り替え')}

    <h3>ツールバーのリストボタン</h3>
    ${imgTag(imgs.listToolbar, 'リストボタン', 'ツールバーのリストボタン')}
  </section>

  <!-- 8. コードブロック・引用・水平線 -->
  <section id="code-blocks">
    <h2>8. コードブロック・引用・水平線</h2>

    <h3>コードブロック（シンタックスハイライト）</h3>
    <p>バッククォート3つで囲み、言語を指定するとシンタックスハイライトが適用されます。</p>
    <p>例: <code>&#96;&#96;&#96;javascript</code>（Enterで開始、<code>&#96;&#96;&#96;</code> で終了）</p>
    ${imgTag(imgs.codeBlockResult, 'コードブロックの結果', 'JavaScript コードのシンタックスハイライト表示')}

    <h3>引用ブロック</h3>
    <p>行頭に <code>&gt; </code>（大なり記号とスペース）を入力すると引用ブロックになります。</p>
    ${imgTag(imgs.blockquoteResult, '引用ブロックの結果', '引用ブロック — 「> text」で作成')}

    <h3>水平線</h3>
    <p>行に <code>---</code>（ハイフン3つ）を入力すると水平線に変換されます。</p>
    ${imgTag(imgs.horizontalRule, '水平線の結果', '水平線 — 「---」で作成')}

    ${imgTag(imgs.blocksOverview, 'ブロック要素一覧', 'コードブロック・引用・水平線が含まれたドキュメント')}

    <div class="tip">
      <strong>対応言語（シンタックスハイライト）:</strong> javascript, typescript, python, rust, go, java, html, css, json など多数対応
    </div>
  </section>

  <!-- 9. ソースモード切替 -->
  <section id="source-mode">
    <h2>9. ソースモード切替</h2>
    <p>
      WYSIWYG モードとソースモード（Markdown 生テキスト編集モード）を切り替えることができます。
      ソースモードでは Markdown の生テキストを直接編集できます。
    </p>

    <h3>WYSIWYG モードで編集</h3>
    ${imgTag(imgs.wysiwygMode, 'WYSIWYGモード', 'WYSIWYGモード — 書式が適用された状態で表示')}

    <h3>ソースモードへの切替</h3>
    <p>ツールバーの「ソースモード」ボタンをクリックするか、<kbd>Ctrl</kbd> + <kbd>/</kbd> を押します。</p>
    ${imgTag(imgs.sourceButton, 'ソースモードボタン', 'ツールバーのソースモードボタン（Ctrl+/）')}

    <h3>ソースモードで編集</h3>
    <p>ソースモードでは Markdown の生テキストが表示され、直接編集できます。</p>
    ${imgTag(imgs.sourceModeActive, 'ソースモード', 'ソースモード — Markdown の生テキストが表示されます')}
    ${imgTag(imgs.sourceMarkdown, 'Markdownソース', 'Markdown ソースコードの表示')}

    <h3>WYSIWYG モードに戻る</h3>
    <p>再度 <kbd>Ctrl</kbd> + <kbd>/</kbd> を押すか、ソースモードボタンをクリックします。</p>
    ${imgTag(imgs.backToWysiwyg, 'WYSIWYGモードに戻る', 'WYSIWYGモードに戻った状態')}

    <div class="tip">
      <strong>ヒント:</strong> 大きなファイルや複雑な Markdown 構造を直接編集したい場合にソースモードが便利です。
    </div>
  </section>

  <!-- 10. スラッシュコマンド -->
  <section id="slash-commands">
    <h2>10. スラッシュコマンド</h2>
    <p>
      行頭で <code>/</code> を入力するとコマンドメニューが表示されます。
      コマンドを選択することで見出し・テーブル・コードブロックなどを素早く挿入できます。
    </p>

    <h3>コマンドメニューを開く</h3>
    <ol class="steps">
      <li>エディタの行頭（または新しい行）に移動します</li>
      <li><code>/</code>（スラッシュ）を入力します</li>
      <li>コマンドメニューが表示されます</li>
    </ol>
    ${imgTag(imgs.slashMenuOpen, 'スラッシュコマンドメニュー', '「/」を入力するとコマンドメニューが表示されます')}

    <h3>コマンドのフィルタリング</h3>
    <p><code>/</code> に続けてキーワードを入力するとコマンド候補が絞り込まれます。</p>
    ${imgTag(imgs.slashFilterHeading, 'コマンドフィルタ', '「/heading」と入力してフィルタリング')}

    <h3>カテゴリ別グループ表示</h3>
    ${imgTag(imgs.slashMenuGroups, 'コマンドグループ', 'カテゴリ別にグループ表示されたコマンド一覧')}

    <h3>キーボード操作</h3>
    <ul>
      <li><kbd>↑</kbd> / <kbd>↓</kbd>: コマンドを選択</li>
      <li><kbd>Enter</kbd> または <kbd>Tab</kbd>: コマンドを実行</li>
      <li><kbd>Esc</kbd>: メニューを閉じる</li>
    </ul>
    ${imgTag(imgs.slashMenuSelected, 'コマンド選択状態', 'キーボードでコマンドを選択した状態')}
    ${imgTag(imgs.slashCommandExecuted, 'コマンド実行後', 'コマンド実行後の状態')}

    <div class="tip">
      <strong>主なコマンド:</strong> /heading（見出し）, /table（テーブル）, /code（コードブロック）, /quote（引用）, /list（リスト）, /math（数式） など18種類以上
    </div>
  </section>

  <!-- 11. テーブル編集 -->
  <section id="tables">
    <h2>11. テーブル編集</h2>
    <p>Excel ライクな操作でテーブルを編集できます。</p>

    <h3>テーブルの作成</h3>
    <p>スラッシュコマンドまたは Markdown 記法でテーブルを作成できます。</p>
    ${imgTag(imgs.tableSlashMenu, 'テーブル挿入', 'スラッシュコマンドでテーブルを挿入')}
    ${imgTag(imgs.tableCreated, 'テーブル作成後', 'テーブルが作成された状態')}

    <h3>セル間の移動</h3>
    <ul>
      <li><kbd>Tab</kbd>: 次のセルへ移動</li>
      <li><kbd>Shift</kbd>+<kbd>Tab</kbd>: 前のセルへ移動</li>
      <li>最後のセルで <kbd>Tab</kbd>: 新しい行を追加</li>
    </ul>

    <h3>行・列の追加／削除</h3>
    <p>セルを右クリックするとコンテキストメニューが表示され、行・列の操作ができます。</p>

    <h3>その他の操作</h3>
    <ul>
      <li>列境界をドラッグして列幅を調整</li>
      <li>行ハンドルをドラッグして行を並び替え</li>
      <li>コンテキストメニューから列の配置（左/中央/右）を設定</li>
    </ul>
    ${imgTag(imgs.tableOverview, 'テーブル全体', 'テーブル編集の全体表示')}
  </section>

  <!-- 12. 数式・Mermaid図表 -->
  <section id="math-mermaid">
    <h2>12. 数式・Mermaid 図表</h2>

    <h3>インライン数式（KaTeX）</h3>
    <p>ドル記号で数式を囲みます: <code>$E = mc^2$</code></p>
    ${imgTag(imgs.inlineMath, 'インライン数式', 'インライン数式 — $...$')}

    <h3>ブロック数式</h3>
    <p>ドル記号2つで囲みます（独立した行に表示）:</p>
    <p><code>$$</code><br>数式の内容<br><code>$$</code></p>
    ${imgTag(imgs.blockMath, 'ブロック数式', 'ブロック数式 — $$...$$')}

    <h3>Mermaid フローチャート</h3>
    <p>コードブロックの言語に <code>mermaid</code> を指定すると図表がレンダリングされます。</p>
    <p>例:</p>
    <pre style="background:#f1f3f5;padding:12px;border-radius:6px;font-size:0.85em;margin:8px 0">&#96;&#96;&#96;mermaid
graph TD
    A[開始] --&gt; B{条件}
    B --&gt;|Yes| C[処理A]
    B --&gt;|No| D[処理B]
&#96;&#96;&#96;</pre>
    ${imgTag(imgs.mermaidFlowchart, 'Mermaidフローチャート', 'Mermaid 記法でレンダリングされたフローチャート')}
    ${imgTag(imgs.mathMermaidOverview, '数式・図表の全体', '数式とMermaid図表が含まれたドキュメント')}

    <div class="tip">
      <strong>ヒント:</strong> Mermaid では flowchart（フローチャート）、sequenceDiagram（シーケンス図）、gantt（ガントチャート）など多様な図表形式に対応しています。
    </div>
  </section>

  <!-- 13. 検索・置換 -->
  <section id="search-replace">
    <h2>13. 検索・置換</h2>

    <h3>テキストを検索する</h3>
    <ol class="steps">
      <li><kbd>Ctrl</kbd>+<kbd>F</kbd> を押して検索バーを開きます</li>
      <li>検索キーワードを入力します</li>
      <li>一致箇所がハイライト表示されます</li>
      <li><kbd>Enter</kbd> または「次へ」ボタンで次の一致箇所へ移動</li>
    </ol>
    ${imgTag(imgs.searchBarOpen, '検索バー', '検索バーが開いた状態 — Ctrl+F')}
    ${imgTag(imgs.searchResultHighlight, '検索結果', '検索結果がハイライト表示された状態')}

    <h3>テキストを置換する</h3>
    <ol class="steps">
      <li><kbd>Ctrl</kbd>+<kbd>H</kbd> を押して検索・置換バーを開きます</li>
      <li>検索キーワードと置換後のテキストを入力します</li>
      <li>「置換」ボタンで現在の一致箇所を置換</li>
      <li>「全て置換」ボタンで全ての一致箇所を置換</li>
    </ol>
    ${imgTag(imgs.replaceBarOpen, '置換バー', '検索・置換バーが開いた状態 — Ctrl+H')}
    ${imgTag(imgs.replaceFieldsFilled, '置換フィールド入力', '検索・置換フィールドに入力した状態')}

    <h3>その他の検索機能</h3>
    <ul>
      <li><strong>クイックオープン</strong>（<kbd>Ctrl</kbd>+<kbd>P</kbd>）: ファイル名のファジー検索で素早く開く</li>
      <li><strong>行番号ジャンプ</strong>（<kbd>Ctrl</kbd>+<kbd>G</kbd>）: 指定した行番号へ移動</li>
    </ul>
  </section>

  <!-- 14. タブ管理 -->
  <section id="tabs">
    <h2>14. タブ管理</h2>
    <p>複数のファイルをタブで同時に開いて編集できます。</p>

    <h3>タブバー</h3>
    ${imgTag(imgs.tabbarOverview, 'タブバー', 'タブバー — 複数ファイルを管理')}

    <h3>未保存マーカー</h3>
    <p>未保存の変更がある場合、タブのタイトルに <strong>●</strong> が表示されます。</p>
    ${imgTag(imgs.tabUnsavedMarker, '未保存マーカー', '未保存マーカー（●）が表示されたタブ')}

    <h3>新規タブを開く</h3>
    <p>タブバーの <strong>+</strong> ボタンをクリック、または <kbd>Ctrl</kbd>+<kbd>N</kbd> で新規タブを開きます。</p>
    ${imgTag(imgs.newTabButton, '新規タブボタン', '新規タブを開くボタン')}

    <h3>複数タブの管理</h3>
    ${imgTag(imgs.multipleTabs, '複数タブ', '複数ファイルが開かれたタブバー')}

    <h3>タブのコンテキストメニュー</h3>
    <p>タブを右クリックするとメニューが表示されます。</p>
    ${imgTag(imgs.tabContextMenu, 'タブコンテキストメニュー', 'タブの右クリックメニュー')}

    <div class="tip">
      <strong>ヒント:</strong> タブを別ウィンドウに切り出すには、タブをウィンドウ外にドラッグ＆ドロップします。
      セッション（開いているタブ）はアプリ終了時に自動保存され、次回起動時に復元されます。
    </div>
  </section>

  <!-- 15. ワークスペース・ファイル管理 -->
  <section id="workspace">
    <h2>15. ワークスペース・ファイル管理</h2>

    <h3>サイドバー</h3>
    ${imgTag(imgs.sidebarOverview, 'サイドバー', 'サイドバー — ファイルツリーとアウトラインを管理')}

    <h3>ファイルツリー</h3>
    <p>フォルダをワークスペースとして開くと（<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd>）、ファイルツリーにフォルダ構造が表示されます。</p>
    ${imgTag(imgs.fileTreePanel, 'ファイルツリー', 'ファイルツリーパネル')}

    <h3>ファイル操作</h3>
    <p>ファイルツリー内のファイルを右クリックするとコンテキストメニューが表示されます。</p>
    <ul>
      <li>新規ファイル / フォルダの作成</li>
      <li>ファイルの削除</li>
      <li>ファイルのリネーム（リネーム時に Markdown リンクも自動更新）</li>
      <li>ファイルのドラッグ＆ドロップ移動</li>
    </ul>

    <h3>ステータスバー</h3>
    <p>画面下部のステータスバーにファイル情報が表示されます。</p>
    ${imgTag(imgs.statusBar, 'ステータスバー', 'ステータスバー — エンコーディング・改行コード・カーソル位置')}
    <ul>
      <li>クリックしてエンコーディング（UTF-8 / Shift-JIS 等）を変更</li>
      <li>クリックして改行コード（LF / CRLF）を変更</li>
    </ul>

    <div class="tip">
      <strong>ヒント:</strong> 外部のエディタやツールでファイルが変更された場合、MarkWeave が変更を検出してユーザーに通知します。
      自動でリロードされることはなく、「再読み込み」か「現在の内容を保持」かを選択できます。
    </div>
  </section>

  <!-- 16. アウトラインパネル -->
  <section id="outline">
    <h2>16. アウトラインパネル</h2>
    <p>ドキュメント内の見出しが一覧表示され、クリックで素早くナビゲートできます。</p>

    <h3>アウトラインパネルの表示</h3>
    <p>サイドバーの「アウトライン」タブをクリックしてアウトラインパネルを表示します。</p>
    ${imgTag(imgs.outlinePanel, 'アウトラインパネル', '見出しが一覧表示されたアウトラインパネル')}
    ${imgTag(imgs.outlineOverview, 'アウトライン全体', 'アウトラインパネルとエディタの全体表示')}

    <h3>使い方</h3>
    <ul>
      <li>見出しをクリックすると、エディタがその見出し位置にスクロールします</li>
      <li>フィルター入力欄にキーワードを入力して見出しを絞り込めます</li>
    </ul>
  </section>

  <!-- 17. 分割エディタ -->
  <section id="split-editor">
    <h2>17. 分割エディタ</h2>
    <p>エディタを左右または上下に分割して、複数ファイルを同時に表示・編集できます。</p>

    <h3>分割エディタを開く</h3>
    <p>メニューバーの「表示」→「分割」から分割モードを選択します。</p>
    ${imgTag(imgs.splitEditorActive, '分割エディタ', '分割エディタが有効な状態')}

    <h3>分割サイズの調整</h3>
    <p>分割線をドラッグして各ペインのサイズを調整できます。</p>

    <h3>ペイン間のフォーカス移動</h3>
    <ul>
      <li><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>←</kbd>: 左ペインにフォーカス</li>
      <li><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>→</kbd>: 右ペインにフォーカス</li>
    </ul>

    <div class="tip">
      <strong>ヒント:</strong> タブをドラッグして別のペインにドロップすることで、タブをペイン間で移動できます。
      同一ファイルを分割表示する場合はスクロール同期が有効になります（設定でオフにも可能）。
    </div>
  </section>

  <!-- 18. フォーカス・タイプライター・Zenモード -->
  <section id="focus-zen">
    <h2>18. フォーカス・タイプライター・Zen モード</h2>

    <h3>フォーカスモード</h3>
    <p>現在編集中の段落のみを強調表示し、他の部分をグレーアウトします。集中して執筆できます。</p>
    <p>メニューバーの「表示」→「フォーカスモード」で切り替えます。</p>
    ${imgTag(imgs.focusMode, 'フォーカスモード', 'フォーカスモード — 現在の段落が強調されます')}

    <h3>タイプライターモード</h3>
    <p>カーソル行を常に画面中央に固定して表示します。長い文章を書く際に便利です。</p>
    <p>メニューバーの「表示」→「タイプライターモード」で切り替えます。</p>
    ${imgTag(imgs.typewriterMode, 'タイプライターモード', 'タイプライターモード — カーソル行を中央固定')}

    <h3>Zen モード（集中モード）</h3>
    <p>ツールバー・サイドバーなどの UI を非表示にして執筆に集中できます。<kbd>F11</kbd> でフルスクリーンと組み合わせると効果的です。</p>
    <p>メニューバーの「表示」→「Zen モード」で切り替えます。</p>

    <div class="tip">
      <strong>環境音機能:</strong> Zen モード中にホワイトノイズ・雨音・カフェの音などの環境音を再生できます。
    </div>
  </section>

  <!-- 19. エクスポート -->
  <section id="export">
    <h2>19. エクスポート</h2>

    <h3>HTML エクスポート</h3>
    <ol class="steps">
      <li>メニューバーの「ファイル」→「エクスポート」→「HTML」を選択します</li>
      <li>エクスポートダイアログでテーマを選択します</li>
      <li>TOC（目次）・数式・図表のレンダリングオプションを設定します</li>
      <li>「エクスポート」ボタンをクリックして保存先を指定します</li>
    </ol>
    ${imgTag(imgs.exportDialogHtml, 'HTMLエクスポートダイアログ', 'HTMLエクスポートの設定ダイアログ')}

    <h3>エクスポートテーマ</h3>
    <ul>
      <li><strong>GitHub</strong>: GitHub スタイルの見た目</li>
      <li><strong>ドキュメント</strong>: 書籍風のスタイル</li>
      <li><strong>プレゼンテーション</strong>: スライド風のスタイル</li>
    </ul>

    <h3>PDF エクスポート</h3>
    <p>メニューバーの「ファイル」→「エクスポート」→「PDF」を選択します。用紙サイズ・余白・テーマを設定して保存できます。</p>
    ${imgTag(imgs.exportDialogPdf, 'PDF エクスポートダイアログ', 'PDF エクスポートの設定ダイアログ（用紙サイズ・余白・テーマ）')}

    <h3>Pandoc エクスポート（Word / LaTeX / EPUB）</h3>
    <p>Pandoc がインストールされている場合、「ファイル」→「エクスポート」→「Pandoc」から Word・LaTeX・EPUB 形式への変換が可能です。</p>
    ${imgTag(imgs.exportDialogPandoc, 'Pandoc エクスポートダイアログ', 'Pandoc エクスポートダイアログ（Word / LaTeX / EPUB）')}

    <div class="tip">
      <strong>ヒント:</strong> HTML エクスポートではローカル画像が Base64 埋め込みされるため、スタンドアロンで表示できます。
    </div>
  </section>

  <!-- 20. 設定 -->
  <section id="settings">
    <h2>20. 設定</h2>
    <p><kbd>Ctrl</kbd>+<kbd>,</kbd> または「ファイル」→「設定」から設定ダイアログを開きます。</p>

    <h3>外観タブ（テーマ選択・表示言語）</h3>
    <p>8種類のテーマから選択できます（ライト/ダーク/GitHub/ドキュメント等）。</p>
    ${imgTag(imgs.settingsAppearanceTab, '外観設定', '外観タブ — テーマ選択')}

    <h3>表示言語の切り替え</h3>
    <p>外観タブの「表示言語」セレクターで UI の言語を切り替えられます。</p>
    <ul>
      <li><strong>自動（OS設定に従う）</strong>: OS のロケール設定を自動検出します（デフォルト）。</li>
      <li><strong>日本語</strong>: UI を日本語で表示します。</li>
      <li><strong>English</strong>: UI を英語で表示します。</li>
    </ul>
    <p>設定は即時反映されます。再起動は不要です。</p>
    <div class="tip">
      <strong>ヒント:</strong> 「自動」を選択している場合、OS のロケールが英語圏に設定されていると英語 UI が表示されます。意図した言語にならない場合は「日本語」または「English」を明示的に選択してください。
    </div>

    <h3>エディタタブ</h3>
    <p>フォントサイズ・行間・タブ幅・インデント設定などを変更できます。</p>
    ${imgTag(imgs.settingsEditorTab, 'エディタ設定', 'エディタタブ — フォント・インデントなどの設定')}

    <h3>執筆タブ</h3>
    <p>スラッシュコマンド・Zen モード専用設定・自動保存などを設定できます。</p>
    ${imgTag(imgs.settingsWritingTab, '執筆設定', '執筆タブ — Zenモード・スラッシュコマンドなどの設定')}

    <h3>プラグインタブ</h3>
    <p>インストール済みプラグインの有効/無効・アンインストール・設定を管理できます。</p>
    ${imgTag(imgs.settingsPluginsTab, 'プラグイン設定', 'プラグインタブ — プラグイン管理')}
  </section>

  <!-- 21. YAML Front Matter・プラットフォームプロファイル・コピー -->
  <section id="front-matter">
    <h2>21. YAML Front Matter・プラットフォームプロファイル・コピー</h2>

    <h3>21.1 YAML Front Matter パネル</h3>
    <p>
      ドキュメントの先頭に YAML メタデータ（タイトル・タグなど）を記述できます。
      エディタ上部の FM パネルをクリックして展開します。折りたたんだ状態でも現在のプラットフォームバッジが表示されます。
    </p>
    ${imgTag(imgs.frontMatterPanel, 'Front Matterパネル', 'YAML Front Matter パネル — 折りたたんだ状態')}
    ${imgTag(imgs.frontMatterExpanded, 'Front Matter展開', 'YAML Front Matter パネル — 展開した状態')}

    <h3>21.2 プラットフォームプロファイル</h3>
    <p>
      FM パネルの上部に <strong>プラットフォームセレクター</strong>（汎用 / Zenn / Qiita の3択トグル）が表示されます。
      公開先に合わせて切り替えることで、Front Matter フォームと構文チェックが切り替わります。
    </p>
    ${imgTag(imgs.platformProfileSelector, 'プロファイルセレクター', 'プラットフォームセレクター — 汎用 / Zenn / Qiita の 3 択')}

    <table>
      <thead><tr><th>プロファイル</th><th>Front Matter フォーム</th><th>備考</th></tr></thead>
      <tbody>
        <tr><td>汎用</td><td>自由な YAML 編集（テキストエリア）</td><td>デフォルト</td></tr>
        <tr><td>Zenn</td><td>title / emoji / type / topics / published の専用フォーム</td><td>Zenn CLI 形式</td></tr>
        <tr><td>Qiita</td><td>title / tags / private の専用フォーム</td><td>Qiita CLI 形式</td></tr>
      </tbody>
    </table>

    ${imgTag(imgs.platformProfileZenn, 'Zenn プロファイル', 'Zenn プロファイル — emoji / type / topics フォーム')}
    ${imgTag(imgs.platformProfileQiita, 'Qiita プロファイル', 'Qiita プロファイル — tags / private フォーム')}

    <div class="tip">
      <strong>手動設定時の ✎ マーク:</strong> プロファイルを手動で切り替えた場合、バッジに <strong>✎</strong> が付きます。
      YAML の内容から自動検出されたプロファイルとの区別に使えます。
    </div>

    <h3>21.3 プロファイル切り替え時の YAML 自動変換</h3>
    <p>プロファイルを切り替えると、YAML が新しいプロファイルの形式に自動変換されます。</p>
    <ul>
      <li><strong>汎用 → Zenn:</strong> Zenn デフォルト YAML（title / emoji / type / topics / published）を生成</li>
      <li><strong>汎用 → Qiita:</strong> Qiita デフォルト YAML（title / tags / private）を生成</li>
      <li><strong>Zenn → Qiita:</strong> title を引き継ぎ、topics → tags に変換（最大5件）</li>
      <li><strong>Qiita → Zenn:</strong> title を引き継ぎ、tags → topics に変換</li>
    </ul>

    <h3>21.4 プラットフォーム別構文警告</h3>
    <p>
      Qiita プロファイルのとき、Qiita で表示されない Zenn 固有記法が本文に含まれていると、FM パネルに警告が表示されます。
    </p>
    ${imgTag(imgs.platformWarnings, '構文警告', 'Qiita プロファイル時のプラットフォーム別構文警告')}

    <table>
      <thead><tr><th>アイコン</th><th>重大度</th><th>検出内容</th></tr></thead>
      <tbody>
        <tr><td>⚠</td><td>警告</td><td><code>:::message</code> / <code>:::message alert</code> ブロック</td></tr>
        <tr><td>⚠</td><td>警告</td><td><code>:::details</code> アコーディオン</td></tr>
        <tr><td>⚠</td><td>警告</td><td><code>@[youtube]</code> / <code>@[tweet]</code> / <code>@[speakerdeck]</code> / <code>@[codesandbox]</code> 埋め込み</td></tr>
        <tr><td>⚠</td><td>警告</td><td>Mermaid コードブロック（<code>\`\`\`mermaid</code>）</td></tr>
        <tr><td>ℹ</td><td>情報</td><td>脚注（<code>[^1]</code> 形式）— Qiita 非対応</td></tr>
      </tbody>
    </table>

    <h3>21.5 Zenn 記法パレット</h3>
    <p>
      <strong>Zenn プロファイル</strong>のとき、ツールバー直下に <strong>Zenn 記法パレット</strong>が表示されます。
      ボタンをクリックすると対応するブロックがカーソル位置に挿入されます。
    </p>
    ${imgTag(imgs.zennPalette, 'Zenn 記法パレット', 'Zenn プロファイル時のみ表示される Zenn 記法挿入パレット')}

    <table>
      <thead><tr><th>ボタン</th><th>挿入される記法</th></tr></thead>
      <tbody>
        <tr><td>:::message</td><td>情報ボックス（青）</td></tr>
        <tr><td>:::message alert</td><td>警告ボックス（赤）</td></tr>
        <tr><td>:::details</td><td>折りたたみアコーディオン</td></tr>
        <tr><td>@[youtube]</td><td>YouTube 動画埋め込み</td></tr>
        <tr><td>@[tweet]</td><td>ツイート埋め込み</td></tr>
        <tr><td>@[speakerdeck]</td><td>SlideShare 埋め込み</td></tr>
        <tr><td>@[codesandbox]</td><td>CodeSandbox 埋め込み</td></tr>
      </tbody>
    </table>

    <div class="tip">
      <strong>注意:</strong> Zenn 記法パレットは Zenn プロファイル選択時のみ表示されます。
      Qiita / 汎用プロファイルでは非表示です。
    </div>

    <h3>21.6 Markdown コピーボタン</h3>
    <p>
      FM パネル下部に <strong>コピーボタン</strong>が表示されます。現在の Front Matter と本文を結合した完全な Markdown をクリップボードにコピーします。
    </p>
    ${imgTag(imgs.copyButtons, 'コピーボタン', 'Markdown コピーボタン（Zenn モード時は Qiita 変換コピーも表示）')}

    <ul>
      <li><strong>📋 Markdown をコピー:</strong> 現在のプロファイル形式のまま完全 Markdown をコピー（常時表示）</li>
      <li><strong>⇄ Qiita 用に変換してコピー:</strong> Zenn プロファイルのみ表示。:::message 等を自動除去し、topics → tags 変換した Qiita 向け Markdown をコピー</li>
    </ul>
    <p>コピー成否はトーストメッセージで通知されます。</p>

    <h3>21.7 リンクの挿入</h3>
    <p><kbd>Ctrl</kbd>+<kbd>K</kbd> を押すとリンク挿入ダイアログが表示されます。</p>
    ${imgTag(imgs.linkInsertDialog, 'リンク挿入ダイアログ', 'リンク挿入ダイアログ — Ctrl+K')}
    <p>または Markdown 記法で直接入力: <code>[リンクテキスト](URL)</code></p>

    <h3>21.8 クロスファイルリンク</h3>
    <p>別の Markdown ファイルへのリンクを <kbd>Ctrl</kbd>+クリックすると、そのファイルが新しいタブで開きます。</p>

    <h3>21.9 文書統計</h3>
    <p>メニューバーの「ツール」→「文書統計」から文字数・単語数・読了時間を確認できます。</p>
    ${imgTag(imgs.wordCountDialog, '文書統計ダイアログ', '文書統計 — 文字数・単語数・読了時間')}

    <div class="tip">
      <strong>行ブックマーク:</strong> <kbd>Ctrl</kbd>+<kbd>F2</kbd> でブックマークを設置、<kbd>F2</kbd> で次のブックマークへ、<kbd>Shift</kbd>+<kbd>F2</kbd> で前のブックマークへ移動できます。
    </div>
  </section>

  <!-- 22. AI コピー機能 -->
  <section id="ai-copy">
    <h2>22. AI コピー機能</h2>
    <p>
      ツールバー右端の <strong>✨ AI コピー</strong> ボタンを使うと、現在のドキュメントを AI（Claude・ChatGPT など）に貼り付けやすい形式に最適化してクリップボードにコピーできます。
    </p>
    ${imgTag(imgs.aiCopyButtonToolbar, 'AI コピーボタン', 'ツールバー右端の「✨ AI コピー」ボタン')}

    <h3>22.1 基本的な使い方</h3>
    <ol class="steps">
      <li>WYSIWYG モードでドキュメントを開きます</li>
      <li>ツールバー右端の <strong>✨ AI コピー</strong> ボタンをクリックします</li>
      <li>Markdown が最適化されてクリップボードにコピーされます（ボタンが「コピー済み ✓」に変わります）</li>
      <li>AI チャット画面にそのまま貼り付けます</li>
    </ol>
    ${imgTag(imgs.aiCopyCopiedState, 'コピー完了状態', 'コピー完了後のボタン表示（コピー済み ✓）')}

    <h3>22.2 最適化オプション</h3>
    <p>ボタン右の <strong>▼</strong> をクリックするとオプションメニューが表示されます。</p>
    ${imgTag(imgs.aiCopyOptionsDropdown, '最適化オプション', 'AI コピーの最適化オプションドロップダウン')}
    <ul>
      <li><strong>最適化してコピー</strong>: すぐにコピー（デフォルト）</li>
      <li><strong>最適化プレビューを表示してからコピー</strong>: 変更内容を確認してからコピー</li>
    </ul>
    <p>オプションセクションでは各最適化処理のオン/オフを個別に設定できます。</p>
    <ul>
      <li>見出し階層の修正</li>
      <li>コードブロックへの言語タグ付与</li>
      <li>リスト記号の統一</li>
      <li>過剰な空白行の削除</li>
      <li>リンクへの URL 注記追加</li>
      <li>コードフェンスの統一</li>
    </ul>

    <h3>22.3 最適化レポート</h3>
    <p>「最適化プレビューを表示してからコピー」を選ぶと、コピー後に変更内容のレポートが表示されます。</p>
    ${imgTag(imgs.aiCopyReportPopover, '最適化レポート', 'AIコピー後に表示される最適化レポートのポップオーバー')}

    <div class="tip">
      <strong>ヒント:</strong> AI コピーボタンは WYSIWYG モード時のみ表示されます。ソースモードでは非表示になります。
    </div>
  </section>

  <!-- 23. AI テンプレートパネル -->
  <section id="ai-template">
    <h2>23. AI テンプレートパネル</h2>
    <p>
      AI テンプレートパネルを使うと、ブログ記事・議事録・要約・コードレビューなど、用途別のテンプレートをエディタに素早く挿入できます。
    </p>
    ${imgTag(imgs.aiTemplatePanelOpen, 'AI テンプレートパネル', 'サイドバーの AI テンプレートパネル')}

    <h3>23.1 パネルを開く</h3>
    <ol class="steps">
      <li>メニューバーの「表示」→「AI テンプレート」を選択します</li>
      <li>サイドバーが開き AI テンプレートパネルが表示されます</li>
    </ol>

    <h3>23.2 カテゴリフィルタ</h3>
    <p>パネル上部のカテゴリタブでテンプレートを絞り込めます。</p>
    ${imgTag(imgs.aiTemplateCategoryFilter, 'カテゴリフィルタ', 'テンプレートのカテゴリ選択タブ')}
    <ul>
      <li><strong>すべて</strong>: 全テンプレートを表示</li>
      <li><strong>ブログ</strong>: ブログ記事構成・紹介文など</li>
      <li><strong>コード</strong>: コードレビュー・説明文など</li>
      <li><strong>要約</strong>: 文章の要約・箇条書き化など</li>
      <li><strong>推論</strong>: Chain-of-Thought など</li>
      <li><strong>議事録</strong>: 会議メモのテンプレート</li>
      <li><strong>翻訳</strong>: 翻訳プロンプト</li>
    </ul>

    <h3>23.3 テンプレートを選択・プレビュー</h3>
    <p>テンプレート名をクリックすると右ペインにプレビューが表示されます。</p>
    ${imgTag(imgs.aiTemplatePreview, 'テンプレートプレビュー', 'テンプレート選択後のプレビュー表示')}

    <h3>23.4 キーワード検索</h3>
    <p>パネル上部の検索ボックスにキーワードを入力してテンプレートを絞り込めます。</p>
    ${imgTag(imgs.aiTemplateSearch, 'キーワード検索', 'テンプレートのキーワード検索')}

    <h3>23.5 テンプレートを挿入する</h3>
    <ol class="steps">
      <li>テンプレートを選択してプレビューを表示します</li>
      <li>「挿入」ボタンをクリックします</li>
      <li>プレースホルダー入力ダイアログが表示されます</li>
      <li>各フィールドに値を入力して「OK」をクリックします</li>
      <li>完成した Markdown がエディタに挿入されます</li>
    </ol>
    ${imgTag(imgs.aiTemplatePlaceholderDialog, 'プレースホルダー入力', 'テンプレートのプレースホルダー入力ダイアログ')}

    <h3>23.6 カスタムテンプレートの作成</h3>
    <p>パネル右上の <strong>+</strong> ボタンからオリジナルテンプレートを作成できます。</p>
    ${imgTag(imgs.aiTemplateNewButton, '新規テンプレートボタン', '新規テンプレート作成ボタン（+ ボタン）')}
    ${imgTag(imgs.aiTemplateCustomEditor, 'カスタムテンプレートエディタ', 'カスタムテンプレート作成エディタ')}
    <ul>
      <li>テンプレート名・カテゴリ・本文を入力します</li>
      <li>本文中の <code>{{変数名}}</code> がプレースホルダーになります</li>
      <li>保存するとテンプレート一覧に追加されます</li>
    </ul>

    <div class="tip">
      <strong>ヒント:</strong> スラッシュコマンドから <code>/aiテンプレート</code> と入力してもパネルを開けます。
    </div>
  </section>

  <!-- 24. ファイル管理の応用 -->
  <section id="file-management">
    <h2>24. ファイル管理の応用</h2>

    <h3>最近使ったファイル・最近のワークスペース</h3>
    <p>メニューバーの「ファイル」→「最近使ったファイル...」から以前開いたファイルを素早く再度開けます。「最近のワークスペース...」では最近使ったフォルダに切り替えられます。</p>
    ${imgTag(imgs.recentFilesMenu, '最近使ったファイルメニュー', 'ファイルメニューの「最近使ったファイル」一覧')}

    <h3>デイリーノート</h3>
    <p>メニューバーの「ファイル」→「デイリーノート作成」（<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>D</kbd>）で、今日の日付名（例: <code>2026-03-16.md</code>）のファイルを作成します。ワークスペース使用時は <code>daily/</code> フォルダに作成されます。</p>
    ${imgTag(imgs.dailyNote, 'デイリーノート', '日付名で作成されたデイリーノートファイル')}

    <h3>テンプレートから新規作成</h3>
    <p>メニューバーの「ファイル」→「テンプレートから新規作成...」で定義済みのファイルテンプレートを元に新規ファイルを作成します。</p>
    ${imgTag(imgs.templateDialog, 'テンプレート選択ダイアログ', 'ファイルテンプレート選択ダイアログ')}

    <h3>別名で保存（形式変換）</h3>
    <p>「ファイル」→「別名で保存」からファイルを別の形式で保存できます。</p>
    <ul>
      <li><strong>Markdown として保存</strong>（<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd>）: Zenn / Qiita 投稿用 Markdown ファイルとして保存</li>
      <li><strong>HTML として保存</strong>（<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd>）: シンプルな HTML ファイルとして保存</li>
    </ul>
    ${imgTag(imgs.saveAsMarkdown, 'Markdownとして保存', 'Markdown として保存ダイアログ')}

    <h3>印刷</h3>
    <p>メニューバーの「ファイル」→「印刷...」（<kbd>Ctrl</kbd>+<kbd>P</kbd>）で OS 標準の印刷ダイアログを開きます。</p>
    ${imgTag(imgs.printDialog, '印刷ダイアログ', 'OS 標準の印刷ダイアログ')}
  </section>

  <!-- 25. サイドバーパネル詳細 -->
  <section id="sidebar-panels">
    <h2>25. サイドバーパネル詳細</h2>

    <h3>サイドバーの表示/非表示</h3>
    <p>メニューバーの「表示」→「サイドバーの表示/非表示」（<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>）でサイドバー全体をトグルできます。編集領域を最大化したいときに便利です。</p>
    ${imgTag(imgs.sidebarToggle, 'サイドバートグル', 'サイドバーが非表示になった状態')}

    <h3>バックリンク</h3>
    <p>「表示」→「バックリンク」（<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>4</kbd>）で現在のファイルを参照している他のファイルの一覧を表示します。Wikiリンク（<code>[[ファイル名]]</code>）でドキュメントを相互参照している場合に便利です。</p>
    ${imgTag(imgs.backlinksPanel, 'バックリンクパネル', 'バックリンクパネル — 参照元ファイルの一覧')}
    <div class="tip">
      <strong>有効化:</strong> 設定（<kbd>Ctrl</kbd>+<kbd>,</kbd>）→「プラグイン」タブ → バックリンクを有効化してください（デフォルト非表示）。
    </div>

    <h3>タグビュー</h3>
    <p>「表示」→「タグビュー」（<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>5</kbd>）で YAML Front Matter や本文中の <code>#タグ</code> を収集・一覧表示します。タグをクリックして関連ファイルを絞り込めます。</p>
    ${imgTag(imgs.tagsPanel, 'タグビューパネル', 'タグビュー — タグ一覧と関連ファイル')}
    <div class="tip">
      <strong>有効化:</strong> 設定 →「プラグイン」タブ → タグビューを有効化してください（デフォルト非表示）。
    </div>

    <h3>Git パネル</h3>
    <p>「表示」→「Git パネル」（<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>7</kbd>）でワークスペースの Git 状態（変更ファイル・ステージング・差分）を表示します。Git のインストールが必要です。</p>
    ${imgTag(imgs.gitPanel, 'Git パネル', 'Git パネル — 変更ファイルとステージング状態')}
    <div class="tip">
      <strong>有効化:</strong> 設定 →「プラグイン」タブ → Git パネルを有効化してください（デフォルト非表示）。
    </div>

    <h3>Lint パネル（文章スタイルチェック）</h3>
    <p>「表示」→「Lint パネル」（<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>8</kbd>）でサイドバーに Lint タブを開きます。</p>
    <p>Lint パネルは 2 つのチェッカーで構成されています。</p>
    <ul>
      <li><strong>Markdown Lint</strong> — 見出しレベル飛び・リンク切れ・空行不足など、Markdown 構造上の問題を検出します。</li>
      <li><strong>文章スタイル Lint（Prose Lint）</strong> — AI を使わずにローカルで文章品質を分析します。
        <ul>
          <li><strong>SENT001: 文の長さ</strong> — 100 文字を超える長い文を警告。読みにくい長文を短く分割するよう促します。</li>
          <li><strong>STYLE001: 文体混在</strong> — ですます調とだ・である調が混在している場合に少数派の文を指摘。</li>
          <li><strong>STYLE002: 弱い表現</strong> — 「〜と思います」「〜かもしれません」など曖昧な表現を情報として提示。</li>
          <li><strong>STYLE003: 冗長表現</strong> — 「〜することができる」→「〜できる」のような簡潔な書き換え案を提示。</li>
          <li><strong>STYLE004: 助詞の重複</strong> — 同一文中で「を」が重複している箇所を指摘。</li>
        </ul>
      </li>
    </ul>
    <p>指摘箇所をクリックすると、エディタが該当行にジャンプします。コードブロックと YAML Front Matter 内のテキストは検査対象外です。</p>
    ${imgTag(imgs.lintPanel, 'Lint パネル', 'Lint パネル — 文章スタイルの問題と修正案を一覧表示')}
    <div class="tip">
      <strong>有効化:</strong> 設定 →「表示」タブ →「詳細パネルを表示」をオンにしてください（デフォルト非表示）。
    </div>
  </section>

  <!-- 26. フローティング目次・ズーム -->
  <section id="view-tools">
    <h2>26. フローティング目次・ズーム</h2>

    <h3>フローティング目次</h3>
    <p>
      メニューバーの「表示」→「フローティング目次」（<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd>）でエディタ内に小さな目次ウィンドウを表示します。
      アウトラインパネルとは異なり、サイドバーを閉じたままや Zen モード中でも利用できます。
    </p>
    ${imgTag(imgs.floatingToc, 'フローティング目次', 'エディタ内に表示されるフローティング目次')}

    <h3>ズーム</h3>
    <p>メニューバーの「表示」→「拡大 / 縮小 / 実際のサイズ」またはショートカットで表示サイズを調整できます。</p>
    <table>
      <thead><tr><th>操作</th><th>ショートカット</th></tr></thead>
      <tbody>
        <tr><td>拡大</td><td><kbd>Ctrl</kbd>+<kbd>=</kbd></td></tr>
        <tr><td>縮小</td><td><kbd>Ctrl</kbd>+<kbd>-</kbd></td></tr>
        <tr><td>実際のサイズにリセット</td><td><kbd>Ctrl</kbd>+<kbd>0</kbd></td></tr>
      </tbody>
    </table>
  </section>

  <!-- 27. 執筆ツール -->
  <section id="writing-tools">
    <h2>27. 執筆ツール</h2>

    <h3>ポモドーロタイマー</h3>
    <p>画面下部の<strong>ステータスバー</strong>にあるポモドーロアイコンをクリックして起動します。25分作業 + 5分休憩のサイクルで集中時間を管理します。タイマーをクリックして開始・一時停止・リセットができます。</p>
    ${imgTag(imgs.pomodoroTimer, 'ポモドーロタイマー', 'ステータスバーのポモドーロタイマー')}

    <h3>ワードスプリント</h3>
    <p>画面下部の<strong>ステータスバー</strong>にあるワードスプリントアイコンをクリックして起動します。時間制限内（例: 10分）で目標文字数を達成するチャレンジ機能です。進捗がリアルタイムで表示されます。</p>
    ${imgTag(imgs.wordSprintWidget, 'ワードスプリント', 'ステータスバーのワードスプリントウィジェット')}

    <h3>文書統計</h3>
    <p>メニューバーの「編集」→「文書統計...」でダイアログを開き、文字数・単語数・段落数・推定読了時間・可読性スコアを確認できます。ステータスバーにも文字数と読了時間がリアルタイムで常時表示されています。</p>
    ${imgTag(imgs.docStatsDialog, '文書統計ダイアログ', '文書統計 — 文字数・単語数・読了時間・可読性スコア')}
  </section>

  <!-- 28. キーボードショートカット一覧 -->
  <section id="shortcuts">
    <h2>28. キーボードショートカット一覧</h2>
    <table class="shortcut-table">
      <thead>
        <tr>
          <th>操作</th>
          <th>ショートカット</th>
          <th>Markdown 記法</th>
        </tr>
      </thead>
      <tbody>
        <tr><td colspan="3" style="background:#f1f3f5;font-weight:600;color:#495057">ファイル操作</td></tr>
        <tr><td>新規ファイル</td><td><kbd>Ctrl</kbd>+<kbd>N</kbd></td><td>—</td></tr>
        <tr><td>ファイルを開く</td><td><kbd>Ctrl</kbd>+<kbd>O</kbd></td><td>—</td></tr>
        <tr><td>フォルダを開く</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd></td><td>—</td></tr>
        <tr><td>保存</td><td><kbd>Ctrl</kbd>+<kbd>S</kbd></td><td>—</td></tr>
        <tr><td>名前を付けて保存</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd></td><td>—</td></tr>
        <tr><td>Markdown として保存</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd></td><td>—</td></tr>
        <tr><td>HTML として保存</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd></td><td>—</td></tr>
        <tr><td>デイリーノート作成</td><td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>D</kbd></td><td>—</td></tr>
        <tr><td colspan="3" style="background:#f1f3f5;font-weight:600;color:#495057">テキスト書式</td></tr>
        <tr><td>太字</td><td><kbd>Ctrl</kbd>+<kbd>B</kbd></td><td><code>**text**</code></td></tr>
        <tr><td>斜体</td><td><kbd>Ctrl</kbd>+<kbd>I</kbd></td><td><code>*text*</code></td></tr>
        <tr><td>取り消し線</td><td>—</td><td><code>~~text~~</code></td></tr>
        <tr><td>インラインコード</td><td>—</td><td><code>&#96;code&#96;</code></td></tr>
        <tr><td>リンク挿入</td><td><kbd>Ctrl</kbd>+<kbd>K</kbd></td><td><code>[text](url)</code></td></tr>
        <tr><td colspan="3" style="background:#f1f3f5;font-weight:600;color:#495057">見出し</td></tr>
        <tr><td>H1〜H6 見出し</td><td><kbd>Ctrl</kbd>+<kbd>1</kbd>〜<kbd>6</kbd></td><td><code># </code>〜<code>###### </code>（行頭）</td></tr>
        <tr><td colspan="3" style="background:#f1f3f5;font-weight:600;color:#495057">リスト・ブロック</td></tr>
        <tr><td>箇条書きリスト</td><td>—</td><td><code>- </code>（行頭）</td></tr>
        <tr><td>番号付きリスト</td><td>—</td><td><code>1. </code>（行頭）</td></tr>
        <tr><td>タスクリスト</td><td>—</td><td><code>- [ ] </code>（行頭）</td></tr>
        <tr><td>引用ブロック</td><td>—</td><td><code>&gt; </code>（行頭）</td></tr>
        <tr><td>コードブロック</td><td>—</td><td><code>&#96;&#96;&#96;</code>（行頭）</td></tr>
        <tr><td>水平線</td><td>—</td><td><code>---</code>（行頭）</td></tr>
        <tr><td colspan="3" style="background:#f1f3f5;font-weight:600;color:#495057">編集</td></tr>
        <tr><td>元に戻す</td><td><kbd>Ctrl</kbd>+<kbd>Z</kbd></td><td>—</td></tr>
        <tr><td>やり直し</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></td><td>—</td></tr>
        <tr><td>プレーンテキスト貼り付け</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd></td><td>—</td></tr>
        <tr><td>単語補完</td><td><kbd>Ctrl</kbd>+<kbd>Space</kbd></td><td>—</td></tr>
        <tr><td>設定</td><td><kbd>Ctrl</kbd>+<kbd>,</kbd></td><td>—</td></tr>
        <tr><td colspan="3" style="background:#f1f3f5;font-weight:600;color:#495057">ナビゲーション・検索</td></tr>
        <tr><td>検索</td><td><kbd>Ctrl</kbd>+<kbd>F</kbd></td><td>—</td></tr>
        <tr><td>検索・置換</td><td><kbd>Ctrl</kbd>+<kbd>H</kbd></td><td>—</td></tr>
        <tr><td>クイックオープン</td><td><kbd>Ctrl</kbd>+<kbd>P</kbd></td><td>—</td></tr>
        <tr><td>行番号ジャンプ</td><td><kbd>Ctrl</kbd>+<kbd>G</kbd></td><td>—</td></tr>
        <tr><td>行ブックマーク設置</td><td><kbd>Ctrl</kbd>+<kbd>F2</kbd></td><td>—</td></tr>
        <tr><td>次のブックマークへ</td><td><kbd>F2</kbd></td><td>—</td></tr>
        <tr><td>前のブックマークへ</td><td><kbd>Shift</kbd>+<kbd>F2</kbd></td><td>—</td></tr>
        <tr><td colspan="3" style="background:#f1f3f5;font-weight:600;color:#495057">モード・表示</td></tr>
        <tr><td>ソースモード切替</td><td><kbd>Ctrl</kbd>+<kbd>/</kbd></td><td>—</td></tr>
        <tr><td>サイドバー 表示/非表示</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd></td><td>—</td></tr>
        <tr><td>アウトラインパネル</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>1</kbd></td><td>—</td></tr>
        <tr><td>ファイルパネル</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>2</kbd></td><td>—</td></tr>
        <tr><td>AI テンプレート</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>3</kbd></td><td>—</td></tr>
        <tr><td>バックリンク</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>4</kbd></td><td>—</td></tr>
        <tr><td>タグビュー</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>5</kbd></td><td>—</td></tr>
        <tr><td>Git パネル</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>7</kbd></td><td>—</td></tr>
        <tr><td>Lint パネル</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>8</kbd></td><td>—</td></tr>
        <tr><td>フローティング目次</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd></td><td>—</td></tr>
        <tr><td>ペイン分割</td><td><kbd>Ctrl</kbd>+<kbd>\</kbd></td><td>—</td></tr>
        <tr><td>フォーカスモード</td><td><kbd>F8</kbd></td><td>—</td></tr>
        <tr><td>タイプライターモード</td><td><kbd>F9</kbd></td><td>—</td></tr>
        <tr><td>Zen モード</td><td><kbd>F11</kbd></td><td>—</td></tr>
        <tr><td>拡大</td><td><kbd>Ctrl</kbd>+<kbd>=</kbd></td><td>—</td></tr>
        <tr><td>縮小</td><td><kbd>Ctrl</kbd>+<kbd>-</kbd></td><td>—</td></tr>
        <tr><td>実際のサイズ</td><td><kbd>Ctrl</kbd>+<kbd>0</kbd></td><td>—</td></tr>
        <tr><td>ペイン間フォーカス移動</td><td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>←/→</kbd></td><td>—</td></tr>
      </tbody>
    </table>
  </section>

  <!-- 29. FAQ -->
  <section id="faq">
    <h2>29. FAQ</h2>
    <dl>
      <div class="faq-item">
        <dt>Q1. Markdown 記法を知らなくても使えますか？</dt>
        <dd>はい。WYSIWYG モードではツールバーとショートカットだけで編集できます。Markdown 記法を知っているとより効率的に使えます。</dd>
      </div>
      <div class="faq-item">
        <dt>Q2. オフラインでも使えますか？</dt>
        <dd>はい。MarkWeave はローカルファイルを直接編集するデスクトップアプリのため、ネット接続不要で利用できます。</dd>
      </div>
      <div class="faq-item">
        <dt>Q3. 既存の Markdown / HTML ファイルは開けますか？</dt>
        <dd>はい。既存ファイルをそのまま開いて編集できます。HTML ファイルも WYSIWYG 編集が可能です。</dd>
      </div>
      <div class="faq-item">
        <dt>Q4. 大きいファイルは扱えますか？</dt>
        <dd>はい。200KB 以上の大容量ファイル向けに最適化されており、3MB 超のファイルは自動でソースモードに切り替わります。</dd>
      </div>
      <div class="faq-item">
        <dt>Q5. 外部エディタで変更したファイルはどうなりますか？</dt>
        <dd>外部変更が検出されると通知が表示され、「エディタの内容を保持」か「ディスクから再読み込み」かを選択できます。自動で上書きされることはありません。</dd>
      </div>
      <div class="faq-item">
        <dt>Q6. セッション（開いているタブ）は保存されますか？</dt>
        <dd>はい。アプリ終了時に開いているタブとワークスペースの状態が自動保存され、次回起動時に復元されます。</dd>
      </div>
      <div class="faq-item">
        <dt>Q7. テーブルを Markdown 記法で入力できますか？</dt>
        <dd>はい。Markdown のパイプ記法 <code>| 列1 | 列2 |</code> でテーブルを作成できます。または <code>/table</code> スラッシュコマンドを使うと便利です。</dd>
      </div>
      <div class="faq-item">
        <dt>Q8. PDF エクスポートに Pandoc は必要ですか？</dt>
        <dd>PDF エクスポートには Pandoc のインストールが必要です。未インストールの場合はアプリが自動検出してインストール方法を案内します。</dd>
      </div>
    </dl>
  </section>

</main>

<footer>
  <a href="../index.html">Home</a>
  <a href="user-manual.html">クイックガイド</a>
  <a href="https://github.com/hayashixd/MarkWeave">GitHub</a>
  <p style="margin-top:0.75rem;">© 2024–2026 MarkWeave · MIT License</p>
</footer>

</body>
</html>`;

// 出力ディレクトリを確認
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, html, 'utf8');
const stats = fs.statSync(outputPath);
console.log('Generated:', outputPath);
console.log('File size:', Math.round(stats.size / 1024), 'KB');
