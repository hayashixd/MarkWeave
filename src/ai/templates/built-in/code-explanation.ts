/**
 * code-explanation.ts
 *
 * テンプレート: Pythonコード解説
 * コードの動作・意図・改善点をAIに説明させるプロンプト。
 * Python以外の言語にも対応（デフォルトはPython）。
 */

import type { AiTemplate } from '../template-registry';

export const codeExplanationTemplate: AiTemplate = {
  id: 'code-explanation',
  name: 'コード解説',
  description: 'コードの動作・意図・改善点をAIに詳しく解説させます',
  category: 'code',
  tags: ['コード', '解説', 'Python', 'プログラミング', 'レビュー', 'デバッグ'],
  placeholders: [
    {
      key: 'LANGUAGE',
      label: 'プログラミング言語',
      description: '解説させるコードの言語',
      type: 'select',
      options: ['Python', 'TypeScript', 'JavaScript', 'Go', 'Rust', 'Java', 'C++', 'SQL', 'その他'],
      defaultValue: 'Python',
      required: true,
    },
    {
      key: 'CODE',
      label: 'コード',
      description: '解説させたいコードを貼り付けてください',
      type: 'code',
      required: true,
    },
    {
      key: 'CONTEXT',
      label: 'コードの用途・背景',
      description: 'このコードが何のためのものか、背景があれば入力してください',
      type: 'textarea',
      defaultValue: '（背景情報なし）',
      required: false,
    },
    {
      key: 'DETAIL_LEVEL',
      label: '解説の詳細度',
      description: '解説の詳しさを選択してください',
      type: 'select',
      options: ['初心者向け（基礎から丁寧に）', '中級者向け（主要な処理に集中）', '上級者向け（パフォーマンス・設計まで）'],
      defaultValue: '中級者向け（主要な処理に集中）',
      required: false,
    },
  ],
  content: `# コード解説依頼

## 役割 (Role)

あなたは{{LANGUAGE}}に精通したシニアエンジニアです。
コードを分かりやすく解説し、改善点を提案することが得意です。

## タスク (Task)

以下の{{LANGUAGE}}コードを解説してください。

## 入力コード (Input)

\`\`\`{{LANGUAGE}}
{{CODE}}
\`\`\`

## コンテキスト (Context)

- **コードの用途・背景**: {{CONTEXT}}
- **解説の詳細度**: {{DETAIL_LEVEL}}

## 制約 (Constraints)

- 専門用語には補足説明を加える
- コードブロックには言語タグを付ける
- 改善提案は理由とともに示す
- セキュリティ上の問題があれば必ず指摘する

## 出力形式 (Output Format)

以下の構成で回答してください:

### 1. 概要（3行以内）
このコードが何をするものかを簡潔に説明する。

### 2. 処理の流れ
ステップごとに処理の流れを説明する（番号付きリスト）。

### 3. 重要な部分の解説
特に注目すべき行・関数・アルゴリズムをコード引用とともに解説する。

### 4. 改善提案（あれば）
バグ・パフォーマンス・可読性・セキュリティの観点から改善案をコードで示す。

### 5. まとめ
一言でこのコードの評価を述べる。
`,
};
