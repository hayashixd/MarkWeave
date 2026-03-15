/**
 * スニペットをスラッシュコマンド定義に変換するヘルパー。
 */

import type { SlashCommandDef } from '../components/SlashCommands/slash-command-definitions';
import type { Snippet } from '../store/snippetStore';

/**
 * 登録済みスニペット配列をスラッシュコマンド定義配列に変換する。
 * スラッシュコマンドメニューに動的に追加して表示するために使用。
 */
export function snippetsToCommands(snippets: Snippet[]): SlashCommandDef[] {
  return snippets.map((snippet) => ({
    id: `snippet-${snippet.id}`,
    category: 'snippet' as const,
    name: snippet.name,
    keywords: `snippet スニペット ${snippet.keywords}`,
    description: snippet.content.length > 40
      ? snippet.content.slice(0, 40) + '…'
      : snippet.content,
    icon: '📌',
    action: (editor) => {
      editor.chain().focus().insertContent(snippet.content).run();
    },
  }));
}
