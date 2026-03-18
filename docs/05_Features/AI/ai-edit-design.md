# AI 文章編集機能 設計ドキュメント

> プロジェクト: MarkWeave — ローカルファースト WYSIWYG エディタ
> バージョン: 1.0
> 作成日: 2026-03-17

---

## 目次

1. [背景と目的](#1-背景と目的)
2. [機能概要](#2-機能概要)
3. [アーキテクチャ](#3-アーキテクチャ)
4. [プロンプトテンプレートシステム](#4-プロンプトテンプレートシステム)
5. [参考資料システム（コンテキスト注入）](#5-参考資料システムコンテキスト注入)
6. [インライン編集 UX](#6-インライン編集-ux)
7. [プロンプト組み立てパイプライン](#7-プロンプト組み立てパイプライン)
8. [ストリーミング通信](#8-ストリーミング通信)
9. [diff 表示と Accept/Reject](#9-diff-表示と-acceptreject)
10. [Undo/Redo 統合](#10-undoredo-統合)
11. [ストレージ設計](#11-ストレージ設計)
12. [設定 UI](#12-設定-ui)
13. [メニュー・ショートカット統合](#13-メニューショートカット統合)
14. [セキュリティ](#14-セキュリティ)
15. [制約と非スコープ](#15-制約と非スコープ)

---

## 1. 背景と目的

### 1.1 現状

既存の AI 機能（`ai-design.md`）は「AI にテキストを渡す準備」に留まっている。

| 既存機能 | 動作 |
|---------|------|
| AI コピー | ローカルで Markdown を整形しクリップボードにコピー（API 不使用） |
| AI テンプレート | ChatGPT / Claude にコピペするためのプロンプトテンプレート集 |

**エディタ内で AI がテキストを直接編集する機能はゼロ。**

### 1.2 目的

Cursor の Cmd+K（インライン編集）と Claude Code の文脈理解を参考に、
**エディタ内で完結する AI 文章編集機能** を実装する。

ターゲットユースケース:
- 技術記事の校正（誤字脱字・文法）
- 選択テキストのリライト（「もっと簡潔に」「具体例を入れて」）
- カーソル位置からの続き生成
- 記事全体の文脈を踏まえた局所編集

### 1.3 設計原則

| 原則 | 内容 |
|------|------|
| **BYOK 前提** | MarkWeave はAPIキーを発行しない。ユーザーの Claude API キーを使う |
| **非破壊** | AI の出力をいきなり確定しない。必ず diff → Accept/Reject を経由 |
| **コスト透明** | トークン使用量を常に表示。ユーザーが予測できないコストを発生させない |
| **オフライン劣化なし** | AI 機能が使えなくてもエディタの全機能は正常動作する |
| **文脈重視** | 選択範囲だけでなく、ドキュメント全体 + 参考資料をコンテキストとして送る |

---

## 2. 機能概要

### 2.1 Tier 1（本設計書のスコープ）

| 機能 | 概要 |
|------|------|
| **インライン編集** | テキスト選択 → 指示入力 → AI が書き換え候補をストリーミング表示 → Accept/Reject |
| **定型操作メニュー** | 選択テキストを右クリック → 「校正」「リライト」「要約」「翻訳」「敬体↔常体」 |
| **続きを書く** | カーソル位置から AI が続きの段落を生成 |
| **プロンプトテンプレート** | 組み込み 5 種 + ユーザーカスタム。自動選択あり |
| **参考資料** | ファイルを指定してコンテキストに注入。RAG なし・直接注入 |
| **ストリーミング表示** | AI の出力をトークン単位でリアルタイム表示 |

### 2.2 Tier 2（本設計書では設計方針のみ。別途詳細化）

| 機能 | 概要 |
|------|------|
| チャットパネル | サイドパネルでの対話。回答内の提案を「適用」ボタンで本文に反映 |
| 文書全体の校正 | ドキュメント全体を送って修正候補一覧 → 1 件ずつ Accept/Reject |

### 2.3 非スコープ

| 機能 | 理由 |
|------|------|
| Tab 補完（Ghost text） | 散文の予測は精度が低くコスト対効果が悪い |
| マルチファイル編集 | 記事エディタでは単一ファイルが基本 |
| エージェント的な自律行動 | BYOK のコスト予測が困難 |
| RAG / ベクトル検索 | §5 で詳述。コンテキストウィンドウの直接注入で十分 |

---

## 3. アーキテクチャ

### 3.1 通信フロー

```
┌─────────────────────────────────────────────────────────────┐
│ フロントエンド (TypeScript / React)                          │
│                                                             │
│  ┌──────────┐   ┌──────────────┐   ┌───────────────────┐   │
│  │ AiEdit   │──→│ PromptBuilder│──→│ invoke()          │   │
│  │ Panel    │   │ (テンプレート │   │ 'start_ai_stream' │   │
│  │          │   │  + 参考資料   │   └─────────┬─────────┘   │
│  │          │   │  + 文書全文)  │             │             │
│  │          │   └──────────────┘             │             │
│  │          │                                │             │
│  │          │◀── listen('ai-stream-chunk') ◀──┘             │
│  │          │◀── listen('ai-stream-done')                   │
│  │          │◀── listen('ai-stream-error')                  │
│  │          │                                               │
│  │  ┌───────┴──────┐                                        │
│  │  │ DiffPreview  │ → Accept → TipTap replaceSelection()  │
│  │  │              │ → Reject → 元テキスト維持               │
│  │  └──────────────┘                                        │
│  └──────────────────────────────────────────────────────────│
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ バックエンド (Rust / Tauri)                                  │
│                                                             │
│  ┌──────────────────┐   ┌──────────────────────────────┐   │
│  │ start_ai_stream  │──→│ Anthropic SSE streaming API  │   │
│  │ (Tauri command)   │   │ or OpenAI streaming API      │   │
│  │                  │◀──│ text/event-stream             │   │
│  │                  │   └──────────────────────────────┘   │
│  │                  │──→ window.emit('ai-stream-chunk')    │
│  │                  │──→ window.emit('ai-stream-done')     │
│  └──────────────────┘                                      │
│                                                             │
│  設定ストア: settings.json → ai_api_keys.anthropic          │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 既存 `call_ai_api` との関係

| | `call_ai_api`（既存） | `start_ai_stream`（新規） |
|---|---|---|
| 通信方式 | 単発 POST → JSON 応答 | SSE ストリーミング |
| TS 側受信 | `invoke()` の返り値 | `listen()` でイベント受信 |
| 用途 | 短い応答（将来の要約等） | インライン編集（長文生成） |
| 共存 | 残す | 追加 |

`call_ai_api` は短い応答に適しているため廃止しない。
ストリーミングが不要なケース（1 行の校正等）では引き続き使用可能。

---

## 4. プロンプトテンプレートシステム

### 4.1 設計思想

```
初心者:  5つのボタンから1つ選ぶだけ → 即実行
中級者:  テンプレート選択 + 「追加の指示」を1行書く
上級者:  構造化フォームで全フィールドを編集 or 自作テンプレートを使う
```

3 層すべてが **同じデータ構造** の上に乗る。UI の表示粒度が違うだけ。

### 4.2 テンプレートデータ構造

```typescript
// src/ai/edit/types.ts

interface AiEditTemplate {
  id: string;
  name: string;                      // 「校正」「リライト」等
  icon: string;                      // UI 表示用アイコン文字
  description: string;               // 1行の説明
  source: 'builtin' | 'user';       // 組み込み or ユーザー作成

  // --- プロンプト構造（4フィールド固定） ---
  persona: string;                   // AI の役割定義
  task: string;                      // 何をするか
  constraints: TemplateConstraint[]; // 制約条件（個別 ON/OFF 可能）
  outputFormat: string;              // 出力形式の指定

  // --- 自動選択ヒント ---
  autoSelect: {
    requiresSelection: boolean;      // テキスト選択が必要か
    cursorPosition?: 'end' | 'any';  // カーソル位置の条件
    priority: number;                // 同条件時の優先度（小さいほど高）
  };
}

interface TemplateConstraint {
  text: string;           // 制約の内容
  defaultEnabled: boolean; // デフォルトで ON か
}
```

**4 フィールド固定** により:
- 初心者: 何も触らずテンプレートのまま使える
- 上級者: 4 つの枠のどこを変えるか明確

### 4.3 組み込みテンプレート（5 種）

記事執筆で実際に使う操作に絞る。

#### テンプレート 1: 校正

```typescript
const proofread: AiEditTemplate = {
  id: 'builtin-proofread',
  name: '校正',
  icon: '✏️',
  description: '誤字脱字・文法ミスを修正します',
  source: 'builtin',

  persona:
    'Zenn/Qiita の技術記事を専門とする校正編集者です。' +
    '正確性と可読性を重視し、著者の文体を尊重しながら修正します。',

  task:
    '以下の選択テキストの誤字脱字・文法ミス・不自然な表現を修正してください。',

  constraints: [
    { text: '元の文体（敬体/常体）を維持する', defaultEnabled: true },
    { text: '技術用語・固有名詞は変更しない', defaultEnabled: true },
    { text: '文の意味や主張を変えない', defaultEnabled: true },
    { text: '修正が不要な場合は元のテキストをそのまま返す', defaultEnabled: true },
  ],

  outputFormat:
    '修正後のテキストのみを出力してください。' +
    '説明やコメントは付けないでください。' +
    'Markdown の書式は維持してください。',

  autoSelect: { requiresSelection: true, priority: 1 },
};
```

#### テンプレート 2: リライト

```typescript
const rewrite: AiEditTemplate = {
  id: 'builtin-rewrite',
  name: 'リライト',
  icon: '🔄',
  description: '選択テキストを指示に従って書き直します',
  source: 'builtin',

  persona:
    '技術記事のライターです。' +
    '読みやすく、正確で、無駄のない文章を書きます。',

  task:
    '以下の選択テキストを、ユーザーの追加指示に従って書き直してください。' +
    '追加指示がない場合は、より読みやすく簡潔に書き直してください。',

  constraints: [
    { text: '元の情報を欠落させない', defaultEnabled: true },
    { text: '技術的な正確性を維持する', defaultEnabled: true },
    { text: 'Markdown の書式を維持する', defaultEnabled: true },
  ],

  outputFormat:
    '書き直したテキストのみを出力してください。' +
    '説明やコメントは付けないでください。',

  autoSelect: { requiresSelection: true, priority: 2 },
};
```

#### テンプレート 3: 続きを書く

```typescript
const continueWriting: AiEditTemplate = {
  id: 'builtin-continue',
  name: '続きを書く',
  icon: '📝',
  description: 'カーソル位置から続きの段落を生成します',
  source: 'builtin',

  persona:
    '技術ブログの著者です。' +
    '記事全体の文脈と論理展開を踏まえて、自然な続きを書きます。',

  task:
    'ドキュメント全体の文脈を踏まえて、カーソル位置から続きの段落を書いてください。' +
    '1〜3 段落程度で、直前のセクションの論点を自然に展開してください。',

  constraints: [
    { text: '文書全体の文体に合わせる', defaultEnabled: true },
    { text: '新しいセクション見出しは追加しない', defaultEnabled: true },
    { text: '事実と異なる技術的な記述を避ける', defaultEnabled: true },
  ],

  outputFormat:
    '続きの段落のみを出力してください。' +
    'Markdown 書式で出力してください。',

  autoSelect: { requiresSelection: false, cursorPosition: 'end', priority: 1 },
};
```

#### テンプレート 4: 要約

```typescript
const summarize: AiEditTemplate = {
  id: 'builtin-summarize',
  name: '要約',
  icon: '📋',
  description: '選択テキストを要約します',
  source: 'builtin',

  persona: '編集アシスタントです。正確で簡潔な要約を作成します。',

  task: '以下の選択テキストを簡潔に要約してください。',

  constraints: [
    { text: '元の論点を欠落させない', defaultEnabled: true },
    { text: '元のテキストの 1/3 以下の分量にする', defaultEnabled: true },
    { text: '技術用語はそのまま使用する', defaultEnabled: true },
  ],

  outputFormat:
    '要約テキストのみを出力してください。' +
    '箇条書きではなく散文で出力してください。',

  autoSelect: { requiresSelection: true, priority: 3 },
};
```

#### テンプレート 5: 翻訳

```typescript
const translate: AiEditTemplate = {
  id: 'builtin-translate',
  name: '翻訳',
  icon: '🌐',
  description: '選択テキストを指定言語に翻訳します',
  source: 'builtin',

  persona:
    '技術文書専門の翻訳者です。' +
    '技術的なニュアンスを正確に保ちながら、自然な訳文を生成します。',

  task:
    '以下の選択テキストを翻訳してください。' +
    'ユーザーの追加指示で翻訳先言語が指定されていない場合は、' +
    '日本語なら英語に、英語なら日本語に翻訳してください。',

  constraints: [
    { text: '技術用語は一般的な訳語を使用する', defaultEnabled: true },
    { text: 'コードブロック内のコードは翻訳しない', defaultEnabled: true },
    { text: 'Markdown の書式を維持する', defaultEnabled: true },
  ],

  outputFormat:
    '翻訳後のテキストのみを出力してください。',

  autoSelect: { requiresSelection: true, priority: 4 },
};
```

### 4.4 自動選択ロジック

エディタの状態に応じてデフォルトのテンプレートを自動選択する。
ユーザーはワンクリックで別のテンプレートに切り替え可能。

```typescript
// src/ai/edit/auto-select.ts

function autoSelectTemplate(
  templates: AiEditTemplate[],
  context: {
    hasSelection: boolean;
    selectionLength: number;
    cursorAtEnd: boolean;
  }
): AiEditTemplate {
  const candidates = templates.filter(t => {
    if (t.autoSelect.requiresSelection && !context.hasSelection) return false;
    if (!t.autoSelect.requiresSelection && context.hasSelection) return false;
    if (t.autoSelect.cursorPosition === 'end' && !context.cursorAtEnd) return false;
    return true;
  });

  candidates.sort((a, b) => a.autoSelect.priority - b.autoSelect.priority);
  return candidates[0] ?? templates[0];
}
```

| エディタの状態 | 自動選択 |
|-------------|---------|
| テキスト選択あり | **校正**（priority=1） |
| テキスト選択なし + カーソルが文末付近 | **続きを書く** |
| テキスト選択なし + カーソルが文中 | **続きを書く**（フォールバック） |

### 4.5 カスタムテンプレートの作成フロー

ユーザーがカスタムテンプレートを作る方法は 2 つ:

**方法 1: 組み込みテンプレートから派生**
1. 詳細設定モードでフィールドを編集
2. 「テンプレートとして保存...」ボタンをクリック
3. テンプレート名を入力して保存

**方法 2: 設定画面から新規作成**
1. 設定 → AI → テンプレート管理
2. 「+ 新規テンプレート」をクリック
3. 4 フィールド（ペルソナ / タスク / 制約 / 出力形式）を入力
4. 保存

どちらの場合も同じ `AiEditTemplate` 構造で保存される。

---

## 5. 参考資料システム（コンテキスト注入）

### 5.1 RAG を採用しない理由

| RAG の要件 | MarkWeave での実態 |
|-----------|-------------------|
| ベクトル DB | ローカルアプリへの組み込みは依存・保守コスト過大 |
| Embedding モデル | ローカル（遅い）or API（BYOK で追加設定が必要、UX 悪化） |
| チャンク分割 | 技術記事 5〜50KB を分割すると文脈が壊れやすい |
| インデックス更新 | ファイルウォッチャーとの連携が複雑化 |
| 検索精度チューニング | 個人開発で継続メンテは非現実的 |

### 5.2 直接コンテキスト注入で十分な理由

Claude のコンテキストウィンドウは **200K トークン**。
記事執筆時の参考資料は数ファイル〜十数ファイル。

```
記事本文:                ~5KB   (~1,500 tokens)
参考ファイル 5本 × 30KB: ~150KB (~40,000 tokens)
システムプロンプト:       ~2KB   (~500 tokens)
─────────────────────────────────────────────
合計:                   ~42,000 tokens → 200K の 21%
```

ユーザーは参考にするファイルを**自分で選べる**。
数百ファイルからの自動検索は記事執筆のユースケースでは不要。

### 5.3 参考資料の追加方法

| 方法 | 操作 |
|------|------|
| ファイルツリーからドラッグ | ワークスペースのファイルを参考資料パネルにドロップ |
| パネル内の追加ボタン | 「+」ボタンでファイル選択ダイアログ |
| エディタ内から指定 | 開いているタブを右クリック →「参考資料に追加」 |

### 5.4 コンテキスト予算管理

```typescript
// src/ai/edit/context-budget.ts

interface ContextBudget {
  modelMaxTokens: number;      // モデルのコンテキスト上限 (200,000)
  systemPrompt: number;        // 固定プロンプト分のトークン数
  references: number;          // 参考資料の合計トークン数
  document: number;            // 現在の記事本文のトークン数
  reservedForOutput: number;   // AI 出力用の予約枠 (max_tokens)
  available: number;           // 残りの空き容量
}

function estimateTokens(text: string): number {
  // 日本語: 1文字 ≈ 1〜2 トークン（保守的に 1.5 で推定）
  // 英語: 1単語 ≈ 1.3 トークン
  const japaneseChars = (text.match(/[\u3000-\u9FFF\uF900-\uFAFF]/g) ?? []).length;
  const otherChars = text.length - japaneseChars;
  return Math.ceil(japaneseChars * 1.5 + otherChars * 0.4);
}
```

### 5.5 予算超過時の対応

| 合計トークン | UI 表示 | 動作 |
|------------|---------|------|
| < 100K | 緑バー | そのまま全文注入 |
| 100K〜150K | 黄バー + 警告 | 「精度が低下する可能性があります」 |
| 150K〜180K | 橙バー + 提案 | 「参考資料を減らすか、要約して送信できます」 |
| > 180K | 赤バー + ブロック | ファイル追加を拒否「出力に十分な余裕がありません」 |

### 5.6 参考資料パネル UI

```
┌─────────────────────────────────────────┐
│  📎 参考資料                        [+]  │
├─────────────────────────────────────────┤
│  📄 tauri-ipc-file-conflict.md   12KB   │
│     ~5,400 tok                    [×]   │
│  📄 tiptap-ime-prosemirror.md     8KB   │
│     ~3,600 tok                    [×]   │
│  📄 local-first-mindset.md       15KB   │
│     ~6,750 tok                    [×]   │
├─────────────────────────────────────────┤
│  コンテキスト使用量                      │
│  ██████░░░░░░░░░░░░░░  35K / 200K tok  │
│  本文: 1.5K | 参考: 15.8K | 予約: 8K   │
└─────────────────────────────────────────┘
```

### 5.7 参考資料のセッション管理

参考資料リストはタブ単位で保持する（タブを閉じるまで維持）。
永続化はしない（記事ごとに参考資料は異なるため）。

```typescript
// Zustand ストアに追加（タブ単位で管理）
interface TabAiState {
  references: ReferenceFile[];
}

interface ReferenceFile {
  path: string;
  name: string;
  content: string;         // ファイル内容（読み込み済み）
  estimatedTokens: number;
}
```

---

## 6. インライン編集 UX

### 6.1 起動方法

| 方法 | 操作 |
|------|------|
| ショートカット | `Ctrl+Shift+I`（テキスト選択時 or カーソル位置） |
| コンテキストメニュー | 右クリック →「AI で編集...」 |
| メニューバー | 編集 → AI 編集... |
| 定型操作 | 右クリック →「AI 校正」「AI リライト」等（テンプレート直接実行） |

### 6.2 操作フロー

```
1. テキストを選択（or カーソル位置で起動）
2. AI 編集パネルがエディタ下部にインライン表示
   → テンプレートが自動選択されている
   → ユーザーは必要に応じてテンプレートを変更
   → 「追加の指示」欄にオプションで指示を書く
3. [実行] をクリック（または Ctrl+Enter）
4. ストリーミングで AI 出力が表示される
   → 選択テキストの下に diff プレビュー領域が展開
   → トークン単位でリアルタイム表示
5. 生成完了後、Accept / Reject を選択
   → Accept: エディタの選択範囲を AI 出力で置換（1 Undo ステップ）
   → Reject: 元テキストを維持（変更なし）
6. パネルが閉じる
```

### 6.3 シンプルモード UI（デフォルト）

```
┌───────────────────────────────────────────────────────┐
│  [✏️校正] [🔄リライト] [📝続き] [📋要約] [🌐翻訳]     │
│   ^^^^^^                                              │
│   自動選択でハイライト                                   │
│                                                       │
│  追加の指示（任意）:                                     │
│  ┌───────────────────────────────────────────────┐     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                       │
│  📎 参考資料: 3件 (15.8K tok)   [▸ 詳細設定]  [実行 ⌘↵] │
└───────────────────────────────────────────────────────┘
```

### 6.4 詳細設定モード UI（トグルで展開）

```
┌───────────────────────────────────────────────────────┐
│  テンプレート: [校正 ▼] [マイテンプレート ▼] [▾詳細設定] │
├───────────────────────────────────────────────────────┤
│  ペルソナ:                                             │
│  ┌───────────────────────────────────────────────┐     │
│  │ Zenn/Qiitaの技術記事を専門とする校正編集者です。 │     │
│  │ 正確性と可読性を重視し、著者の文体を尊重しなが  │     │
│  │ ら修正します。                                 │     │
│  └───────────────────────────────────────────────┘     │
│                                                       │
│  制約:                                                 │
│  ☑ 元の文体（敬体/常体）を維持する                       │
│  ☑ 技術用語・固有名詞は変更しない                        │
│  ☑ 文の意味や主張を変えない                              │
│  ☐ 敬体（です・ます）に統一する                          │
│  ┌───────────────────────────────────────────────┐     │
│  │ 追加の制約を入力...                            │     │
│  └───────────────────────────────────────────────┘     │
│                                                       │
│  出力形式:                                             │
│  (●) 修正後テキストのみ                                 │
│  ( ) 修正箇所にコメント付き                              │
│                                                       │
│  [テンプレートとして保存...]               [実行 ⌘↵]    │
└───────────────────────────────────────────────────────┘
```

### 6.5 IME ガード

AI 編集パネルの操作（`Ctrl+Enter` での実行等）は IME composition 中にガードする。

```typescript
function handleKeyDown(e: KeyboardEvent): void {
  if (e.isComposing) return; // IME 変換中は無視
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    executeAiEdit();
  }
}
```

---

## 7. プロンプト組み立てパイプライン

### 7.1 最終的なプロンプト構造

```
[system]
{persona}

{参考資料（ある場合）}

## 制約
{有効な制約のリスト}

## 出力形式
{outputFormat}

[user]
<document>
{現在編集中の記事全文}
</document>

<selection>
{選択範囲のテキスト（ある場合）}
</selection>

<instruction>
{task}

追加の指示: {ユーザーが入力した追加指示（ある場合）}
</instruction>
```

### 7.2 組み立て実装

```typescript
// src/ai/edit/prompt-builder.ts

interface PromptBuildContext {
  template: AiEditTemplate;
  document: string;
  selection?: string;
  userInstruction?: string;
  references: ReferenceFile[];
  activeConstraints: boolean[];  // 各制約の ON/OFF 状態
}

interface BuiltPrompt {
  system: string;
  user: string;
  estimatedInputTokens: number;
}

function buildPrompt(ctx: PromptBuildContext): BuiltPrompt {
  // --- system ---
  const systemParts: string[] = [ctx.template.persona];

  if (ctx.references.length > 0) {
    systemParts.push(
      '\n以下の参考資料を必要に応じて参照してください。'
    );
    for (const ref of ctx.references) {
      systemParts.push(
        `\n<reference name="${ref.name}">\n${ref.content}\n</reference>`
      );
    }
  }

  const enabledConstraints = ctx.template.constraints
    .filter((_, i) => ctx.activeConstraints[i])
    .map(c => c.text);
  if (enabledConstraints.length > 0) {
    systemParts.push(
      '\n## 制約\n' + enabledConstraints.map(c => `- ${c}`).join('\n')
    );
  }

  systemParts.push('\n## 出力形式\n' + ctx.template.outputFormat);

  const system = systemParts.join('\n');

  // --- user ---
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
```

### 7.3 トークン上限チェック

`buildPrompt()` の返り値 `estimatedInputTokens` を使い、
実行前にコンテキスト予算を検証する。

```typescript
function validateBudget(
  prompt: BuiltPrompt,
  maxTokens: number,       // AI 出力の max_tokens
  modelLimit: number        // モデルのコンテキスト上限
): { ok: boolean; message?: string } {
  const total = prompt.estimatedInputTokens + maxTokens;

  if (total > modelLimit * 0.95) {
    return {
      ok: false,
      message: `コンテキスト上限に近すぎます（推定 ${total.toLocaleString()} / ${modelLimit.toLocaleString()} トークン）。参考資料を減らしてください。`,
    };
  }

  if (total > modelLimit * 0.7) {
    return {
      ok: true,
      message: `コンテキストの ${Math.round(total / modelLimit * 100)}% を使用します。精度が低下する可能性があります。`,
    };
  }

  return { ok: true };
}
```

---

## 8. ストリーミング通信

### 8.1 Rust 側: 新規コマンド `start_ai_stream`

既存の `call_ai_api` は単発応答。ストリーミング用に新コマンドを追加する。

```rust
// src-tauri/src/commands/ai_commands.rs に追加

#[derive(Deserialize)]
pub struct AiStreamRequest {
    pub provider: String,
    pub model: String,
    pub system: String,
    pub user: String,
    pub max_tokens: u32,
}

#[derive(Serialize, Clone)]
pub struct AiStreamChunk {
    pub delta: String,        // 差分テキスト
    pub accumulated: String,  // 累積テキスト
}

#[derive(Serialize, Clone)]
pub struct AiStreamDone {
    pub content: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
}

#[tauri::command]
pub async fn start_ai_stream(
    app: tauri::AppHandle,
    window: tauri::Window,
    request: AiStreamRequest,
) -> Result<(), String> {
    // 1. バリデーション（既存と同様: ホワイトリスト・長さ上限）
    // 2. API キー取得（Rust 側ストアから）
    // 3. SSE ストリーミングリクエスト送信
    // 4. チャンク受信ごとに window.emit("ai-stream-chunk", chunk)
    // 5. 完了時に window.emit("ai-stream-done", done)
    // 6. エラー時に window.emit("ai-stream-error", message)
}
```

### 8.2 Anthropic SSE ストリーミング

```rust
async fn stream_anthropic(
    window: &tauri::Window,
    api_key: &str,
    model: &str,
    system: &str,
    user: &str,
    max_tokens: u32,
) -> Result<(), String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "stream": true,
        "system": system,
        "messages": [{ "role": "user", "content": user }]
    });

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("API 通信エラー: {e}"))?;

    // SSE イベントを 1 行ずつ読み取り、
    // event: content_block_delta のときに delta.text を emit
    // event: message_stop のときに完了を emit
    // ...（実装詳細は実装フェーズで確定）
}
```

### 8.3 フロントエンド側: イベントリスナー

```typescript
// src/ai/edit/stream-listener.ts

import { listen, type UnlistenFn } from '@tauri-apps/api/event';

interface StreamCallbacks {
  onChunk: (chunk: { delta: string; accumulated: string }) => void;
  onDone: (result: { content: string; inputTokens: number; outputTokens: number }) => void;
  onError: (message: string) => void;
}

async function listenAiStream(callbacks: StreamCallbacks): Promise<UnlistenFn[]> {
  const unlisteners = await Promise.all([
    listen<{ delta: string; accumulated: string }>('ai-stream-chunk', (e) => {
      callbacks.onChunk(e.payload);
    }),
    listen<{ content: string; input_tokens: number; output_tokens: number }>(
      'ai-stream-done',
      (e) => {
        callbacks.onDone({
          content: e.payload.content,
          inputTokens: e.payload.input_tokens,
          outputTokens: e.payload.output_tokens,
        });
      }
    ),
    listen<string>('ai-stream-error', (e) => {
      callbacks.onError(e.payload);
    }),
  ]);
  return unlisteners;
}
```

### 8.4 キャンセル

ストリーミング実行中の「キャンセル」ボタンで中断する。

```rust
// Rust 側: CancellationToken パターン
// start_ai_stream 実行時に stream_id を返し、
// cancel_ai_stream(stream_id) で HTTP 接続を切断する。

#[tauri::command]
pub async fn cancel_ai_stream(stream_id: String) -> Result<(), String> {
    // グローバルな HashMap<String, AbortHandle> から取得して abort
}
```

---

## 9. diff 表示と Accept/Reject

### 9.1 diff 表示方式

AI の出力が完了（またはストリーミング中）に、元テキストとの差分を表示する。

**方式: インライン diff（Cursor 方式）**

選択範囲の直下に diff プレビュー領域を展開する。
元テキストには取り消し線、新テキストにはハイライトを付ける。

```
  ドキュメント本文
  ─────────────────────────────────────
  これは元のテキストです。  ← 取り消し線（赤背景）
  これは修正後のテキストです。 ← ハイライト（緑背景）
  ─────────────────────────────────────
              [✓ Accept]  [✗ Reject]
```

### 9.2 diff 計算

文単位の diff を使用する（単語単位では日本語で精度が落ちる）。

```typescript
// src/ai/edit/diff.ts

interface DiffSegment {
  type: 'unchanged' | 'removed' | 'added';
  text: string;
}

function computeInlineDiff(
  original: string,
  modified: string
): DiffSegment[] {
  // 文単位で分割して LCS ベースの diff を計算
  // 日本語は句点「。」で分割
  // 英語はピリオド + スペースで分割
}
```

### 9.3 Accept/Reject の動作

| 操作 | 動作 |
|------|------|
| **Accept** | `editor.chain().focus().deleteRange(selection).insertContent(aiOutput).run()` を 1 トランザクションで実行 |
| **Reject** | diff プレビュー領域を閉じる。エディタは変更なし |
| **Esc** | Reject と同じ |

---

## 10. Undo/Redo 統合

### 10.1 基本方針

AI 編集の Accept を **1 つの Undo ステップ** として記録する。

```typescript
// Accept 時の実装
function acceptAiEdit(
  editor: Editor,
  from: number,
  to: number,
  aiOutput: string
): void {
  // 1 トランザクションで実行 → Undo 1回で元に戻る
  editor
    .chain()
    .focus()
    .deleteRange({ from, to })
    .insertContentAt(from, markdownToTipTap(aiOutput).content ?? [])
    .run();
}
```

Ctrl+Z で AI 編集前の状態に戻れる。これは CLAUDE.md の以下のルールに準拠:

> YAML Front Matter (CodeMirror) と本文 (TipTap) の Undo/Redo 履歴は「独立しているもの」として扱い、
> 無理に統合しようとしないでください。

AI 編集は本文（TipTap）のみを変更するため、TipTap の履歴で完結する。

---

## 11. ストレージ設計

### 11.1 ユーザーテンプレートの保存

```
$APPDATA/
  settings.json             ← 既存（API key、一般設定）
  ai-edit-templates.json    ← 新規（ユーザーカスタムテンプレート）
```

```typescript
// src/ai/edit/template-storage.ts

import { load } from '@tauri-apps/plugin-store';

const STORE_NAME = 'ai-edit-templates.json';
const STORE_KEY = 'templates';

export async function loadUserTemplates(): Promise<AiEditTemplate[]> {
  const store = await load(STORE_NAME);
  return (await store.get<AiEditTemplate[]>(STORE_KEY)) ?? [];
}

export async function saveUserTemplate(
  template: AiEditTemplate
): Promise<void> {
  const store = await load(STORE_NAME);
  const templates = (await store.get<AiEditTemplate[]>(STORE_KEY)) ?? [];

  template.id = template.id || `user-${crypto.randomUUID()}`;
  template.source = 'user';

  const idx = templates.findIndex(t => t.id === template.id);
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
    templates.filter(t => t.id !== id)
  );
  await store.save();
}
```

### 11.2 統合テンプレートリストの読み込み

```typescript
// src/ai/edit/template-registry.ts

import { BUILTIN_TEMPLATES } from './templates/builtin';
import { loadUserTemplates } from './template-storage';

export async function loadAllTemplates(): Promise<AiEditTemplate[]> {
  const user = await loadUserTemplates();
  return [...BUILTIN_TEMPLATES, ...user];
}
```

組み込みテンプレートが常に先、ユーザーテンプレートが後に並ぶ。

---

## 12. 設定 UI

### 12.1 API キー設定（既存の拡張）

```
設定 → AI

┌─────────────────────────────────────────────────────┐
│  AI 文章支援                                         │
├─────────────────────────────────────────────────────┤
│  ☑ AI 文章支援を有効にする                            │
│                                                     │
│  API プロバイダー: [Anthropic (Claude) ▼]             │
│  API キー:  [sk-ant-***************] [変更] [テスト]  │
│  モデル:    [claude-sonnet-4-5 ▼]                    │
│                                                     │
│  ⓘ テキストは設定した API キーを通じて外部サーバーに    │
│    送信されます。MarkWeave のサーバーは経由しません。    │
└─────────────────────────────────────────────────────┘
```

### 12.2 テンプレート管理

```
設定 → AI → テンプレート

┌─────────────────────────────────────────────────────┐
│  組み込みテンプレート                                  │
│  ✏️ 校正              (編集不可)  [複製して編集]      │
│  🔄 リライト           (編集不可)  [複製して編集]      │
│  📝 続きを書く         (編集不可)  [複製して編集]      │
│  📋 要約              (編集不可)  [複製して編集]      │
│  🌐 翻訳              (編集不可)  [複製して編集]      │
│─────────────────────────────────────────────────────│
│  カスタムテンプレート                                  │
│  ✏️ 校正（厳格モード）            [編集] [削除]       │
│  📝 Zenn記事の導入文生成           [編集] [削除]       │
│─────────────────────────────────────────────────────│
│  [+ 新規テンプレート]                                 │
└─────────────────────────────────────────────────────┘
```

### 12.3 テンプレート編集ダイアログ

```
┌──────────────────────────────────────────────────────┐
│  テンプレートを編集                               [×] │
├──────────────────────────────────────────────────────┤
│  名前:                                               │
│  ┌────────────────────────────────────────────────┐  │
│  │ 校正（厳格モード）                              │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ペルソナ:                                            │
│  ┌────────────────────────────────────────────────┐  │
│  │ 学術論文レベルの校正者です。文法の正確性を     │  │
│  │ 最優先し、曖昧な表現は必ず指摘します。         │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  タスク:                                              │
│  ┌────────────────────────────────────────────────┐  │
│  │ 選択テキストの文法・表記ミスを厳密に修正して   │  │
│  │ ください。                                     │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  制約:                                                │
│  ┌────────────────────────────────────────────────┐  │
│  │ - 元の文体を維持する                           │  │
│  │ - 技術用語は変更しない                         │  │
│  │ - 1文ごとに修正理由を括弧で付記する            │  │
│  └────────────────────────────────────────────────┘  │
│  ⓘ 1行 = 1制約。先頭の「- 」は自動で追加されます      │
│                                                      │
│  出力形式:                                            │
│  ┌────────────────────────────────────────────────┐  │
│  │ 修正後のテキストを出力してください。            │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│                        [キャンセル]  [保存]           │
└──────────────────────────────────────────────────────┘
```

---

## 13. メニュー・ショートカット統合

### 13.1 メニュー追加

`menu-inventory.md` に追加すべき項目:

| メニュー | アイテム | ショートカット | 条件 |
|---------|---------|-------------|------|
| 編集 | AI 編集... | Ctrl+Shift+I | BYOK 設定済み |
| 編集 | AI 校正 | — | BYOK 設定済み + テキスト選択時 |
| 編集 | AI リライト | — | BYOK 設定済み + テキスト選択時 |

### 13.2 コンテキストメニュー追加

テキスト選択時の右クリックメニューに:

```
コピー
切り取り
貼り付け
─────────
AI で編集...          Ctrl+Shift+I
AI 校正
AI リライト
AI 要約
AI 翻訳
```

### 13.3 Rust 側メニュー ID

```rust
// src-tauri/src/menu/native_menu.rs の mod ids に追加

pub const AI_EDIT: &str = "ai_edit";
pub const AI_PROOFREAD: &str = "ai_proofread";
pub const AI_REWRITE: &str = "ai_rewrite";
```

---

## 14. セキュリティ

### 14.1 既存のセキュリティ設計との整合

`security-design.md` §4.6 に準拠:

| 要件 | 対応 |
|------|------|
| WebView から外部 API を直接呼ばない | ストリーミングも Rust 経由。CSP `connect-src` 制限を維持 |
| API キーをフロントに渡さない | `start_ai_stream` は API キーを引数に取らない。Rust 側ストアから取得 |
| モデルのホワイトリスト | 既存 `ALLOWED_MODELS` を共有 |
| プロンプト長の上限 | `MAX_PROMPT_BYTES` を適用 |

### 14.2 追加のセキュリティ考慮事項

| リスク | 対策 |
|-------|------|
| AI 出力に悪意あるスクリプトが含まれる | AI 出力を Markdown としてパースし TipTap JSON に変換する既存パイプラインを通す。生 HTML は挿入しない |
| 参考資料として機密ファイルが送信される | 参考資料追加時にファイルパスを表示し、送信前に「X 件のファイルを API に送信します」確認ダイアログを表示 |
| ストリーミング中の中間状態リーク | ストリーミング中のテキストはエディタに直接挿入せず、プレビュー領域にのみ表示 |

---

## 15. 制約と非スコープ

### 15.1 本設計書の制約

| 制約 | 理由 |
|------|------|
| Anthropic と OpenAI のみ対応 | 既存 `ai_commands.rs` のホワイトリストに合わせる |
| ストリーミングは 1 セッション同時 1 本 | 複数同時ストリーミングは Rust 側の state 管理が複雑化するため v1 では制限 |
| 参考資料はテキストファイルのみ | 画像・PDF の解析は非スコープ |

### 15.2 将来拡張への布石

| 拡張 | 設計上の配慮 |
|------|------------|
| チャットパネル | `buildPrompt()` の出力形式が `{ system, user }` の message 配列に拡張可能 |
| 文書全体校正 | テンプレートの `autoSelect.requiresSelection = false` で全文対象のテンプレートを追加可能 |
| 新プロバイダー追加 | Rust 側の `stream_*` 関数を追加し `ALLOWED_MODELS` に追記するだけ |
| RAG（将来） | `PromptBuildContext.references` を手動選択からベクトル検索結果に差し替えるだけ。プロンプト構造は変わらない |

---

## 関連ドキュメント

| ファイル | 関連内容 |
|---------|---------|
| [ai-design.md](./ai-design.md) | 既存 AI コピー・テンプレートシステム（本設計書とは独立） |
| [tauri-ipc-interface.md](../../01_Architecture/tauri-ipc-interface.md) | `start_ai_stream` / `cancel_ai_stream` の型定義を追記する |
| [security-design.md](../../01_Architecture/security-design.md) | §4.6 AI API 外部通信のセキュリティ要件 |
| [keyboard-shortcuts.md](../../03_UI_UX/keyboard-shortcuts.md) | `Ctrl+Shift+I` の登録 |
| [menu-inventory.md](../../03_UI_UX/menu-inventory.md) | AI 編集メニュー項目の追加 |
| [editor-ux-design.md](../../03_UI_UX/editor-ux-design.md) | コンテキストメニュー拡張 |
| [user-settings-design.md](../../07_Platform_Settings/user-settings-design.md) | AI 設定 UI の定義 |
