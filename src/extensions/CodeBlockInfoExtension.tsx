/**
 * CodeBlockInfoExtension.tsx
 *
 * コードブロックに言語バッジとランナー環境情報を表示する TipTap 拡張。
 * editor-ux-design.md §5.3 に準拠。
 *
 * - 言語バッジ: コードブロック上部に言語名を表示
 * - ランナー環境メモ: 実行環境のヒントを表示
 * - コピーボタン: ホバー時にコード内容をコピー
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/** 言語ごとのランナー情報 */
const LANGUAGE_RUNNERS: Record<string, { label: string; runner: string; icon: string }> = {
  javascript: { label: 'JavaScript', runner: 'Node.js / Browser', icon: 'JS' },
  js: { label: 'JavaScript', runner: 'Node.js / Browser', icon: 'JS' },
  typescript: { label: 'TypeScript', runner: 'tsc + Node.js', icon: 'TS' },
  ts: { label: 'TypeScript', runner: 'tsc + Node.js', icon: 'TS' },
  python: { label: 'Python', runner: 'Python 3.x', icon: 'PY' },
  py: { label: 'Python', runner: 'Python 3.x', icon: 'PY' },
  rust: { label: 'Rust', runner: 'cargo run', icon: 'RS' },
  rs: { label: 'Rust', runner: 'cargo run', icon: 'RS' },
  go: { label: 'Go', runner: 'go run', icon: 'GO' },
  java: { label: 'Java', runner: 'javac + java', icon: 'JV' },
  cpp: { label: 'C++', runner: 'g++ / clang++', icon: 'C++' },
  c: { label: 'C', runner: 'gcc / clang', icon: 'C' },
  csharp: { label: 'C#', runner: 'dotnet run', icon: 'C#' },
  cs: { label: 'C#', runner: 'dotnet run', icon: 'C#' },
  ruby: { label: 'Ruby', runner: 'ruby', icon: 'RB' },
  rb: { label: 'Ruby', runner: 'ruby', icon: 'RB' },
  php: { label: 'PHP', runner: 'php', icon: 'PHP' },
  swift: { label: 'Swift', runner: 'swift / swiftc', icon: 'SW' },
  kotlin: { label: 'Kotlin', runner: 'kotlinc', icon: 'KT' },
  dart: { label: 'Dart', runner: 'dart run', icon: 'DT' },
  bash: { label: 'Bash', runner: 'bash / sh', icon: 'SH' },
  sh: { label: 'Shell', runner: 'sh / bash', icon: 'SH' },
  zsh: { label: 'Zsh', runner: 'zsh', icon: 'ZSH' },
  powershell: { label: 'PowerShell', runner: 'pwsh', icon: 'PS' },
  sql: { label: 'SQL', runner: 'Database CLI', icon: 'SQL' },
  html: { label: 'HTML', runner: 'Browser', icon: 'HTM' },
  css: { label: 'CSS', runner: 'Browser', icon: 'CSS' },
  json: { label: 'JSON', runner: 'Data format', icon: '{}' },
  yaml: { label: 'YAML', runner: 'Data format', icon: 'YML' },
  yml: { label: 'YAML', runner: 'Data format', icon: 'YML' },
  toml: { label: 'TOML', runner: 'Data format', icon: 'TML' },
  xml: { label: 'XML', runner: 'Data format', icon: 'XML' },
  markdown: { label: 'Markdown', runner: 'Renderer', icon: 'MD' },
  md: { label: 'Markdown', runner: 'Renderer', icon: 'MD' },
  dockerfile: { label: 'Dockerfile', runner: 'docker build', icon: 'DKR' },
  makefile: { label: 'Makefile', runner: 'make', icon: 'MK' },
  lua: { label: 'Lua', runner: 'lua', icon: 'LUA' },
  r: { label: 'R', runner: 'Rscript', icon: 'R' },
  scala: { label: 'Scala', runner: 'scala / sbt', icon: 'SC' },
  elixir: { label: 'Elixir', runner: 'elixir / mix', icon: 'EX' },
  haskell: { label: 'Haskell', runner: 'ghc / runhaskell', icon: 'HS' },
  plaintext: { label: 'Plain Text', runner: '', icon: 'TXT' },
  text: { label: 'Plain Text', runner: '', icon: 'TXT' },
};

/**
 * 言語名からランナー情報を取得する。
 */
export function getLanguageInfo(language: string): { label: string; runner: string; icon: string } {
  const normalized = language.toLowerCase().trim();
  return LANGUAGE_RUNNERS[normalized] ?? {
    label: language || 'Plain Text',
    runner: '',
    icon: language.slice(0, 3).toUpperCase() || 'TXT',
  };
}

const codeBlockInfoKey = new PluginKey('codeBlockInfo');

/**
 * コードブロック補助 UI 拡張。
 * ProseMirror Decoration API でコードブロックに言語バッジを表示する。
 */
export const CodeBlockInfoExtension = Extension.create({
  name: 'codeBlockInfo',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: codeBlockInfoKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];

            state.doc.descendants((node, pos) => {
              if (node.type.name !== 'codeBlock') return;

              const language = (node.attrs.language as string) || '';
              const info = getLanguageInfo(language);

              // 言語バッジウィジェット
              const badgeWidget = Decoration.widget(pos, () => {
                const container = document.createElement('div');
                container.className = 'code-block-info';
                container.contentEditable = 'false';

                // 言語バッジ
                const badge = document.createElement('span');
                badge.className = 'code-block-info__badge';
                badge.textContent = info.label;
                badge.title = info.runner ? `実行環境: ${info.runner}` : '';
                container.appendChild(badge);

                // ランナー情報
                if (info.runner) {
                  const runner = document.createElement('span');
                  runner.className = 'code-block-info__runner';
                  runner.textContent = info.runner;
                  container.appendChild(runner);
                }

                // コピーボタン
                const copyBtn = document.createElement('button');
                copyBtn.className = 'code-block-info__copy';
                copyBtn.textContent = 'Copy';
                copyBtn.title = 'コードをコピー';
                copyBtn.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const codeText = node.textContent;
                  navigator.clipboard.writeText(codeText).then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => {
                      copyBtn.textContent = 'Copy';
                    }, 2000);
                  });
                });
                container.appendChild(copyBtn);

                return container;
              }, {
                side: -1, // コードブロックの前に配置
                key: `code-info-${pos}`,
              });

              decorations.push(badgeWidget);
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

export default CodeBlockInfoExtension;
