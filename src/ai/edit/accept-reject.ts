import type { Editor } from '@tiptap/core';
import { markdownToTipTap } from '../../lib/markdown-to-tiptap';

export function acceptAiEdit(
  editor: Editor,
  from: number,
  to: number,
  aiOutputMarkdown: string,
): void {
  const doc = markdownToTipTap(aiOutputMarkdown);
  editor
    .chain()
    .focus()
    .deleteRange({ from, to })
    .insertContentAt(from, doc.content ?? [])
    .run();
}

export function acceptAiContinue(
  editor: Editor,
  position: number,
  aiOutputMarkdown: string,
): void {
  const doc = markdownToTipTap(aiOutputMarkdown);
  editor
    .chain()
    .focus()
    .insertContentAt(position, doc.content ?? [])
    .run();
}
