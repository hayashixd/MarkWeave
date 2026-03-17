/**
 * DemoSlashMenu — スラッシュコマンドメニュー（デモ用）
 *
 * SlashCommandsExtension からの状態を受け取り、
 * コマンドリストを表示してキーボード・マウス操作で選択・実行する。
 * isComposing ガード済み（CLAUDE.md 制約）。
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import type { SlashCommandState } from './DemoEditor';

// ── コマンド定義 ─────────────────────────────────────────────

interface SlashCommand {
  id: string;
  group: string;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  keywords: string[];
  execute: (editor: Editor, from: number) => void;
}

function makeCommands(): SlashCommand[] {
  return [
    {
      id: 'h1', group: '見出し', label: '見出し 1', labelEn: 'Heading 1',
      description: '大きな見出し', descriptionEn: 'Big section heading',
      icon: 'H1', keywords: ['h1', 'heading', 'heading1', '見出し'],
      execute: (editor, from) => {
        const to = editor.state.selection.from;
        editor.chain().focus().deleteRange({ from, to }).setNode('heading', { level: 1 }).run();
      },
    },
    {
      id: 'h2', group: '見出し', label: '見出し 2', labelEn: 'Heading 2',
      description: '中サイズの見出し', descriptionEn: 'Medium section heading',
      icon: 'H2', keywords: ['h2', 'heading', 'heading2', '見出し'],
      execute: (editor, from) => {
        const to = editor.state.selection.from;
        editor.chain().focus().deleteRange({ from, to }).setNode('heading', { level: 2 }).run();
      },
    },
    {
      id: 'h3', group: '見出し', label: '見出し 3', labelEn: 'Heading 3',
      description: '小さな見出し', descriptionEn: 'Small section heading',
      icon: 'H3', keywords: ['h3', 'heading', 'heading3', '見出し'],
      execute: (editor, from) => {
        const to = editor.state.selection.from;
        editor.chain().focus().deleteRange({ from, to }).setNode('heading', { level: 3 }).run();
      },
    },
    {
      id: 'bullet', group: 'リスト', label: '箇条書きリスト', labelEn: 'Bullet List',
      description: '・ リスト', descriptionEn: 'Unordered list',
      icon: '·', keywords: ['bullet', 'list', 'ul', 'リスト', '箇条書き'],
      execute: (editor, from) => {
        const to = editor.state.selection.from;
        editor.chain().focus().deleteRange({ from, to }).toggleBulletList().run();
      },
    },
    {
      id: 'ordered', group: 'リスト', label: '番号付きリスト', labelEn: 'Numbered List',
      description: '1. リスト', descriptionEn: 'Ordered list',
      icon: '1.', keywords: ['ordered', 'list', 'ol', '番号', 'リスト'],
      execute: (editor, from) => {
        const to = editor.state.selection.from;
        editor.chain().focus().deleteRange({ from, to }).toggleOrderedList().run();
      },
    },
    {
      id: 'task', group: 'リスト', label: 'タスクリスト', labelEn: 'Task List',
      description: 'チェックボックス付き', descriptionEn: 'Checklist with checkboxes',
      icon: '☑', keywords: ['task', 'todo', 'check', 'タスク', 'チェック'],
      execute: (editor, from) => {
        const to = editor.state.selection.from;
        editor.chain().focus().deleteRange({ from, to }).toggleTaskList().run();
      },
    },
    {
      id: 'code', group: 'ブロック', label: 'コードブロック', labelEn: 'Code Block',
      description: 'シンタックスハイライト付き', descriptionEn: 'With syntax highlighting',
      icon: '</>', keywords: ['code', 'codeblock', 'コード', 'プログラム'],
      execute: (editor, from) => {
        const to = editor.state.selection.from;
        editor.chain().focus().deleteRange({ from, to }).toggleCodeBlock().run();
      },
    },
    {
      id: 'quote', group: 'ブロック', label: '引用ブロック', labelEn: 'Blockquote',
      description: '引用・注記', descriptionEn: 'Quote or callout',
      icon: '"', keywords: ['quote', 'blockquote', '引用'],
      execute: (editor, from) => {
        const to = editor.state.selection.from;
        editor.chain().focus().deleteRange({ from, to }).toggleBlockquote().run();
      },
    },
    {
      id: 'table', group: 'ブロック', label: 'テーブル', labelEn: 'Table',
      description: '3×3 の表を挿入', descriptionEn: 'Insert a 3×3 table',
      icon: '⊞', keywords: ['table', 'テーブル', '表', 'grid'],
      execute: (editor, from) => {
        const to = editor.state.selection.from;
        editor.chain().focus().deleteRange({ from, to })
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      },
    },
    {
      id: 'hr', group: 'ブロック', label: '区切り線', labelEn: 'Divider',
      description: '水平線', descriptionEn: 'Horizontal rule',
      icon: '―', keywords: ['hr', 'divider', 'rule', '区切り', '水平線'],
      execute: (editor, from) => {
        const to = editor.state.selection.from;
        editor.chain().focus().deleteRange({ from, to }).setHorizontalRule().run();
      },
    },
  ];
}

// ── コンポーネント ────────────────────────────────────────────

interface DemoSlashMenuProps {
  state: SlashCommandState;
  editor: Editor;
  lang: 'ja' | 'en';
  onClose: () => void;
}

export function DemoSlashMenu({ state, editor, lang, onClose }: DemoSlashMenuProps) {
  const allCommands = makeCommands();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = allCommands.filter(cmd => {
    if (!state.query) return true;
    const q = state.query.toLowerCase();
    return cmd.keywords.some(k => k.includes(q)) ||
      cmd.label.toLowerCase().includes(q) ||
      cmd.labelEn.toLowerCase().includes(q);
  });

  // クエリが変わったら選択をリセット
  useEffect(() => { setSelectedIndex(0); }, [state.query]);

  const executeSelected = useCallback((index: number) => {
    const cmd = filtered[index];
    if (!cmd) return;
    cmd.execute(editor, state.from);
    onClose();
  }, [filtered, editor, state.from, onClose]);

  // slash-commands-key イベントを受け取りキーボードナビゲーション
  useEffect(() => {
    const handler = (e: Event) => {
      const { key } = (e as CustomEvent<{ key: string }>).detail;
      if (key === 'ArrowDown') {
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
      } else if (key === 'ArrowUp') {
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (key === 'Enter') {
        executeSelected(selectedIndex);
      } else if (key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('slash-commands-key', handler);
    return () => window.removeEventListener('slash-commands-key', handler);
  }, [filtered.length, selectedIndex, executeSelected, onClose]);

  if (filtered.length === 0 || !state.coords) return null;

  // メニューを画面内に収める位置計算
  const menuTop = Math.min(state.coords.bottom + 4, window.innerHeight - 340);
  const menuLeft = Math.min(state.coords.left, window.innerWidth - 240);

  // グループ別に分類
  const groups = filtered.reduce<Record<string, SlashCommand[]>>((acc, cmd) => {
    const g = lang === 'en' ? (cmd.group === '見出し' ? 'Heading' : cmd.group === 'リスト' ? 'List' : 'Block') : cmd.group;
    acc[g] = acc[g] ?? [];
    acc[g].push(cmd);
    return acc;
  }, {});

  let globalIdx = 0;

  return (
    <div
      className="slash-menu"
      style={{ top: menuTop, left: menuLeft }}
      onMouseDown={e => e.preventDefault()} // フォーカス喪失を防ぐ
    >
      {Object.entries(groups).map(([groupName, cmds]) => (
        <div key={groupName}>
          <div className="slash-group-label">{groupName}</div>
          {cmds.map(cmd => {
            const idx = globalIdx++;
            return (
              <div
                key={cmd.id}
                className={`slash-item${idx === selectedIndex ? ' selected' : ''}`}
                onMouseEnter={() => setSelectedIndex(idx)}
                onMouseDown={() => executeSelected(idx)}
              >
                <div className="slash-icon">{cmd.icon}</div>
                <div className="slash-text">
                  <div className="slash-title">{lang === 'en' ? cmd.labelEn : cmd.label}</div>
                  <div className="slash-subtitle">{lang === 'en' ? cmd.descriptionEn : cmd.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
