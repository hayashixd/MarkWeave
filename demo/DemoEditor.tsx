/**
 * DemoEditor — Tauri 非依存のインタラクティブエディタ（デモページ用）
 *
 * TipTap を使った WYSIWYG エディタのブラウザ版デモ。
 * Tauri / Zustand に一切依存しない。
 * スラッシュコマンド・テーマ切り替え・ツールバーを含む。
 */
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { common, createLowlight } from 'lowlight';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { useState, useCallback, useEffect } from 'react';
import { DemoSlashMenu } from './DemoSlashMenu';

// ── 型定義 ────────────────────────────────────────────────────

export interface SlashCommandState {
  active: boolean;
  query: string;
  from: number;
  coords: { top: number; left: number; bottom: number } | null;
}

const INITIAL_SLASH_STATE: SlashCommandState = {
  active: false, query: '', from: -1, coords: null,
};

// ── SlashCommandsExtension（デモ用・Tauri非依存） ─────────────
// src/extensions/SlashCommandsExtension.ts のロジックを移植

const slashPluginKey = new PluginKey<SlashCommandState>('demoSlashCommands');

function createSlashCommandsExtension(
  onStateChange: (state: SlashCommandState) => void,
) {
  return Extension.create({
    name: 'demoSlashCommands',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: slashPluginKey,
          state: {
            init: () => INITIAL_SLASH_STATE,
            apply(tr, prev): SlashCommandState {
              const meta = tr.getMeta(slashPluginKey) as SlashCommandState | null;
              if (meta != null) return meta;
              if (tr.docChanged && prev.active) {
                return { ...prev, from: tr.mapping.map(prev.from) };
              }
              return prev;
            },
          },
          props: {
            handleKeyDown(view, event) {
              const state = slashPluginKey.getState(view.state);
              if (!state?.active) return false;

              if (event.key === 'Escape') {
                view.dispatch(view.state.tr.setMeta(slashPluginKey, INITIAL_SLASH_STATE));
                onStateChange(INITIAL_SLASH_STATE);
                return true;
              }

              // IME変換中はガード（CLAUDE.md 制約）
              if (event.isComposing || event.keyCode === 229) return false;

              if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab'].includes(event.key)) {
                window.dispatchEvent(
                  new CustomEvent('slash-commands-key', { detail: { key: event.key } })
                );
                if (event.key !== 'Tab') {
                  event.preventDefault();
                  return true;
                }
                return true;
              }

              if (event.key === 'Backspace') {
                const { from: slashFrom } = state;
                const to = view.state.selection.from;
                setTimeout(() => {
                  const cur = slashPluginKey.getState(view.state);
                  if (!cur?.active) return;
                  const newTo = view.state.selection.from;
                  if (newTo <= slashFrom) {
                    view.dispatch(view.state.tr.setMeta(slashPluginKey, INITIAL_SLASH_STATE));
                    onStateChange(INITIAL_SLASH_STATE);
                    return;
                  }
                  const slice = view.state.doc.textBetween(slashFrom, newTo, '');
                  if (!slice.startsWith('/')) {
                    view.dispatch(view.state.tr.setMeta(slashPluginKey, INITIAL_SLASH_STATE));
                    onStateChange(INITIAL_SLASH_STATE);
                    return;
                  }
                  const coords = view.coordsAtPos(newTo);
                  const next = { ...cur, query: slice.slice(1), coords: { top: coords.top, left: coords.left, bottom: coords.bottom } };
                  view.dispatch(view.state.tr.setMeta(slashPluginKey, next));
                  onStateChange(next);
                }, 0);
                return false;
              }
              return false;
            },

            handleTextInput(view, _from, _to, text) {
              const { state } = view;
              const sel = state.selection as { $cursor?: { parent: { type: { name: string }; textContent: string }; parentOffset: number } };
              if (!sel.$cursor) return false;

              const pluginState = slashPluginKey.getState(state);

              if (!pluginState?.active) {
                if (text === '/') {
                  const isAtStart = sel.$cursor.parentOffset === 0;
                  const isParagraph = sel.$cursor.parent.type.name === 'paragraph';
                  const isEmpty = isParagraph && sel.$cursor.parent.textContent === '';
                  if (isAtStart || isEmpty) {
                    setTimeout(() => {
                      const coords = view.coordsAtPos(view.state.selection.from);
                      const next: SlashCommandState = {
                        active: true, query: '',
                        from: view.state.selection.from - 1,
                        coords: { top: coords.top, left: coords.left, bottom: coords.bottom },
                      };
                      view.dispatch(view.state.tr.setMeta(slashPluginKey, next));
                      onStateChange(next);
                    }, 0);
                  }
                }
                return false;
              }

              setTimeout(() => {
                const cur = slashPluginKey.getState(view.state);
                if (!cur?.active) return;
                const { from: sf } = cur;
                const to2 = view.state.selection.from;
                const slice = view.state.doc.textBetween(sf, to2, '');
                if (!slice.startsWith('/')) {
                  view.dispatch(view.state.tr.setMeta(slashPluginKey, INITIAL_SLASH_STATE));
                  onStateChange(INITIAL_SLASH_STATE);
                  return;
                }
                const coords = view.coordsAtPos(to2);
                const next = {
                  ...cur, query: slice.slice(1),
                  coords: { top: coords.top, left: coords.left, bottom: coords.bottom },
                };
                view.dispatch(view.state.tr.setMeta(slashPluginKey, next));
                onStateChange(next);
              }, 0);
              return false;
            },
          },
        }),
      ];
    },
  });
}

// ── プリセットコンテンツ ───────────────────────────────────────

const PRESET_HTML_JA = `<h1>技術記事を速く・楽しく書く3つのコツ</h1>
<p><strong>「ネタはあるのに、なかなか書けない」</strong> ——そんな経験はありませんか？<em>書く環境</em>を整えるだけで、アウトプットの速さと質は大きく変わります。</p>
<h2>① 書く前に構成を1行で決める</h2>
<p>記事を開く前に、<code>1文で言えること</code> をメモします。言えないなら、まだ整理が足りないサインです。</p>
<h2>② Markdown の記法を「見ないで書く」</h2>
<p>WYSIWYG エディタなら、<strong># を打つだけで見出しに変わります</strong>。記法を覚える必要がなく、<em>書くことだけ</em>に集中できます。</p>
<pre><code class="language-markdown"># 記事タイトル

## はじめに（なぜ書くのか）
## 本論（具体的な内容）
## まとめ（読者へのアクション）</code></pre>
<h2>公開前チェックリスト</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked /><div><p>タイトルに数字か具体性を入れた</p></div></label></li>
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked /><div><p>導入文で「誰向けか」を明示した</p></div></label></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><div><p>コードブロックの動作を確認した</p></div></label></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><div><p>Zenn / Qiita 向けにエクスポートした</p></div></label></li>
</ul>
<blockquote><p><strong>試してみよう:</strong> 行頭で <code>/</code> を入力するとコマンドメニューが開きます。見出し・リスト・テーブルをキーボードだけで挿入できます。</p></blockquote>`;

const PRESET_HTML_EN = `<h1>3 Tips for Writing Tech Articles Faster</h1>
<p><strong>"I have ideas, but I just can't get them written"</strong> — sound familiar? Setting up the <em>right writing environment</em> can dramatically improve both your speed and quality.</p>
<h2>① Decide your structure in one sentence first</h2>
<p>Before you open your editor, write down <code>what you want to say in one line</code>. If you can't, it means you're still organising your thoughts.</p>
<h2>② Write Markdown without thinking about syntax</h2>
<p>With a WYSIWYG editor, <strong>typing # instantly becomes a heading</strong>. No need to memorise syntax — you can focus entirely on <em>writing</em>.</p>
<pre><code class="language-markdown"># Article Title

## Introduction (why you're writing this)
## Main Content (the actual details)
## Wrap-up (action for the reader)</code></pre>
<h2>Pre-publish checklist</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked /><div><p>Title includes a number or concrete detail</p></div></label></li>
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked /><div><p>Introduction says clearly who this is for</p></div></label></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><div><p>Verified all code blocks run correctly</p></div></label></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><div><p>Exported for Zenn / dev.to / Hashnode</p></div></label></li>
</ul>
<blockquote><p><strong>Try it:</strong> Type <code>/</code> at the start of a line to open the command menu — insert headings, lists, and tables with just your keyboard.</p></blockquote>`;

// ── エディタコンポーネント ─────────────────────────────────────

interface DemoEditorProps {
  lang: 'ja' | 'en';
  t: (key: string) => string;
  downloadUrl: string;
}

const lowlight = createLowlight(common);

export function DemoEditor({ lang, t, downloadUrl }: DemoEditorProps) {
  const [slashState, setSlashState] = useState<SlashCommandState>(INITIAL_SLASH_STATE);

  const SlashExt = useCallback(
    () => createSlashCommandsExtension(setSlashState),
    []
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // CodeBlockLowlight で上書き
        link: false,      // Link を個別設定するため StarterKit 組み込みを無効化
      }),
      CodeBlockLowlight.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({
        placeholder: lang === 'en'
          ? 'Start writing… or type / for commands'
          : '書き始めましょう… または / でコマンドを呼び出せます',
      }),
      SlashExt(),
    ],
    content: lang === 'en' ? PRESET_HTML_EN : PRESET_HTML_JA,
    editorProps: {
      attributes: { class: 'demo-prosemirror' },
    },
  });

  // 言語切り替え時にプリセットコンテンツを差し替える
  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(lang === 'en' ? PRESET_HTML_EN : PRESET_HTML_JA);
  }, [lang, editor]);

  const closeSlash = useCallback(() => setSlashState(INITIAL_SLASH_STATE), []);

  if (!editor) return null;

  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor.isActive(name, attrs) ? ' is-active' : '';

  return (
    <div className="demo-editor-wrapper">
      {/* ── ツールバー ── */}
      <div className="demo-toolbar">
        <button
          className={`toolbar-btn${isActive('bold')}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
          title="Bold (Ctrl+B)"
        >B</button>
        <button
          className={`toolbar-btn${isActive('italic')}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
          title="Italic (Ctrl+I)"
        ><em>I</em></button>
        <button
          className={`toolbar-btn${isActive('strike')}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
          title="Strikethrough"
        ><s>S</s></button>
        <button
          className={`toolbar-btn${isActive('code')}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }}
          title="Inline code"
        >{'\`'}</button>

        <div className="toolbar-sep" />

        <button
          className={`toolbar-btn${isActive('heading', { level: 1 })}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }}
          title="Heading 1 (Ctrl+1)"
        >H1</button>
        <button
          className={`toolbar-btn${isActive('heading', { level: 2 })}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}
          title="Heading 2 (Ctrl+2)"
        >H2</button>
        <button
          className={`toolbar-btn${isActive('heading', { level: 3 })}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }}
          title="Heading 3 (Ctrl+3)"
        >H3</button>

        <div className="toolbar-sep" />

        <button
          className={`toolbar-btn${isActive('bulletList')}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
          title="Bullet list"
        >≡</button>
        <button
          className={`toolbar-btn${isActive('orderedList')}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
          title="Ordered list"
        >1.</button>
        <button
          className={`toolbar-btn${isActive('taskList')}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleTaskList().run(); }}
          title="Task list"
        >☑</button>
        <button
          className={`toolbar-btn${isActive('codeBlock')}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCodeBlock().run(); }}
          title="Code block"
        >{'</>'}</button>
        <button
          className="toolbar-btn"
          onMouseDown={e => {
            e.preventDefault();
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
          }}
          title="Insert table"
        >⊞</button>

        {/* ── ロック済みエクスポートボタン ── */}
        <div className="toolbar-locked" title={t('toolbar.lockedTitle')}>
          🔒 {t('toolbar.export')}
          <a className="toolbar-locked-link" href={downloadUrl}>
            {t('toolbar.lockedLink')} →
          </a>
        </div>
      </div>

      {/* ── エディタ本体 ── */}
      <div className="demo-editor-content">
        <EditorContent editor={editor} />
      </div>

      {/* ── ヒントバー ── */}
      <div className="demo-editor-hint">
        <span className="hint-item">
          <span className="hint-key">/</span> {t('hint.slash')}
        </span>
        <span className="hint-item">
          <span className="hint-key"># </span> {t('hint.heading')}
        </span>
        <span className="hint-item">
          <span className="hint-key">**text**</span> {t('hint.bold')}
        </span>
        <span className="hint-item">
          <span className="hint-key">- </span> {t('hint.list')}
        </span>
      </div>

      {/* ── スラッシュコマンドメニュー ── */}
      {slashState.active && editor && (
        <DemoSlashMenu
          state={slashState}
          editor={editor}
          lang={lang}
          onClose={closeSlash}
        />
      )}
    </div>
  );
}
