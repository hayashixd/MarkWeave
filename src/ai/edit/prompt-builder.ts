import type { PromptBuildContext, BuiltPrompt } from './types';
import { estimateTokens } from './context-budget';

export function buildPrompt(ctx: PromptBuildContext): BuiltPrompt {
  const systemParts: string[] = [ctx.template.persona];

  if (ctx.references.length > 0) {
    systemParts.push(
      '\n以下の参考資料を必要に応じて参照してください。',
    );
    for (const ref of ctx.references) {
      systemParts.push(
        `\n<reference name="${ref.name}">\n${ref.content}\n</reference>`,
      );
    }
  }

  const enabledConstraints = ctx.template.constraints
    .filter((_, i) => ctx.activeConstraints[i])
    .map((c) => c.text);
  if (enabledConstraints.length > 0) {
    systemParts.push(
      '\n## 制約\n' + enabledConstraints.map((c) => `- ${c}`).join('\n'),
    );
  }

  systemParts.push('\n## 出力形式\n' + ctx.template.outputFormat);

  const system = systemParts.join('\n');

  const userParts: string[] = [];

  userParts.push(`<document>\n${ctx.document}\n</document>`);

  if (ctx.selection) {
    userParts.push(`<selection>\n${ctx.selection}\n</selection>`);
  }

  let instruction = ctx.template.task;
  if (ctx.userInstruction?.trim()) {
    instruction += `\n\n追加の指示: ${ctx.userInstruction.trim()}`;
  }
  userParts.push(`<instruction>\n${instruction}\n</instruction>`);

  const user = userParts.join('\n\n');

  return {
    system,
    user,
    estimatedInputTokens: estimateTokens(system) + estimateTokens(user),
  };
}
