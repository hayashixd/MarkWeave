# Advanced Features Guide

For basic usage, see [user-manual.en.md](./user-manual.en.md).
This guide covers all advanced features, every menu item, and the complete shortcut reference.

---

## 1. Workspace & File Management

### Open a Folder as Workspace

**File → Open Folder...** (`Ctrl+Shift+O`)

When you open a folder as a workspace:

- A file tree appears in the left sidebar
- You can create, delete, and rename files within the folder
- Use Quick Open (`Ctrl+P`) to quickly access files in the workspace
- Renaming a file automatically updates internal Markdown links

**External change detection**: If a file is modified externally (Dropbox, OneDrive, etc.), MarkWeave notifies you instead of silently overwriting. Choose to keep the editor content or reload from disk.

### Recent Files & Recent Workspaces

- **File → Recent Files...**: Quickly reopen recently accessed files
- **File → Recent Workspaces...**: Switch back to recently used workspace folders

### Daily Note

**File → Create Daily Note** (`Ctrl+Alt+D`)

Creates a new file named after today's date (e.g. `2026-03-16.md`). When a workspace is open, the file is created inside a `daily/` subfolder. Great for continuous journaling and daily logs.

### New from Template

**File → New from Template...**

Creates a new file based on a predefined file template. This is separate from the AI Templates panel and works with file-structure templates.

### Save As (Format Conversion)

| Action | Menu | Shortcut |
|--------|------|----------|
| Save as Markdown | File → Save As → Save as Markdown... | `Ctrl+Shift+M` |
| Save as HTML | File → Save As → Save as HTML... | `Ctrl+Shift+H` |

Unlike Export (which opens a dialog with options), Save As directly saves the content in the target format.

### Print

**File → Print...** (`Ctrl+P`)

Opens the OS native print dialog.

---

## 2. Sidebar Panels

### Toggle Sidebar

**View → Toggle Sidebar** (`Ctrl+Shift+L`)

Hides or shows the entire sidebar to maximize the editing area.

### Panel Shortcuts

| Panel | Menu | Shortcut |
|-------|------|----------|
| Outline | View → Outline Panel | `Ctrl+Shift+1` |
| File Tree | View → File Panel | `Ctrl+Shift+2` |
| AI Templates | View → AI Templates | `Ctrl+Shift+3` |
| Backlinks | View → Backlinks | `Ctrl+Shift+4` |
| Tag View | View → Tag View | `Ctrl+Shift+5` |
| Git Panel | View → Git Panel | `Ctrl+Shift+7` |

### Backlinks

**View → Backlinks** (`Ctrl+Shift+4`)

Shows a list of other files that reference the current file. Useful when using Wiki-link syntax (`[[filename]]`) for cross-referencing documents.

> **To enable**: Settings (`Ctrl+,`) → Plugins tab → enable Backlinks

### Tag View

**View → Tag View** (`Ctrl+Shift+5`)

Collects tags from YAML Front Matter and inline `#tags` across your workspace and displays them in a list. Click a tag to filter files by that tag.

> **To enable**: Settings (`Ctrl+,`) → Plugins tab → enable Tag View

### Git Panel

**View → Git Panel** (`Ctrl+Shift+7`)

Shows the Git status of your workspace repository: changed files, staging area, and diffs. Requires Git to be installed on your system.

> **To enable**: Settings (`Ctrl+,`) → Plugins tab → enable Git Panel

---

## 3. Floating Table of Contents

**View → Floating TOC** (`Ctrl+Shift+T`)

Displays a small floating window with the document's table of contents. Unlike the Outline panel, this works even when the sidebar is closed or in Zen mode.

---

## 4. Split Editor

**View → Split Pane** (`Ctrl+\`)

Splits the editor left and right to display and edit two files simultaneously.

- Drag the divider to resize panes
- Drag tabs between panes to move them
- `Ctrl+Alt+←` / `Ctrl+Alt+→` to move focus between panes
- Opening the same file in both panes synchronizes scroll position

---

## 5. Focus Writing Modes

### Focus Mode

**View → Focus Mode** (`F8`)

Highlights only the paragraph you are currently editing, graying out surrounding text. Effective for maintaining concentration during long writing sessions.

### Typewriter Mode

**View → Typewriter Mode** (`F9`)

Keeps the cursor line centered on screen. Reduces eye movement and is well-suited for extended writing.

### Zen Mode

**View → Zen Mode** (`F11`)

Hides the sidebar, toolbar, and status bar for distraction-free writing. You can also play ambient sounds (white noise, rain, café ambiance, etc.) during Zen mode (Settings → Writing tab).

---

## 6. View Settings

### Zoom

| Action | Menu | Shortcut |
|--------|------|----------|
| Zoom in | View → Zoom In | `Ctrl+=` |
| Zoom out | View → Zoom Out | `Ctrl+-` |
| Reset zoom | View → Actual Size | `Ctrl+0` |

---

## 7. Writing Tools

### Pomodoro Timer

Click the Pomodoro icon in the **status bar** (bottom of the screen) to start.

Manages writing time in 25-minute work + 5-minute break cycles. Click the timer to start, pause, or reset.

### Word Sprint

Click the Word Sprint icon in the **status bar** (bottom of the screen) to start.

A challenge mode where you set a time limit (e.g. 10 minutes) and a target word count. Progress is shown in real time.

### Document Statistics

**Edit → Document Statistics...**

Shows character count, word count, paragraph count, estimated reading time, and readability score. The status bar also displays character count and reading time in real time.

---

## 8. AI Features

### AI Copy

Click the **✨ AI Copy** button in the toolbar to copy the current document to your clipboard, optimized for AI input. Paste directly into Claude or ChatGPT for review or improvement.

Optimizations (each can be toggled on/off):

- Fix heading hierarchy
- Add language tags to code blocks
- Normalize list markers
- Remove excess blank lines
- Add URL annotations to links

### AI Templates

**View → AI Templates** (`Ctrl+Shift+3`)

Insert purpose-built prompt templates into the editor.

| Category | Examples |
|----------|---------|
| Blog | Article outline, introduction, conclusion |
| Code | Code review request, code explanation |
| Summary | Bullet-point summary, rewrite |
| Translation | Japanese–English translation prompts |
| Minutes | Meeting notes template |

Create custom templates with the **+** button in the panel. Use `{{variable}}` syntax for placeholders.

---

## 9. All Export Formats

| Format | Menu | Shortcut | Notes |
|--------|------|----------|-------|
| HTML | File → Export → HTML... | `Ctrl+Shift+E` | Images embedded as Base64, standalone |
| PDF | File → Export → PDF... | `Ctrl+Alt+P` | Choose paper size, margins, theme |
| Word (.docx) | File → Export → Word... | `Ctrl+Alt+W` | Requires Pandoc |
| LaTeX | File → Export → LaTeX... | — | Requires Pandoc |
| EPUB | File → Export → ePub... | — | Requires Pandoc |
| Markdown | File → Save As → Save as Markdown... | `Ctrl+Shift+M` | For Zenn / Qiita posting |
| HTML (save) | File → Save As → Save as HTML... | `Ctrl+Shift+H` | Simple HTML conversion |
| Print | File → Print... | `Ctrl+P` | OS native print dialog |

---

## 10. YAML Front Matter

Edit the `---` block at the top of a file via GUI. Click the FM bar at the top of the editor to expand it.

```yaml
---
title: "Building a Type-Safe API Client with TypeScript"
emoji: "🛡️"
type: "tech"
topics: ["typescript", "api"]
published: false
---
```

---

## 11. Settings

**Edit → Preferences...** (`Ctrl+,`)

| Tab | Key settings |
|-----|-------------|
| Appearance | Theme (8 options: light/dark/GitHub/Document, etc.), font, colors |
| Editor | Font size, line height, tab width, indent |
| Writing | Slash commands, Zen mode options, auto-save, ambient sounds |
| Plugins | Enable Backlinks, Tag View, Git Panel |

---

## 12. Full Keyboard Shortcut Reference

### File Operations

| Action | Shortcut |
|--------|----------|
| New file | `Ctrl+N` |
| Open file | `Ctrl+O` |
| Open folder | `Ctrl+Shift+O` |
| Save | `Ctrl+S` |
| Save as | `Ctrl+Shift+S` |
| Save as Markdown | `Ctrl+Shift+M` |
| Save as HTML | `Ctrl+Shift+H` |
| Create daily note | `Ctrl+Alt+D` |
| Quick open | `Ctrl+P` |

### Editing

| Action | Shortcut |
|--------|----------|
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Shift+Z` |
| Cut | `Ctrl+X` |
| Copy | `Ctrl+C` |
| Paste | `Ctrl+V` |
| Paste as plain text | `Ctrl+Shift+V` |
| Select all | `Ctrl+A` |
| Search | `Ctrl+F` |
| Find & Replace | `Ctrl+H` |
| Jump to line | `Ctrl+G` |
| Set line bookmark | `Ctrl+F2` |
| Next bookmark | `F2` |
| Previous bookmark | `Shift+F2` |
| Word completion | `Ctrl+Space` |
| Settings | `Ctrl+,` |

### Text Formatting

| Action | Shortcut | Markdown Syntax |
|--------|----------|----------------|
| Bold | `Ctrl+B` | `**text**` |
| Italic | `Ctrl+I` | `*text*` |
| Strikethrough | — | `~~text~~` |
| Inline code | — | `` `code` `` |
| Link | `Ctrl+K` | `[text](url)` |
| H1–H6 headings | `Ctrl+1`–`6` | `#`–`######` |

### View & Panels

| Action | Shortcut |
|--------|----------|
| Toggle sidebar | `Ctrl+Shift+L` |
| Outline panel | `Ctrl+Shift+1` |
| File panel | `Ctrl+Shift+2` |
| AI Templates | `Ctrl+Shift+3` |
| Backlinks | `Ctrl+Shift+4` |
| Tag View | `Ctrl+Shift+5` |
| Git Panel | `Ctrl+Shift+7` |
| Floating TOC | `Ctrl+Shift+T` |
| Split pane | `Ctrl+\` |
| Toggle source mode | `Ctrl+/` |
| Focus mode | `F8` |
| Typewriter mode | `F9` |
| Zen mode | `F11` |
| Zoom in | `Ctrl+=` |
| Zoom out | `Ctrl+-` |
| Reset zoom | `Ctrl+0` |
| Focus left pane | `Ctrl+Alt+←` |
| Focus right pane | `Ctrl+Alt+→` |

### Export

| Action | Shortcut |
|--------|----------|
| Export HTML | `Ctrl+Shift+E` |
| Export PDF | `Ctrl+Alt+P` |
| Export Word | `Ctrl+Alt+W` |

---

## 13. Handling Large Files

MarkWeave handles large files gracefully:

- **Over 50 KB**: Processing is deferred after the UI paint (no input latency impact)
- **Over 3 MB**: Automatically switches to Source mode to bypass WYSIWYG parsing

For typical technical articles (a few dozen KB), you won't need to think about this.

---

## 14. Advanced FAQ

**Q. How do I enable Backlinks or Tag View?**
Go to Settings (`Ctrl+,`) → Plugins tab and enable the desired feature. They are hidden by default.

**Q. How do I use the Git panel?**
Open a folder as a workspace in an environment where Git is installed, then enable Git Panel under Settings → Plugins.

**Q. Is there a shortcut for Pomodoro or Word Sprint?**
Not currently. Start them from the status bar icons at the bottom of the screen.

**Q. Can I sync files to the cloud?**
MarkWeave does not have built-in cloud sync. Use it alongside OS-level sync tools like Dropbox, OneDrive, or iCloud.

**Q. Can I handle large files?**
Yes. Files over 3 MB automatically switch to Source mode.

**Q. Word/EPUB export is failing.**
Word (.docx), LaTeX, and EPUB export require Pandoc. Install it from [pandoc.org](https://pandoc.org/installing.html).
