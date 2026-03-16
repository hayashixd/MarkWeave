# Advanced Features Guide

For basic usage, see [user-manual.en.md](./user-manual.en.md).
This guide covers advanced features for power users.

---

## 1. Focus Writing Modes

### Zen Mode

**View → Zen Mode** (`F11`)

Hides the sidebar, toolbar, and status bar to let you focus entirely on writing.

### Focus Mode

**View → Focus Mode**

Highlights only the paragraph you are currently editing, graying out surrounding text.

### Typewriter Mode

**View → Typewriter Mode**

Keeps the cursor line centered on screen at all times. Ideal for long-form writing.

---

## 2. Writing Tools

### Pomodoro Timer

**Tools → Pomodoro**

Manages your writing time in 25-minute work + 5-minute break cycles.

### Word Sprint

**Tools → Word Sprint**

A challenge mode where you aim to hit a target word count within a time limit (e.g. 10 minutes).

---

## 3. Document Statistics

The status bar displays the following in real time:

- Character count / Word count
- Estimated reading time
- Readability score

---

## 4. Theme Switching

Choose a light, dark, or custom theme from **View → Theme**.

---

## 5. Workspace (Folder Management)

Open a folder as a workspace via **File → Open Folder**:

- A file tree appears in the left sidebar
- You can create, delete, and rename files within the folder
- Use Quick Open (`Ctrl+P`) to quickly open files in the workspace

**External change detection**: If a file is modified externally (e.g. by Dropbox or OneDrive), MarkWeave will notify you rather than silently overwriting your changes.

---

## 6. AI Features

### AI Copy

Click the **[AI Copy]** button in the toolbar to copy the current document to your clipboard, reformatted for AI input.
Fix heading levels, add language tags to code blocks, and remove excess blank lines — all automatically.
Paste directly into Claude or ChatGPT for review or improvement.

### AI Templates

Select from purpose-built prompt templates in the **AI Templates** tab in the sidebar:

- Blog article outline
- Code explanation
- Code review request
- Summary / Rewrite

---

## 7. Full Keyboard Shortcut Reference

### File Operations

| Action | Shortcut |
|--------|----------|
| New file | `Ctrl+N` |
| Open file | `Ctrl+O` |
| Save | `Ctrl+S` |
| Save as | `Ctrl+Shift+S` |
| Quick open | `Ctrl+P` |

### Editing

| Action | Shortcut |
|--------|----------|
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Y` |
| Search | `Ctrl+F` |
| Search & Replace | `Ctrl+H` |
| Jump to line | `Ctrl+G` |
| Bold | `Ctrl+B` |
| Italic | `Ctrl+I` |

### View & Other

| Action | Shortcut |
|--------|----------|
| Settings | `Ctrl+,` |
| Zen mode | `F11` |

---

## 8. Handling Large Files

MarkWeave handles large files gracefully:

- **Over 50 KB**: Processing is deferred until after the UI paint
- **Over 3 MB**: Automatically switches to Source mode (bypasses WYSIWYG parsing for speed)

For typical technical articles (a few dozen KB), you won't need to think about this.

---

## 9. Advanced FAQ

**Q. Can I handle large files?**
Yes. Files over 3 MB automatically switch to Source mode.

**Q. Can I sync files to the cloud?**
MarkWeave does not have built-in cloud sync. Use it alongside OS-level file sync tools like iCloud, Dropbox, or OneDrive.
