# MarkWeave Quick Start Guide

A guide to writing articles in Markdown and publishing to Zenn, Qiita, dev.to, and more.

> **For Zen mode, AI features, workspace management, Pomodoro, sidebar panels, full shortcuts, and more** → [advanced.en.md](./advanced.en.md)

---

## 1. Getting Started (3 Steps)

### Step 1: Open a File

Press `Ctrl+O` or go to **File → Open...** to select a `.md` file.
Create a new file with **File → New File** (`Ctrl+N`).

To quickly reopen recent files, use **File → Recent Files...**

### Step 2: Write Your Article

MarkWeave is a **WYSIWYG editor**. Markdown syntax is automatically rendered as you type.

| Action | How |
|--------|-----|
| Heading | Type `# `, `## `, `### ` (H1–H6) |
| Bold | `Ctrl+B` or select text and use toolbar |
| Italic | `Ctrl+I` |
| Inline code | Wrap with backticks |
| Code block | ` ``` ` + language name (e.g. ` ```typescript `) |
| List | Type `- ` or `1. ` |
| Quote | Type `> ` |
| Slash commands | Type `/` to open command menu |

**Switch display modes:**

- **WYSIWYG mode** (default): Formatted display while you write
- **Source mode**: Edit raw Markdown directly (`Ctrl+/`)
- **Split mode**: Side-by-side editing and preview (`Ctrl+\`)

### Step 3: Save & Export

- Save: `Ctrl+S`
- Save As: `Ctrl+Shift+S`
- Export Markdown for Zenn / Qiita: **File → Save As → Save as Markdown...** (`Ctrl+Shift+M`)

---

## 2. Text Formatting

| Format | Shortcut / Syntax |
|--------|-------------------|
| **Bold** | `Ctrl+B` or `**text**` |
| *Italic* | `Ctrl+I` or `*text*` |
| ~~Strikethrough~~ | `~~text~~` |
| `Inline code` | Wrap with backticks |
| Link | `Ctrl+K` or `[text](URL)` |

---

## 3. Code Blocks

Specify a language to enable syntax highlighting.

```` ```typescript ````
```typescript
const greeting = "Hello, World!";
```
```` ``` ````

Supports TypeScript, Python, Go, Rust, JavaScript, Shell, and many more.

---

## 4. Tables

Tables can be managed with the GUI — no need to write pipe syntax manually.

- **Insert**: Type `/table` in the slash command menu, or use the toolbar
- **Move between cells**: `Tab` / `Shift+Tab`
- **Add/delete rows and columns**: Right-click context menu on a cell
- **Reorder**: Drag and drop rows/columns
- **Column width**: Drag to resize

---

## 5. Math & Mermaid Diagrams

- **Math (KaTeX)**: `$...$` (inline) or `$$...$$` (block)
- **Mermaid diagrams**: Write syntax inside a ` ```mermaid ` block for real-time rendering

---

## 6. YAML Front Matter (Article Metadata)

You can edit the `---` block at the top of a file via GUI. Click the FM bar at the top of the editor to expand it.
Useful for managing titles, tags, and publish settings for Zenn and Qiita.

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

## 7. Export

Choose a format from **File → Export**:

| Format | Use case |
|--------|----------|
| **HTML** | Standalone HTML (images embedded as Base64) |
| **PDF** | For printing or distribution |
| **Save as Markdown** | For posting to Zenn / Qiita / dev.to (`Ctrl+Shift+M`) |
| Word / EPUB | Via Pandoc integration (Pandoc required) |

---

## 8. Multiple Files in Tabs

You can open and edit multiple `.md` files in tabs simultaneously.
Click a tab to switch, click `×` to close.

---

## 9. Common Shortcuts

| Action | Shortcut |
|--------|----------|
| Open file | `Ctrl+O` |
| Save | `Ctrl+S` |
| Bold | `Ctrl+B` |
| Italic | `Ctrl+I` |
| Insert link | `Ctrl+K` |
| Search | `Ctrl+F` |
| Find & Replace | `Ctrl+H` |
| Quick open | `Ctrl+P` |
| Toggle source mode | `Ctrl+/` |
| Settings | `Ctrl+,` |
| Undo | `Ctrl+Z` |

---

## 10. FAQ

**Q. Does it work offline?**
Yes. MarkWeave is centered around local files. No internet connection is required (except for AI features).

**Q. Can I open existing Markdown files as-is?**
Yes. You can open and edit existing `.md` files directly.

**Q. Can I use it without knowing Markdown syntax?**
Yes. In WYSIWYG mode, you can use the toolbar for all formatting.

**Q. SmartScreen warning appears on Windows.**
The app is currently not Authenticode-signed, so a warning appears. Click "More info → Run anyway" to proceed.

**Q. Is macOS supported?**
Currently Windows and Linux only. macOS support is planned for the future.

**Q. What happens if a file is modified by an external tool (Dropbox, etc.)?**
MarkWeave never overwrites automatically. You'll be prompted to choose between keeping the editor content or reloading from disk.

---

## System Requirements

| OS | Support |
|----|---------|
| Windows | ✅ (v0.9.0+) |
| Linux | ✅ (v0.9.0+) |
| macOS | ❌ Planned for future |

---

**Advanced features (Zen mode, AI features, workspace, Pomodoro, sidebar panels, full shortcuts, etc.)** → [advanced.en.md](./advanced.en.md)
