/**
 * スニペットストア (Zustand + @tauri-apps/plugin-store)
 *
 * よく使うフレーズを登録・管理し、スラッシュコマンドから挿入できる。
 *
 * - addSnippet(): 新しいスニペットを追加
 * - updateSnippet(): 既存スニペットを部分更新
 * - deleteSnippet(): スニペットを削除
 * - loadSnippets(): plugin-store から読み込み
 */

import { create } from 'zustand';

export interface Snippet {
  id: string;
  /** 表示名（スラッシュコマンドメニューにも使用） */
  name: string;
  /** 挿入するMarkdownテキスト */
  content: string;
  /** 検索用キーワード（スペース区切り） */
  keywords: string;
  /** 作成日時 (epoch ms) */
  createdAt: number;
  /** 更新日時 (epoch ms) */
  updatedAt: number;
}

/** plugin-store の load 関数（Tauri 環境でのみ利用可能） */
async function getStore() {
  const { load } = await import('@tauri-apps/plugin-store');
  return load('snippets.json');
}

interface SnippetStore {
  snippets: Snippet[];
  loaded: boolean;

  /** plugin-store からスニペットを読み込む */
  loadSnippets: () => Promise<void>;

  /** スニペットを追加 */
  addSnippet: (data: Pick<Snippet, 'name' | 'content' | 'keywords'>) => Promise<void>;

  /** スニペットを部分更新 */
  updateSnippet: (id: string, data: Partial<Pick<Snippet, 'name' | 'content' | 'keywords'>>) => Promise<void>;

  /** スニペットを削除 */
  deleteSnippet: (id: string) => Promise<void>;
}

async function persist(snippets: Snippet[]) {
  try {
    const store = await getStore();
    await store.set('snippets', snippets);
    await store.save();
  } catch {
    // Tauri 外では永続化をスキップ
  }
}

export const useSnippetStore = create<SnippetStore>((set, get) => ({
  snippets: [],
  loaded: false,

  loadSnippets: async () => {
    try {
      const store = await getStore();
      const raw = await store.get<Snippet[]>('snippets');
      set({ snippets: raw ?? [], loaded: true });
    } catch {
      // Tauri 外ではデフォルト値で起動
      set({ snippets: [], loaded: true });
    }
  },

  addSnippet: async (data) => {
    const now = Date.now();
    const snippet: Snippet = {
      id: crypto.randomUUID(),
      name: data.name,
      content: data.content,
      keywords: data.keywords,
      createdAt: now,
      updatedAt: now,
    };
    const next = [...get().snippets, snippet];
    set({ snippets: next });
    await persist(next);
  },

  updateSnippet: async (id, data) => {
    const next = get().snippets.map((s) =>
      s.id === id ? { ...s, ...data, updatedAt: Date.now() } : s,
    );
    set({ snippets: next });
    await persist(next);
  },

  deleteSnippet: async (id) => {
    const next = get().snippets.filter((s) => s.id !== id);
    set({ snippets: next });
    await persist(next);
  },
}));
