# AI連携機能 設計ドキュメント

> プロジェクト: Markdown / HTML Editor - AI連携機能
> バージョン: 0.1
> 更新日: 2026-02-23

---

## 1. 背景と目的

生成AIの普及により、Markdownは「人間が書くドキュメント」から
**「AIに渡すインプット」** としての役割も担うようになった。

しかし現状では:
- LLMにMarkdownをそのまま貼り付けると、構造が不明瞭で精度が落ちる
- ChatGPT / Claude に渡すためのプロンプトを毎回ゼロから書くのが手間
- プロンプトのベストプラクティス（役割・タスク・制約・出力形式）を覚えていない

本機能はこれらを解決し、エディタを **「AI時代のドキュメント作成ツール」** に進化させる。

---

## 2. 機能一覧

### 2.1 AIコピーボタン（AI Optimized Copy）

編集中のMarkdownを **「AIが最も理解しやすい構造」** に自動調整し、
クリップボードにコピーするボタン。

```
[AIコピー ▼]
  ├─ 最適化してコピー（デフォルト）
  ├─ 最適化プレビューを表示してからコピー
  └─ 変更点レポートと一緒にコピー
```

**最適化の内容（後述）:**
- 見出し階層の修正
- コードブロックへの言語タグ付与
- リスト記号の統一
- 過剰な空白行の削除
- プロンプト構造の自動付与（必要な場合）
- リンクのテキスト化注記
- etc.

### 2.2 AIテンプレート

AIに渡すためのMarkdownをすぐに作成できる **テンプレート集**。
サイドバーまたはコマンドパレットから選択して挿入できる。

#### 標準搭載テンプレート

| カテゴリ | テンプレート名 | 概要 |
|---------|-------------|------|
| ブログ | ブログ構成案 | 記事のタイトル・章立て・キーメッセージを生成させる |
| コード | Pythonコード解説 | コードの動作・意図・改善点を説明させる |
| コード | コードレビュー依頼 | コードの品質・バグ・改善点をレビューさせる |
| 要約 | 要約用プロンプト | 長文テキストを指定フォーマットで要約させる |
| 推論 | 思考の連鎖（CoT） | ステップバイステップで問題を解かせる |
| 汎用 | 役割付きQ&A | 専門家として質問に答えさせる |
| 議事録 | 会議メモ整形 | 箇条書きメモを構造化された議事録に変換させる |
| 翻訳 | 技術文書翻訳 | 技術的ニュアンスを保った翻訳をさせる |

### 2.3 Markdown → HTML エクスポート（AI文脈での活用）

AI が生成した Markdown をそのまま HTML 記事として公開するワークフローを支援。

```
AI生成Markdown → エディタで編集 → HTMLエクスポート → Webサイト公開
```

---

## 3. AI最適化ロジック詳細

### 3.1 「AIが最も理解しやすい構造」とは

LLM（大規模言語モデル）の読解精度は、入力テキストの構造に大きく依存する。
以下の原則に基づいて最適化を行う。

| 原則 | 悪い例 | 良い例 |
|------|--------|--------|
| 明示 > 暗示 | 「例の関数を修正して」 | 「以下のPython関数 `calculate_tax()` を修正してください」 |
| 構造的 > 散文的 | 長い段落に全情報を詰める | 見出し・リスト・コードブロックで整理 |
| 具体的 > 曖昧 | 「良い感じに」 | 「50文字以内・箇条書き・日本語で」 |
| 階層的 > 平坦 | H1 → H4 と飛ばす | H1 → H2 → H3 と順序良く |
| クリーン > ノイジー | 装飾的な罫線や絵文字 | セマンティックな内容のみ |

### 3.2 変換処理一覧

```
OptimizationPipeline:
  1. normalizeHeadings()        見出し階層の修正（H1→H4 の飛びを補正）
  2. annotateCodeBlocks()       コードブロックへの言語タグ付与
  3. normalizeListMarkers()     リスト記号の統一（- に統一）
  4. trimExcessiveWhitespace()  連続空行を最大1行に削減
  5. annotateLinks()            外部リンクにURL文字列を明記
  6. collapseInlineStyles()     HTML混在のインラインスタイルを除去
  7. detectPromptStructure()    プロンプト構造の自動検出・付与
  8. normalizeCodeFences()      コードフェンスを``` ``` に統一
```

### 3.3 プロンプト構造の自動検出・付与

ドキュメントに「役割」「タスク」「制約」「出力形式」のいずれかが欠けていた場合、
RTICCO（Role / Task / Input / Context / Constraints / Output）フォーマットを提案する。

```
検出ロジック:
  ドキュメント全体をスキャン
    └─ H1〜H2 見出し名に以下のキーワードがあるかチェック
         役割 / Role / タスク / Task / 制約 / Constraints / 出力 / Output
    └─ 検出数 < 2 の場合 → プロンプト構造付与を提案（強制しない）

付与する構造（不足している項目のみ）:
  ## 役割 (Role)
  ## タスク (Task)
  ## コンテキスト (Context)
  ## 入力 (Input)
  ## 制約 (Constraints)
  ## 出力形式 (Output Format)
```

### 3.4 変更点レポート

最適化後に「何をどう変えたか」を表示する。

```
AIコピー最適化レポート
━━━━━━━━━━━━━━━━━━━━━
✅ 見出し階層を修正: H1 → H4 の飛びを H1 → H2 → H3 に補正（2箇所）
✅ コードブロックに言語タグを付与: python（1箇所）、bash（1箇所）
✅ リスト記号を統一: * → - （5箇所）
✅ 過剰な空白行を削除（3箇所）
⚠️  プロンプト構造が不完全: 「制約」「出力形式」が未定義
    → テンプレートから追加しますか？ [はい] [スキップ]
━━━━━━━━━━━━━━━━━━━━━
最適化後: 1,240文字（元: 1,312文字）
```

---

## 4. テンプレートシステム詳細

### 4.1 テンプレートの構造

```typescript
interface AiTemplate {
  id: string;
  name: string;               // 表示名
  description: string;        // 概要説明
  category: TemplateCategory;
  tags: string[];
  content: string;            // プレースホルダー入りMarkdown
  placeholders: Placeholder[];
}

interface Placeholder {
  key: string;        // テンプレート内の {{KEY}} と対応
  label: string;      // ダイアログでの表示ラベル
  description: string;
  type: 'text' | 'textarea' | 'select' | 'code';
  defaultValue?: string;
  options?: string[]; // select の場合の選択肢
  required: boolean;
}
```

### 4.2 テンプレートのプレースホルダー構文

テンプレート内では `{{KEY}}` 形式のプレースホルダーを使用する。

```markdown
## タスク (Task)
以下の{{LANGUAGE}}コードを解説してください。

## 入力 (Input)
```{{LANGUAGE}}
{{CODE}}
```

## 出力形式 (Output Format)
- 概要（{{MAX_LINES}}行以内）
- 処理の流れ（ステップ別）
- 改善提案（あれば）
```

### 4.3 テンプレート選択UI

```
┌─────────────────────────────────────────────┐
│  AI テンプレート                        [×]  │
├─────────────────────────────────────────────┤
│  [ブログ] [コード] [要約] [推論] [汎用] [全て]│
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐ │
│  │ ブログ構成案                             │ │
│  │ 記事のタイトル・章立てをAIに生成させる   │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │ Pythonコード解説                         │ │
│  │ コードの動作・意図・改善点を説明させる   │ │
│  └─────────────────────────────────────────┘ │
│  ...                                         │
├─────────────────────────────────────────────┤
│  プレビュー                                  │
│  ─────────────────────────────────────────  │
│  # ブログ記事構成依頼                        │
│  ## 役割...                                  │
├─────────────────────────────────────────────┤
│  [カーソル位置に挿入]  [ドキュメント全体に適用]│
└─────────────────────────────────────────────┘
```

---

## 5. ユーザーフロー

### フロー1: AIコピーボタン

```
1. ユーザーがMarkdownを編集
2. ツールバーの [AIコピー] ボタンをクリック
3. AIオプティマイザが実行
4. 変更点レポートがポップオーバーで表示（オプション）
5. 最適化済みMarkdownがクリップボードにコピー
6. "コピーしました！" トースト通知
7. ユーザーがChatGPT/Claude等にペースト
```

### フロー2: テンプレートから始める

```
1. ユーザーがサイドバーの [AI テンプレート] をクリック
2. テンプレートブラウザが開く
3. テンプレートを選択 → プレビュー確認
4. [挿入] をクリック → プレースホルダー入力ダイアログ
5. 各フィールドを入力して [OK]
6. 完成したプロンプトがエディタに挿入される
7. 追加編集 → [AIコピー] でクリップボードへ
```

### フロー3: ドキュメントからプロンプトへ

```
1. 既存のMarkdownドキュメントを開く
2. [AIコピー ▼] → [最適化プレビューを表示]
3. Before / After 比較ビューで変更点確認
4. 不要な変換をオフに設定
5. [この設定でコピー]
```

---

## 6. 技術選定

| 用途 | 採用技術 | 理由 |
|------|---------|------|
| Markdown AST解析 | remark (mdast) | 既存パーサの流用 |
| コードブロック言語推定 | `linguist-languages` / ヒューリスティック | 言語タグのないコードを推定 |
| クリップボードAPI | `navigator.clipboard.writeText()` | Web標準API |
| テンプレートエンジン | 自作（`{{KEY}}` 置換） | 軽量・依存なし |

---

## 7. 設計課題と解決方針

### 7.1 言語タグ自動推定のフォールバック戦略

コードブロックの言語タグ推定は精度に限界があるため、段階的フォールバックで対処する。

```typescript
// src/core/ai/code-lang-detector.ts

/**
 * コードブロックの言語タグを推定する。
 * 確信度が低い場合は空文字列（タグなし）を返す。
 */
export function detectLanguage(code: string): string {
  // Step 1: 特徴語マッチング（精度 > 90%）
  const byFeature = detectByFeatures(code);
  if (byFeature.confidence >= 0.9) return byFeature.lang;

  // Step 2: ファイル拡張子ヒント（ファイル名文脈がある場合）
  const byContext = detectByFileContext();
  if (byContext) return byContext;

  // Step 3: 確信度が低い場合は空文字列を返す（誤タグより無タグが安全）
  return '';
  // ← UI 側で「言語不明」バッジを表示し、ユーザーが手動で指定できるようにする
}

/** 言語ごとの特徴語リスト（精度重視で厳しめに設定） */
const LANGUAGE_SIGNATURES: Record<string, RegExp[]> = {
  typescript: [/:\s*(string|number|boolean|void|any)\b/, /interface\s+\w+/, /=>\s*\{/],
  rust:       [/fn\s+\w+\(/, /let\s+mut\s+/, /impl\s+\w+/],
  python:     [/^def\s+\w+\(/m, /^import\s+\w+/m, /print\(/],
  sql:        [/\bSELECT\b.*\bFROM\b/i, /\bINSERT\s+INTO\b/i],
  // ... 他言語
};
```

**UI フォールバック**:
```tsx
// コードブロック NodeView での表示
<div className="code-block">
  <span className="lang-badge">
    {lang || <span className="lang-unknown" title="言語を手動指定してください">不明</span>}
  </span>
  <code>{content}</code>
</div>
```

### 7.2 プロンプト構造検出の誤検知防止

「RTICCO フォーマット不足の提案」機能は、通常ドキュメントを誤検知しないよう保守的に設定する。

```typescript
// 検出条件: 以下の全てを満たす場合のみプロンプトと判断する
const isLikelyPrompt = (doc: MdastRoot): boolean => {
  const headings = extractHeadings(doc);

  // 条件1: 見出しが 3〜10 個（少なすぎると通常文書、多すぎると長文文書）
  if (headings.length < 3 || headings.length > 10) return false;

  // 条件2: AI 指示語キーワードが 2 個以上（1個では誤検知リスク大）
  const AI_KEYWORDS = ['役割', 'タスク', '制約', '出力', '指示', 'role', 'task', 'output'];
  const matchCount = headings.filter(h =>
    AI_KEYWORDS.some(kw => h.toLowerCase().includes(kw.toLowerCase()))
  ).length;
  if (matchCount < 2) return false;

  // 条件3: コードブロックのみのドキュメントはプロンプトではない
  const textNodeCount = countTextNodes(doc);
  if (textNodeCount < 50) return false; // 50文字未満はスキップ

  return true;
};

// → 検出した場合も「強制変換」でなく「提案ダイアログ」を表示する
```

### 7.3 カスタムテンプレートの保存設計

ユーザーが作成したテンプレートを `$APP_DATA/templates/` に保存する。

```
$APP_DATA/
  templates/
    builtin/           ← アプリ同梱テンプレート（読み取り専用）
      code-review.md
      bug-report.md
    user/              ← ユーザー作成テンプレート（読み書き可能）
      my-template-1.md
      my-template-2.md
    index.json         ← テンプレート一覧（名前・説明・カテゴリ）のメタデータ
```

```typescript
// テンプレートのメタデータ（YAML フロントマター）
---
title: "コードレビュー依頼"
category: "development"
description: "コードレビューを AI に依頼するためのテンプレート"
placeholders:
  - key: LANGUAGE
    type: select
    label: "プログラミング言語"
    options: ["TypeScript", "Rust", "Python", "Go"]
  - key: CODE
    type: code
    label: "レビュー対象コード"
---

# 役割 (Role)
あなたはシニアの {{LANGUAGE}} エンジニアです。

# タスク (Task)
以下のコードをレビューしてください。

```{{LANGUAGE}}
{{CODE}}
```
```

```typescript
// src/core/ai/template-manager.ts

export class TemplateManager {
  private readonly templatesDir: string;

  async listTemplates(): Promise<TemplateMetadata[]> {
    // builtin/ と user/ を結合して返す
  }

  async saveUserTemplate(name: string, content: string): Promise<void> {
    const sanitizedName = name.replace(/[^a-z0-9-_]/gi, '_');
    const path = `${this.templatesDir}/user/${sanitizedName}.md`;
    await writeTextFile(path, content);
    await this.rebuildIndex(); // index.json を更新
  }

  async deleteUserTemplate(name: string): Promise<void> {
    // builtin テンプレートは削除不可
    if (name.startsWith('builtin/')) {
      throw new Error('組み込みテンプレートは削除できません');
    }
    await removeFile(`${this.templatesDir}/user/${name}.md`);
    await this.rebuildIndex();
  }
}
```

### 7.4 最適化パイプラインの実行順序の根拠

`OptimizationPipeline` の各ステップは **依存関係順** に実行する。順序を変えると結果が変わる。

```typescript
// 正しい順序と依存関係
const pipeline: OptimizationStep[] = [
  // Step 1: 見出し正規化（最初に実行: 以降のステップが見出し構造に依存するため）
  normalizeHeadings,

  // Step 2: コードブロック言語タグ付与（Step 1 後: 見出し下のコードブロックをコンテキストで判定）
  annotateCodeBlocks,

  // Step 3: リスト記号統一（Step 1/2 に依存しないが早めに実行）
  normalizeListMarkers,

  // Step 4: 空行の正規化（コードブロック内の空行は保護する必要があるため Step 2 後）
  normalizeBlankLines,

  // Step 5: テキスト修飾（最後: 構造が確定した後でインライン処理）
  normalizeInlineFormatting,

  // Step 6: プロンプト構造の提案（最後: 全体構造が確定した後で提案する）
  suggestPromptStructure,
];
```

**順序を変えると壊れるケース**:

| 順序違反 | 問題 |
|---|---|
| Step 4（空行正規化）を Step 2 より先に実行 | コードブロック内の空行が除去されてしまう |
| Step 5（インライン修飾）を Step 1 より先に実行 | `# **太字見出し**` の `**` が誤処理される |
| Step 6（構造提案）を Step 1 より先に実行 | 見出し正規化前の「壊れた構造」を提案の入力にしてしまう |

---

## 8. エディタ統合 API（AI パネル ↔ エディタ）

AI パネルとエディタは **イベントバス** 経由で疎結合に通信する。
直接インスタンス参照は避ける（テスタビリティとモジュール独立性のため）。

### 8.1 AI パネルからエディタへの操作

```typescript
// src/core/ai/editor-bridge.ts

/**
 * AI パネルがエディタを操作するためのブリッジ。
 * TipTap の editor インスタンスを直接持ち回らず、コマンドとして定義する。
 */
export interface EditorAiBridge {
  /**
   * 現在のドキュメントを最適化済み Markdown 文字列として取得する。
   * IME composition 中は null を返す（markdown-tiptap-conversion.md §9 参照）。
   */
  getOptimizedMarkdown(): string | null;

  /**
   * Markdown 文字列をカーソル位置（または末尾）に挿入する。
   * TipTap の markdownToTipTap() でパースして挿入する。
   */
  insertMarkdown(markdown: string, position?: 'cursor' | 'end'): void;

  /**
   * 現在の選択範囲のテキストを取得する。
   * 選択なしの場合は空文字列を返す。
   */
  getSelectedText(): string;

  /**
   * 現在の選択範囲を指定した Markdown で置換する。
   * 選択なしの場合は何もしない。
   */
  replaceSelection(markdown: string): void;

  /**
   * AI 処理中であることをエディタに通知する。
   * エディタは入力を一時的に無効化しない（楽観的 UI を維持）。
   */
  setAiProcessing(isProcessing: boolean): void;
}
```

### 8.2 実装（TipTap コマンドベース）

```typescript
// src/renderer/wysiwyg/ai-bridge-impl.ts

import { Editor } from '@tiptap/react';
import { markdownToTipTap } from '../../core/converter/markdown-to-tiptap';
import { tiptapToMarkdown } from '../../core/converter/tiptap-to-markdown';
import { optimizeForAi } from '../../core/ai/optimizer';

export function createEditorAiBridge(editor: Editor): EditorAiBridge {
  return {
    getOptimizedMarkdown(): string | null {
      // IME 中は null（markdown-tiptap-conversion.md §9 参照）
      if (editor.storage.compositionGuard?.isComposing) return null;

      const raw = tiptapToMarkdown(editor.getJSON());
      return optimizeForAi(raw);
    },

    insertMarkdown(markdown: string, position: 'cursor' | 'end' = 'cursor'): void {
      const json = markdownToTipTap(markdown);
      const content = json.content ?? [];

      if (position === 'end') {
        // 末尾に追加
        editor.commands.setTextSelection(editor.state.doc.content.size);
      }
      // insertContentAt でカーソル位置に挿入
      editor.commands.insertContent(content);
    },

    getSelectedText(): string {
      const { from, to, empty } = editor.state.selection;
      if (empty) return '';
      return editor.state.doc.textBetween(from, to, '\n');
    },

    replaceSelection(markdown: string): void {
      const { empty } = editor.state.selection;
      if (empty) return;

      const json = markdownToTipTap(markdown);
      editor.commands.insertContent(json.content ?? []);
    },

    setAiProcessing(isProcessing: boolean): void {
      // AI 処理中のビジュアルフィードバック（ツールバーのスピナー等）
      editor.emit('aiProcessing', { isProcessing });
    },
  };
}
```

### 8.3 AI パネルの呼び出しフロー

```typescript
// src/components/AiPanel/AiPanel.tsx

export function AiPanel({ bridge }: { bridge: EditorAiBridge }) {
  const handleCopyClick = async () => {
    const md = bridge.getOptimizedMarkdown();
    if (md === null) {
      toast.warning('日本語入力確定後に操作してください');
      return;
    }

    await navigator.clipboard.writeText(md);
    toast.success('AIコピー完了');
  };

  const handleInsertTemplate = async (template: Template) => {
    const filled = await openPlaceholderDialog(template);
    if (filled === null) return; // キャンセル

    bridge.setAiProcessing(true);
    bridge.insertMarkdown(filled, 'cursor');
    bridge.setAiProcessing(false);
  };

  // AI API を直接呼ぶ場合（Phase 3 以降）
  const handleAiComplete = async () => {
    bridge.setAiProcessing(true);
    try {
      const selected = bridge.getSelectedText();
      const response = await callAiApi({
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        prompt: selected,
        maxTokens: 2048,
      });
      bridge.replaceSelection(response.content);
    } finally {
      bridge.setAiProcessing(false);
    }
  };

  return (
    <aside className="ai-panel">
      <button onClick={handleCopyClick}>AIコピー</button>
      {/* ... */}
    </aside>
  );
}
```

### 8.4 テスト可能性の確保

`EditorAiBridge` インターフェースを介することで、AI パネルの単体テストが容易になる。

```typescript
// tests/unit/AiPanel.test.tsx

const mockBridge: EditorAiBridge = {
  getOptimizedMarkdown: vi.fn().mockReturnValue('# Test\n\nContent\n'),
  insertMarkdown: vi.fn(),
  getSelectedText: vi.fn().mockReturnValue('selected text'),
  replaceSelection: vi.fn(),
  setAiProcessing: vi.fn(),
};

test('AIコピーボタンでクリップボードにコピーされる', async () => {
  render(<AiPanel bridge={mockBridge} />);
  await userEvent.click(screen.getByText('AIコピー'));
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('# Test\n\nContent\n');
});

test('IME composition 中はコピーをブロックする', async () => {
  mockBridge.getOptimizedMarkdown = vi.fn().mockReturnValue(null);
  render(<AiPanel bridge={mockBridge} />);
  await userEvent.click(screen.getByText('AIコピー'));
  expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
});
```

---

*このドキュメントはAI連携機能の設計方針を示すものであり、実装進行に伴い更新される。*
