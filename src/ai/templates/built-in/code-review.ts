/**
 * code-review.ts
 *
 * テンプレート: コードレビュー依頼
 * コードの品質・バグ・設計・セキュリティをAIにレビューさせるプロンプト。
 */

import type { AiTemplate } from '../template-registry';

export const codeReviewTemplate: AiTemplate = {
  id: 'code-review',
  name: 'コードレビュー依頼',
  description: 'コードの品質・バグ・セキュリティ・設計をAIに多角的にレビューさせます',
  category: 'code',
  tags: ['コードレビュー', 'バグ', '品質', 'セキュリティ', 'リファクタリング'],
  placeholders: [
    {
      key: 'LANGUAGE',
      label: 'プログラミング言語',
      description: 'レビュー対象コードの言語',
      type: 'select',
      options: ['Python', 'TypeScript', 'JavaScript', 'Go', 'Rust', 'Java', 'C++', 'その他'],
      defaultValue: 'Python',
      required: true,
    },
    {
      key: 'CODE',
      label: 'レビュー対象コード',
      description: 'レビューさせたいコードを貼り付けてください',
      type: 'code',
      required: true,
    },
    {
      key: 'PURPOSE',
      label: 'コードの目的・要件',
      description: 'このコードが達成すべきこと、満たすべき要件',
      type: 'textarea',
      defaultValue: '（特記事項なし）',
      required: false,
    },
    {
      key: 'FOCUS',
      label: 'レビューの重点',
      description: '特に重点的にチェックしてほしい観点（複数可）',
      type: 'select',
      options: ['総合的（全観点）', 'バグ・ロジックエラー優先', 'セキュリティ優先', 'パフォーマンス優先', '可読性・保守性優先'],
      defaultValue: '総合的（全観点）',
      required: false,
    },
  ],
  content: `# コードレビュー依頼

## 役割 (Role)

あなたは{{LANGUAGE}}のシニアエンジニアであり、コードレビューの専門家です。
バグ・セキュリティ・設計・パフォーマンスの観点から鋭い指摘ができます。

## タスク (Task)

以下の{{LANGUAGE}}コードをレビューしてください。

## レビュー対象コード (Input)

\`\`\`{{LANGUAGE}}
{{CODE}}
\`\`\`

## コンテキスト (Context)

- **コードの目的・要件**: {{PURPOSE}}
- **レビューの重点**: {{FOCUS}}

## 制約 (Constraints)

- 指摘には必ず具体的な改善案をコードで示す
- 良い点も最低1つ挙げる（バランスのあるフィードバック）
- 重大度を明示する（🔴 致命的 / 🟡 改善推奨 / 🟢 軽微）
- 行番号があれば参照する

## 出力形式 (Output Format)

### 総合評価
[A（優秀）〜E（要改善）の5段階と一言コメント]

### 良い点
- 良い点1
- 良い点2

### 問題点と改善提案

#### 🔴 致命的な問題
[問題のコード引用と改善後のコード]

#### 🟡 改善推奨
[問題のコード引用と改善後のコード]

#### 🟢 軽微な提案
[提案内容]

### 改善後のコード全体（任意）
[問題を修正した完全なコード]
`,
};
