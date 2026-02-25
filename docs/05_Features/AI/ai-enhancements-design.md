# AI 機能強化設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [言語検出精度改善](#1-言語検出精度改善)
2. [カスタムテンプレート管理 UI](#2-カスタムテンプレート管理-ui)
3. [AI 文章支援機能（将来拡張）](#3-ai-文章支援機能将来拡張)

---

## 1. 言語検出精度改善

### 1.1 現状と課題

現在の実装（`franc` ライブラリ）では CJK（中国語・日本語・韓国語）の区別精度が低い。
日本語テキストを中国語と誤検出するケースがある。

### 1.2 改善方針

**linguist-languages / trigram ベースの改善:**

```
検出優先順位:
  1. Unicode スクリプト分析（ひらがな/カタカナ → 日本語確定）
  2. 文字種別割合（漢字比率・ひらがな比率）
  3. franc による補助判定
```

```typescript
// src/i18n/language-detector.ts

/**
 * テキストの言語を検出する（CJK 対応強化版）
 * @returns ISO 639-1 言語コード ('ja', 'zh', 'ko', 'en', ...)
 */
export function detectLanguage(text: string): string {
  // ひらがな・カタカナが含まれていれば日本語確定
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
    return 'ja';
  }

  // ハングルが含まれていれば韓国語確定
  if (/[\uAC00-\uD7A3\u1100-\u11FF]/.test(text)) {
    return 'ko';
  }

  // 漢字のみの場合は文字頻度で中国語 / 日本語を判定
  const cjkCount = (text.match(/[\u4E00-\u9FFF]/g) ?? []).length;
  const totalCount = text.replace(/\s/g, '').length;
  if (cjkCount / totalCount > 0.5) {
    // 漢字のみテキスト → franc で中国語変種を判定
    const { franc } = await import('franc');
    const detected = franc(text, { minLength: 10 });
    return detected === 'cmn' || detected === 'yue' ? 'zh' : 'ja';
  }

  // その他は franc に委譲
  const { franc } = await import('franc');
  const iso3 = franc(text, { minLength: 10 });
  return iso3ToIso1(iso3) ?? 'en';
}

/** ISO 639-3 → ISO 639-1 変換（主要言語のみ） */
function iso3ToIso1(iso3: string): string | null {
  const map: Record<string, string> = {
    eng: 'en', jpn: 'ja', zho: 'zh', cmn: 'zh',
    kor: 'ko', deu: 'de', fra: 'fr', spa: 'es',
  };
  return map[iso3] ?? null;
}
```

### 1.3 言語検出の用途

| 機能 | 言語検出の利用方法 |
|------|-----------------|
| スペルチェック | 検出言語に対応した辞書を自動ロード |
| 数字・日付フォーマット | ロケール設定の参照 |
| AI 支援（将来）| プロンプト言語の自動設定 |
| ステータスバー | 「言語: 日本語」表示 |

### 1.4 手動言語設定

自動検出が誤る場合、ユーザーが手動で言語を固定できる。

```
ステータスバー → 言語表示クリック → メニュー:
  ● 自動検出（現在: 日本語）
  ─────────────────
  ○ 日本語
  ○ 英語
  ○ 中国語（簡体）
  ○ 韓国語
  ─────────────────
  ○ その他...
```

設定は `perFile` または `global` で保存可能（`user-settings-design.md` §3 参照）。

---

## 2. カスタムテンプレート管理 UI

### 2.1 テンプレートの種類

| テンプレート種類 | 説明 |
|----------------|------|
| ドキュメントテンプレート | 新規ファイル作成時の初期コンテンツ（YAML Front Matter + ボイラープレート） |
| AI プロンプトテンプレート | AI 支援機能で使用するカスタムプロンプト文字列 |
| エクスポートテンプレート | Word/LaTeX 向けの reference.docx / .tex テンプレート |

### 2.2 ドキュメントテンプレート管理

#### テンプレート一覧画面

```
設定 → テンプレート

┌─────────────────────────────────────────────────────┐
│  ドキュメントテンプレート                             │
├─────────────────────────────────────────────────────┤
│  📄 ブログ記事             [編集] [削除]             │
│  📄 技術仕様書             [編集] [削除]             │
│  📄 会議議事録             [編集] [削除]             │
│  ─────────────────────────────────────────────────  │
│  [+ 新規テンプレート]                                │
└─────────────────────────────────────────────────────┘
```

#### テンプレート編集ダイアログ

```
┌─────────────────────────────────────────────────────┐
│  テンプレートを編集: ブログ記事                       │
├─────────────────────────────────────────────────────┤
│  名前: [ ブログ記事                              ]   │
│                                                     │
│  内容:                                              │
│  ┌──────────────────────────────────────────────┐   │
│  │ ---                                          │   │
│  │ title: タイトル                              │   │
│  │ date: {{date}}                               │   │
│  │ tags: []                                     │   │
│  │ ---                                          │   │
│  │                                              │   │
│  │ ## はじめに                                  │   │
│  │                                              │   │
│  └──────────────────────────────────────────────┘   │
│  使用可能な変数: {{date}}, {{filename}}, {{cursor}} │
│                                                     │
│            [キャンセル]  [保存]                      │
└─────────────────────────────────────────────────────┘
```

#### テンプレート変数

| 変数 | 展開値 |
|------|--------|
| `{{date}}` | 現在日付（YYYY-MM-DD） |
| `{{datetime}}` | 現在日時（ISO 8601） |
| `{{filename}}` | ファイル名（拡張子なし） |
| `{{cursor}}` | カーソル位置（テンプレート展開後にここにカーソル移動） |

### 2.3 テンプレートの永続化

```typescript
// テンプレートデータの保存スキーマ
interface DocumentTemplate {
  id: string;          // UUID
  name: string;
  content: string;
  createdAt: string;   // ISO 8601
  updatedAt: string;
}

// @tauri-apps/plugin-store に保存
// キー: 'documentTemplates'
// 値: DocumentTemplate[]

import { Store } from '@tauri-apps/plugin-store';
const store = new Store('templates.json');

export async function saveTemplate(template: DocumentTemplate): Promise<void> {
  const templates = await store.get<DocumentTemplate[]>('documentTemplates') ?? [];
  const index = templates.findIndex(t => t.id === template.id);
  if (index >= 0) {
    templates[index] = { ...template, updatedAt: new Date().toISOString() };
  } else {
    templates.push(template);
  }
  await store.set('documentTemplates', templates);
  await store.save();
}

export async function deleteTemplate(id: string): Promise<void> {
  const templates = await store.get<DocumentTemplate[]>('documentTemplates') ?? [];
  await store.set('documentTemplates', templates.filter(t => t.id !== id));
  await store.save();
}
```

### 2.4 テンプレートからの新規ファイル作成

```
Ctrl+N 長押し または メニュー → ファイル → テンプレートから新規作成

→ テンプレート選択ポップアップ:
  ┌─────────────────────────────────┐
  │  テンプレートを選択              │
  │  ─────────────────────────────  │
  │  📄 ブログ記事                  │
  │  📄 技術仕様書                  │
  │  📄 会議議事録                  │
  │  ─────────────────────────────  │
  │  📄 空のファイル（テンプレートなし）│
  └─────────────────────────────────┘
```

---

## 3. AI 文章支援機能（将来拡張）

### 3.1 Phase 7 以降の AI 機能候補

> **Note:** Phase 6 以前では実装しない。API キー管理とプライバシーポリシーの整備が前提。

| 機能 | 概要 |
|------|------|
| 文章校正 | 選択テキストの誤字・文法チェック |
| 要約生成 | ドキュメント全体の要約をサイドパネルに表示 |
| タイトル/見出し提案 | セクション内容から見出しを自動提案 |
| 翻訳 | 選択テキストを指定言語に翻訳して挿入 |

### 3.2 AI 機能の設計方針

- **オプトイン**: AI 機能は明示的に有効化が必要
- **API キー管理**: OS キーチェーン（Tauri Keyring プラグイン）に暗号化保存
- **プロンプトの透明性**: 使用するプロンプトをユーザーが確認・編集可能
- **オフライン優先**: ネットワーク不要な機能（スペルチェック等）を優先

### 3.3 API キー設定 UI（Phase 7 設計案）

```
設定 → AI 機能

┌─────────────────────────────────────────────────────┐
│  AI 文章支援                                         │
├─────────────────────────────────────────────────────┤
│  □ AI 文章支援を有効にする                           │
│                                                     │
│  API プロバイダー: [OpenAI ▼]                        │
│  API キー: [ ****************************  ] [変更]  │
│                                                     │
│  □ 選択テキストに右クリックメニューで AI オプション表示│
│  □ ドキュメント統計に要約を表示                      │
│                                                     │
│  プライバシー: テキストは処理のため外部 API に送信    │
│  されます。機密情報の取り扱いにご注意ください。        │
└─────────────────────────────────────────────────────┘
```

---

## 関連ドキュメント

- [user-settings-design.md](./user-settings-design.md) — 設定の保存・管理
- [text-statistics-design.md](./text-statistics-design.md) — スペルチェック・統計機能
- [community-design.md](./community-design.md) — プライバシーポリシー・テレメトリ
