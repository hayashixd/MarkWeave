import { load } from '@tauri-apps/plugin-store';
import type { AiEditTemplate } from './types';

const STORE_NAME = 'ai-edit-templates.json';
const STORE_KEY = 'templates';

export async function loadUserTemplates(): Promise<AiEditTemplate[]> {
  const store = await load(STORE_NAME);
  return (await store.get<AiEditTemplate[]>(STORE_KEY)) ?? [];
}

export async function saveUserTemplate(
  template: AiEditTemplate,
): Promise<void> {
  const store = await load(STORE_NAME);
  const templates = (await store.get<AiEditTemplate[]>(STORE_KEY)) ?? [];

  template.id = template.id || `user-${crypto.randomUUID()}`;
  template.source = 'user';

  const idx = templates.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    templates[idx] = template;
  } else {
    templates.push(template);
  }

  await store.set(STORE_KEY, templates);
  await store.save();
}

export async function deleteUserTemplate(id: string): Promise<void> {
  const store = await load(STORE_NAME);
  const templates = (await store.get<AiEditTemplate[]>(STORE_KEY)) ?? [];
  await store.set(
    STORE_KEY,
    templates.filter((t) => t.id !== id),
  );
  await store.save();
}
