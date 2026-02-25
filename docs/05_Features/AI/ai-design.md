# AI 連携機能設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.1
> 更新日: 2026-02-25

---

## 目次

1. [背景と目的](#1-背景と目的)
2. [機能一覧](#2-機能一覧)
3. [AI 最適化ロジック詳細](#3-ai-最適化ロジック詳細)
4. [テンプレートシステム詳細](#4-テンプレートシステム詳細)
5. [ユーザーフロー](#5-ユーザーフロー)
6. [技術選定](#6-技術選定)
7. [設計課題と解決方針](#7-設計課題と解決方針)
8. [エディタ統合 API（AI パネル ↔ エディタ）](#8-エディタ統合-apiai-パネル--エディタ)
9. [言語検出精度改善](#9-言語検出精度改善)
10. [カスタムテンプレート管理 UI](#10-カスタムテンプレート管理-ui)
11. [AI 文章支援機能（将来拡張）](#11-ai-文章支援機能将来拡張)

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

## 3. AI 最適化ロジック詳細

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
  normalizeHeadings,       // Step 1: 見出し正規化（最初に実行）
  annotateCodeBlocks,      // Step 2: コードブロック言語タグ付与（Step 1 後）
  normalizeListMarkers,    // Step 3: リスト記号統一
  normalizeBlankLines,     // Step 4: 空行の正規化（コードブロック内保護のため Step 2 後）
  normalizeInlineFormatting, // Step 5: テキスト修飾（構造確定後）
  suggestPromptStructure,  // Step 6: プロンプト構造の提案（全体確定後）
];
```

---

## 8. エディタ統合 API（AI パネル ↔ エディタ）

AI パネルとエディタは **イベントバス** 経由で疎結合に通信する。

### 8.1 AI パネルからエディタへの操作

```typescript
// src/core/ai/editor-bridge.ts

export interface EditorAiBridge {
  getOptimizedMarkdown(): string | null;
  insertMarkdown(markdown: string, position?: 'cursor' | 'end'): void;
  getSelectedText(): string;
  replaceSelection(markdown: string): void;
  setAiProcessing(isProcessing: boolean): void;
}
```

### 8.2 実装（TipTap コマンドベース）

```typescript
// src/renderer/wysiwyg/ai-bridge-impl.ts

export function createEditorAiBridge(editor: Editor): EditorAiBridge {
  return {
    getOptimizedMarkdown(): string | null {
      if (editor.storage.compositionGuard?.isComposing) return null;
      const raw = tiptapToMarkdown(editor.getJSON());
      return optimizeForAi(raw);
    },

    insertMarkdown(markdown: string, position: 'cursor' | 'end' = 'cursor'): void {
      const json = markdownToTipTap(markdown);
      if (position === 'end') {
        editor.commands.setTextSelection(editor.state.doc.content.size);
      }
      editor.commands.insertContent(json.content ?? []);
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
  // ...
}
```

### 8.4 テスト可能性の確保

```typescript
// tests/unit/AiPanel.test.tsx

const mockBridge: EditorAiBridge = {
  getOptimizedMarkdown: vi.fn().mockReturnValue('# Test\n\nContent\n'),
  insertMarkdown: vi.fn(),
  getSelectedText: vi.fn().mockReturnValue('selected text'),
  replaceSelection: vi.fn(),
  setAiProcessing: vi.fn(),
};

test('IME composition 中はコピーをブロックする', async () => {
  mockBridge.getOptimizedMarkdown = vi.fn().mockReturnValue(null);
  render(<AiPanel bridge={mockBridge} />);
  await userEvent.click(screen.getByText('AIコピー'));
  expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
});
```

---

## 9. 言語検出精度改善

### 9.1 現状と課題

現在の実装（`franc` ライブラリ）では CJK（中国語・日本語・韓国語）の区別精度が低い。
日本語テキストを中国語と誤検出するケースがある。

### 9.2 改善方針

**Unicode スクリプト分析による優先判定:**

```typescript
// src/i18n/language-detector.ts

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
    const { franc } = await import('franc');
    const detected = franc(text, { minLength: 10 });
    return detected === 'cmn' || detected === 'yue' ? 'zh' : 'ja';
  }

  const { franc } = await import('franc');
  const iso3 = franc(text, { minLength: 10 });
  return iso3ToIso1(iso3) ?? 'en';
}

function iso3ToIso1(iso3: string): string | null {
  const map: Record<string, string> = {
    eng: 'en', jpn: 'ja', zho: 'zh', cmn: 'zh',
    kor: 'ko', deu: 'de', fra: 'fr', spa: 'es',
  };
  return map[iso3] ?? null;
}
```

### 9.3 言語検出の用途

| 機能 | 言語検出の利用方法 |
|------|-----------------|
| スペルチェック | 検出言語に対応した辞書を自動ロード |
| 数字・日付フォーマット | ロケール設定の参照 |
| AI 支援（将来）| プロンプト言語の自動設定 |
| ステータスバー | 「言語: 日本語」表示 |

### 9.4 手動言語設定

```
ステータスバー → 言語表示クリック → メニュー:
  ● 自動検出（現在: 日本語）
  ─────────────────
  ○ 日本語
  ○ 英語
  ○ 中国語（簡体）
  ○ 韓国語
```

---

## 10. カスタムテンプレート管理 UI

### 10.1 テンプレートの種類

| テンプレート種類 | 説明 |
|----------------|------|
| ドキュメントテンプレート | 新規ファイル作成時の初期コンテンツ（YAML Front Matter + ボイラープレート） |
| AI プロンプトテンプレート | AI 支援機能で使用するカスタムプロンプト文字列 |
| エクスポートテンプレート | Word/LaTeX 向けの reference.docx / .tex テンプレート |

### 10.2 ドキュメントテンプレート管理

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

### 10.3 テンプレートの永続化

```typescript
interface DocumentTemplate {
  id: string;          // UUID
  name: string;
  content: string;
  createdAt: string;   // ISO 8601
  updatedAt: string;
}

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

### 10.4 テンプレートからの新規ファイル作成

```
Ctrl+N 長押し または メニュー → ファイル → テンプレートから新規作成

→ テンプレート選択ポップアップ:
  ┌─────────────────────────────────┐
  │  テンプレートを選択              │
  │  📄 ブログ記事                  │
  │  📄 技術仕様書                  │
  │  📄 会議議事録                  │
  │  📄 空のファイル（テンプレートなし）│
  └─────────────────────────────────┘
```

---

## 11. AI 文章支援機能（将来拡張）

### 11.1 Phase 7 以降の AI 機能候補

> **Note:** Phase 6 以前では実装しない。API キー管理とプライバシーポリシーの整備が前提。

| 機能 | 概要 |
|------|------|
| 文章校正 | 選択テキストの誤字・文法チェック |
| 要約生成 | ドキュメント全体の要約をサイドパネルに表示 |
| タイトル/見出し提案 | セクション内容から見出しを自動提案 |
| 翻訳 | 選択テキストを指定言語に翻訳して挿入 |

### 11.2 AI 機能の設計方針

- **オプトイン**: AI 機能は明示的に有効化が必要
- **API キー管理**: OS キーチェーン（Tauri Keyring プラグイン）に暗号化保存
- **プロンプトの透明性**: 使用するプロンプトをユーザーが確認・編集可能
- **オフライン優先**: ネットワーク不要な機能（スペルチェック等）を優先

### 11.3 API キー設定 UI（Phase 7 設計案）

```
設定 → AI 機能

┌─────────────────────────────────────────────────────┐
│  AI 文章支援                                         │
├─────────────────────────────────────────────────────┤
│  □ AI 文章支援を有効にする                           │
│  API プロバイダー: [OpenAI ▼]                        │
│  API キー: [ ****************************  ] [変更]  │
│  □ 選択テキストに右クリックメニューで AI オプション表示│
│  プライバシー: テキストは処理のため外部 API に送信    │
│  されます。機密情報の取り扱いにご注意ください。        │
└─────────────────────────────────────────────────────┘
```

---

## 関連ドキュメント

- [user-settings-design.md](../07_Platform_Settings/user-settings-design.md) — 設定の保存・管理
- [text-statistics-design.md](../../02_Core_Editor/text-statistics-design.md) — スペルチェック・統計機能
- [community-design.md](../07_Platform_Settings/community-design.md) — プライバシーポリシー・テレメトリ
- [export-interop-design.md](../../06_Export_Interop/export-interop-design.md) — HTML/PDF エクスポートパイプライン
