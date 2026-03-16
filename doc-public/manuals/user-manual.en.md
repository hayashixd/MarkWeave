# MarkWeave User Guide

A guide to writing technical articles in Markdown and publishing to Zenn, Qiita, dev.to, and more.

> **For Zen mode, AI features, workspace management, and other advanced features** → [advanced.en.md](./advanced.en.md)

---

## 1. Getting Started (3 Steps)

### Step 1: Open a File

Press `Ctrl+O` or go to **File → Open** to select a `.md` file.
Create a new file with **File → New** (`Ctrl+N`).

### Step 2: Write Your Article

MarkWeave is a **WYSIWYG editor**. Markdown syntax is automatically rendered as you type.

| Action | How |
|--------|-----|
| Heading | Type `# `, `## `, or `### ` |
| Bold | `Ctrl+B` or select text and use toolbar |
| Italic | `Ctrl+I` |
| Inline code | Wrap with backticks |
| Code block | ` ``` ` + language name (e.g. ` ```typescript `) |
| List | Type `- ` or `1. ` |
| Quote | Type `> ` |

Switch display modes in the top-right corner:

- **WYSIWYG mode** (default): Formatted display while you write
- **Source mode**: Edit raw Markdown directly
- **Split mode**: Side-by-side editing and preview

### Step 3: Save & Export

- Save: `Ctrl+S`
- Markdown export for Zenn / Qiita: **File → Export → Markdown**

---

## 2. Code Blocks

Specify a language to enable syntax highlighting.

```` ```typescript ````
```typescript
const greeting = "Hello, World!";
```
```` ``` ````

Supports TypeScript, Python, Go, Rust, JavaScript, Shell, and many more major languages.

---

## 3. Tables

Tables can be managed with the GUI — no need to write pipe syntax manually.

- **Insert**: Click the "Table" icon in the toolbar
- **Move between cells**: `Tab` / `Shift+Tab`
- **Add/delete rows and columns**: Right-click context menu on a cell
- **Reorder**: Drag and drop rows/columns
- **Column width**: Drag to resize

---

## 4. Math & Mermaid Diagrams

- **Math (KaTeX)**: `$...$` (inline) or `$$...$$` (block)
- **Mermaid diagrams**: Write syntax inside a ` ```mermaid ` block for real-time rendering

---

## 5. YAML Front Matter (Article Metadata)

You can edit the `---` block at the top of a file via GUI.
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

## 6. Export

Choose a format from **File → Export**:

| Format | Use case |
|--------|----------|
| **Markdown** | For posting to Zenn / Qiita / dev.to (platform-optimized) |
| HTML | Standalone HTML (images embedded as Base64) |
| PDF | For printing or distribution |
| Word / EPUB | Via Pandoc integration |

---

## 7. Multiple Files in Tabs

You can open and edit multiple `.md` files in tabs simultaneously.
Click a tab to switch, and click `×` to close.

---

## 8. Common Shortcuts

| Action | Shortcut |
|--------|----------|
| Open file | `Ctrl+O` |
| Save | `Ctrl+S` |
| Bold | `Ctrl+B` |
| Italic | `Ctrl+I` |
| Search | `Ctrl+F` |
| Quick open | `Ctrl+P` |
| Settings | `Ctrl+,` |
| Undo | `Ctrl+Z` |

---

## 9. FAQ

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

---

## System Requirements

| OS | Support |
|----|---------|
| Windows | ✅ (v0.9.0+) |
| Linux | ✅ (v0.9.0+) |
| macOS | ❌ Planned for future |

---

**Advanced features (Zen mode, AI features, workspace, Pomodoro, full shortcut reference, etc.)** → [advanced.en.md](./advanced.en.md)
