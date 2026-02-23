/**
 * index.ts
 *
 * 組み込みテンプレートをまとめてレジストリに登録するエントリポイント。
 * アプリ起動時に一度呼び出す。
 */

import { registerTemplate } from '../template-registry';

import { blogStructureTemplate } from './blog-structure';
import { codeExplanationTemplate } from './code-explanation';
import { codeReviewTemplate } from './code-review';
import { summarizationTemplate } from './summarization';
import { chainOfThoughtTemplate } from './chain-of-thought';
import { meetingNotesTemplate } from './meeting-notes';

/** 組み込みテンプレート一覧（表示順） */
const builtInTemplates = [
  blogStructureTemplate,
  codeExplanationTemplate,
  codeReviewTemplate,
  summarizationTemplate,
  chainOfThoughtTemplate,
  meetingNotesTemplate,
] as const;

/**
 * 全ての組み込みテンプレートをレジストリに登録する。
 * アプリケーションの初期化時に一度だけ呼ぶ。
 *
 * @example
 * // app.tsx の初期化処理で:
 * import { registerBuiltInTemplates } from './ai/templates/built-in';
 * registerBuiltInTemplates();
 */
export function registerBuiltInTemplates(): void {
  for (const template of builtInTemplates) {
    registerTemplate(template);
  }
}

export {
  blogStructureTemplate,
  codeExplanationTemplate,
  codeReviewTemplate,
  summarizationTemplate,
  chainOfThoughtTemplate,
  meetingNotesTemplate,
};
