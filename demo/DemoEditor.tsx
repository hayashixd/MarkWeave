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

const PRESET_HTML_JA = `<h1>Rust で作る HTTP サーバー</h1>
<p>今日は <strong>Tokio</strong> と <em>Hyper</em> を使って、シンプルな HTTP サーバーを構築してみましょう。</p>
<h2>セットアップ</h2>
<p><code>Cargo.toml</code> に依存関係を追加します:</p>
<pre><code class="language-toml">[dependencies]
tokio = { version = "1", features = ["full"] }
hyper = { version = "1", features = ["full"] }</code></pre>
<h2>基本実装</h2>
<pre><code class="language-rust">use hyper::{Request, Response, Body};
use std::convert::Infallible;

async fn handle(_req: Request&lt;Body&gt;) -&gt; Result&lt;Response&lt;Body&gt;, Infallible&gt; {
    Ok(Response::new("Hello, MarkWeave!".into()))
}</code></pre>
<h2>チェックリスト</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked /><div><p>プロジェクトの初期化</p></div></label></li>
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked /><div><p>依存関係の追加</p></div></label></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><div><p>ルーティングの実装</p></div></label></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><div><p>エラーハンドリング</p></div></label></li>
</ul>
<blockquote><p><strong>ヒント:</strong> 行頭で <code>/</code> を入力するとコマンドメニューが開きます。試してみてください！</p></blockquote>`;

const PRESET_HTML_EN = `<h1>Building an HTTP Server in Rust</h1>
<p>Today we'll build a simple HTTP server using <strong>Tokio</strong> and <em>Hyper</em>.</p>
<h2>Setup</h2>
<p>Add dependencies to <code>Cargo.toml</code>:</p>
<pre><code class="language-toml">[dependencies]
tokio = { version = "1", features = ["full"] }
hyper = { version = "1", features = ["full"] }</code></pre>
<h2>Basic Implementation</h2>
<pre><code class="language-rust">use hyper::{Request, Response, Body};
use std::convert::Infallible;

async fn handle(_req: Request&lt;Body&gt;) -&gt; Result&lt;Response&lt;Body&gt;, Infallible&gt; {
    Ok(Response::new("Hello, MarkWeave!".into()))
}</code></pre>
<h2>Checklist</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked /><div><p>Initialize project</p></div></label></li>
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked /><div><p>Add dependencies</p></div></label></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><div><p>Implement routing</p></div></label></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><div><p>Error handling</p></div></label></li>
</ul>
<blockquote><p><strong>Tip:</strong> Type <code>/</code> at the start of a line to open the command menu!</p></blockquote>`;

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
