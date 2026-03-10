/**
 * ドキュメントテンプレートストア (Zustand + @tauri-apps/plugin-store)
 *
 * ai-design.md §10 に準拠。
 *
 * 新規ファイル作成時に使用するドキュメントテンプレートを管理する。
 * テンプレート変数: {{date}}, {{datetime}}, {{filename}}, {{cursor}}
 */

import { create } from 'zustand';

export interface DocumentTemplate {
  id: string;
  /** テンプレート表示名 */
  name: string;
  /** テンプレート内容（Markdown + プレースホルダー） */
  content: string;
  /** 作成日時 (ISO 8601) */
  createdAt: string;
  /** 更新日時 (ISO 8601) */
  updatedAt: string;
}

/** plugin-store の load 関数 */
async function getStore() {
  const { load } = await import('@tauri-apps/plugin-store');
  return load('templates.json');
}

/** デフォルトの組み込みテンプレート */
const BUILTIN_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'builtin-blog',
    name: 'ブログ記事',
    content: `---
title: タイトル
date: {{date}}
tags: []
---

# タイトル

## はじめに

{{cursor}}

## 本文

## まとめ
`,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'builtin-tech-spec',
    name: '技術仕様書',
    content: `---
title: 仕様書タイトル
date: {{date}}
status: draft
---

# 仕様書タイトル

## 1. 背景と目的

{{cursor}}

## 2. 要件

## 3. 設計

## 4. 実装方針

## 5. テスト計画
`,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'builtin-meeting',
    name: '会議議事録',
    content: `---
title: 会議議事録
date: {{date}}
attendees: []
---

# 会議議事録 - {{date}}

## 参加者

-

## アジェンダ

1. {{cursor}}

## 議事内容

## アクションアイテム

| 担当 | タスク | 期限 |
|------|--------|------|
|      |        |      |

## 次回予定
`,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'builtin-weekly-review',
    name: '週次レビュー',
    content: `---
title: 週次レビュー
date: {{date}}
week: ""
---

# 週次レビュー - {{date}}

## 今週の成果

- {{cursor}}

## 来週の予定

-

## 振り返り

### うまくいったこと

-

### 改善点

-

## メモ
`,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

interface DocumentTemplateStore {
  templates: DocumentTemplate[];
  loaded: boolean;

  /** plugin-store からテンプレートを読み込む */
  loadTemplates: () => Promise<void>;

  /** テンプレートを追加 */
  addTemplate: (data: Pick<DocumentTemplate, 'name' | 'content'>) => Promise<void>;

  /** テンプレートを更新 */
  updateTemplate: (id: string, data: Partial<Pick<DocumentTemplate, 'name' | 'content'>>) => Promise<void>;

  /** テンプレートを削除（組み込みテンプレートは削除不可） */
  deleteTemplate: (id: string) => Promise<void>;

  /** 全テンプレートを取得（組み込み + ユーザー） */
  getAllTemplates: () => DocumentTemplate[];

  /** テンプレートの変数を展開する */
  expandTemplate: (template: DocumentTemplate, filename?: string) => string;
}

async function persist(templates: DocumentTemplate[]) {
  try {
    const store = await getStore();
    // ユーザーテンプレートのみ永続化（組み込みはコードに定義）
    const userTemplates = templates.filter((t) => !t.id.startsWith('builtin-'));
    await store.set('documentTemplates', userTemplates);
    await store.save();
  } catch {
    // Tauri 外では永続化をスキップ
  }
}

export const useDocumentTemplateStore = create<DocumentTemplateStore>((set, get) => ({
  templates: [],
  loaded: false,

  loadTemplates: async () => {
    try {
      const store = await getStore();
      const userTemplates = await store.get<DocumentTemplate[]>('documentTemplates');
      set({ templates: userTemplates ?? [], loaded: true });
    } catch {
      set({ templates: [], loaded: true });
    }
  },

  addTemplate: async (data) => {
    const now = new Date().toISOString();
    const template: DocumentTemplate = {
      id: crypto.randomUUID(),
      name: data.name,
      content: data.content,
      createdAt: now,
      updatedAt: now,
    };
    const next = [...get().templates, template];
    set({ templates: next });
    await persist(next);
  },

  updateTemplate: async (id, data) => {
    if (id.startsWith('builtin-')) return; // 組み込みは編集不可
    const next = get().templates.map((t) =>
      t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t,
    );
    set({ templates: next });
    await persist(next);
  },

  deleteTemplate: async (id) => {
    if (id.startsWith('builtin-')) return; // 組み込みは削除不可
    const next = get().templates.filter((t) => t.id !== id);
    set({ templates: next });
    await persist(next);
  },

  getAllTemplates: () => {
    return [...BUILTIN_TEMPLATES, ...get().templates];
  },

  expandTemplate: (template, filename = 'untitled') => {
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const datetime = now.toISOString();

    let content = template.content;
    content = content.replace(/\{\{date\}\}/g, date);
    content = content.replace(/\{\{datetime\}\}/g, datetime);
    content = content.replace(/\{\{filename\}\}/g, filename);
    // {{cursor}} はエディタ側で処理するためそのまま残す（後でカーソル位置として使用）
    content = content.replace(/\{\{cursor\}\}/g, '');

    return content;
  },
}));
