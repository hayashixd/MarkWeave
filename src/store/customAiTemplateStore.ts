/**
 * カスタム AI テンプレートストア (Zustand + @tauri-apps/plugin-store)
 *
 * ai-design.md §10 に準拠。
 *
 * ユーザーが作成した AI プロンプトテンプレートを永続化する。
 * 組み込みテンプレート（built-in/）はコード側で定義されており、
 * このストアではユーザー定義テンプレートのみを管理する。
 *
 * - loadCustomAiTemplates(): plugin-store から読み込み → レジストリに登録
 * - addCustomAiTemplate(): 新規テンプレートを追加
 * - updateCustomAiTemplate(): 既存テンプレートを部分更新
 * - deleteCustomAiTemplate(): テンプレートを削除
 */

import { create } from 'zustand';
import {
  registerTemplate,
  unregisterTemplate,
  type AiTemplate,
  type TemplateCategory,
  type Placeholder,
} from '../ai/templates/template-registry';

/** カスタムテンプレート作成時の入力データ */
export type CustomAiTemplateInput = Pick<
  AiTemplate,
  'name' | 'description' | 'category' | 'tags' | 'content' | 'placeholders'
>;

/** plugin-store の load 関数 */
async function getStore() {
  const { load } = await import('@tauri-apps/plugin-store');
  return load('ai-templates.json');
}

interface CustomAiTemplateStore {
  templates: AiTemplate[];
  loaded: boolean;

  /** plugin-store からカスタムテンプレートを読み込み、レジストリに登録する */
  loadCustomAiTemplates: () => Promise<void>;

  /** カスタムテンプレートを追加 */
  addCustomAiTemplate: (data: CustomAiTemplateInput) => Promise<void>;

  /** カスタムテンプレートを部分更新 */
  updateCustomAiTemplate: (
    id: string,
    data: Partial<CustomAiTemplateInput>,
  ) => Promise<void>;

  /** カスタムテンプレートを削除 */
  deleteCustomAiTemplate: (id: string) => Promise<void>;
}

async function persist(templates: AiTemplate[]) {
  try {
    const store = await getStore();
    await store.set('customAiTemplates', templates);
    await store.save();
  } catch {
    // Tauri 外では永続化をスキップ
  }
}

/** レジストリにカスタムテンプレートを一括登録する */
function syncToRegistry(templates: AiTemplate[]) {
  for (const t of templates) {
    registerTemplate(t);
  }
}

export const useCustomAiTemplateStore = create<CustomAiTemplateStore>(
  (set, get) => ({
    templates: [],
    loaded: false,

    loadCustomAiTemplates: async () => {
      try {
        const store = await getStore();
        const raw = await store.get<AiTemplate[]>('customAiTemplates');
        const templates = raw ?? [];
        syncToRegistry(templates);
        set({ templates, loaded: true });
      } catch {
        set({ templates: [], loaded: true });
      }
    },

    addCustomAiTemplate: async (data) => {
      const template: AiTemplate = {
        id: `custom-${crypto.randomUUID()}`,
        name: data.name,
        description: data.description,
        category: data.category,
        tags: data.tags,
        content: data.content,
        placeholders: data.placeholders,
      };
      registerTemplate(template);
      const next = [...get().templates, template];
      set({ templates: next });
      await persist(next);
    },

    updateCustomAiTemplate: async (id, data) => {
      if (!id.startsWith('custom-')) return; // 組み込みは編集不可
      const next = get().templates.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, ...data };
        registerTemplate(updated); // レジストリも更新
        return updated;
      });
      set({ templates: next });
      await persist(next);
    },

    deleteCustomAiTemplate: async (id) => {
      if (!id.startsWith('custom-')) return; // 組み込みは削除不可
      unregisterTemplate(id);
      const next = get().templates.filter((t) => t.id !== id);
      set({ templates: next });
      await persist(next);
    },
  }),
);

export type { AiTemplate, TemplateCategory, Placeholder };
