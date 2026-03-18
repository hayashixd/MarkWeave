import type { AiEditTemplate } from './types';

export interface AutoSelectContext {
  hasSelection: boolean;
  selectionLength: number;
  cursorAtEnd: boolean;
}

export function autoSelectTemplate(
  templates: AiEditTemplate[],
  context: AutoSelectContext,
): AiEditTemplate {
  const candidates = templates.filter((t) => {
    if (t.autoSelect.requiresSelection && !context.hasSelection) return false;
    if (!t.autoSelect.requiresSelection && context.hasSelection) return false;
    if (t.autoSelect.cursorPosition === 'end' && !context.cursorAtEnd) return false;
    return true;
  });

  candidates.sort((a, b) => a.autoSelect.priority - b.autoSelect.priority);
  return candidates[0] ?? templates[0]!;
}
