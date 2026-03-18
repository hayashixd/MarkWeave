import type { AiEditTemplate } from './types';
import { BUILTIN_TEMPLATES } from './templates/builtin';
import { loadUserTemplates } from './template-storage';

export async function loadAllTemplates(): Promise<AiEditTemplate[]> {
  const user = await loadUserTemplates();
  return [...BUILTIN_TEMPLATES, ...user];
}

export function getTemplateById(
  templates: AiEditTemplate[],
  id: string,
): AiEditTemplate | undefined {
  return templates.find((t) => t.id === id);
}
