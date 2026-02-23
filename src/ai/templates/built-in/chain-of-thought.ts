/**
 * chain-of-thought.ts
 *
 * テンプレート: 思考の連鎖（Chain of Thought）
 * AIにステップバイステップで問題を解かせるCoTプロンプト。
 * 複雑な問題・論理的推論・数学的問題に特に有効。
 */

import type { AiTemplate } from '../template-registry';

export const chainOfThoughtTemplate: AiTemplate = {
  id: 'chain-of-thought',
  name: '思考の連鎖（CoT）',
  description: 'AIにステップバイステップで考えさせることで、複雑な問題の精度を上げます',
  category: 'reasoning',
  tags: ['CoT', '推論', '思考', '分析', 'ステップバイステップ', '問題解決'],
  placeholders: [
    {
      key: 'PROBLEM',
      label: '問題・質問',
      description: 'AIに解かせたい問題や質問を詳しく記述してください',
      type: 'textarea',
      required: true,
    },
    {
      key: 'DOMAIN',
      label: '問題の領域',
      description: '問題のジャンル・専門分野',
      type: 'select',
      options: ['数学・計算', 'プログラミング・アルゴリズム', 'ビジネス・戦略', '科学・技術', '論理・パズル', '法律・倫理', '汎用'],
      defaultValue: '汎用',
      required: false,
    },
    {
      key: 'CONSTRAINTS',
      label: '制約・条件',
      description: '問題を解く上での制約や前提条件（あれば）',
      type: 'textarea',
      defaultValue: '（制約なし）',
      required: false,
    },
  ],
  content: `# 段階的思考による問題解決依頼

## 役割 (Role)

あなたは{{DOMAIN}}の専門家であり、複雑な問題を論理的に段階分解して解決することが得意です。

## タスク (Task)

以下の問題について、**ステップバイステップで思考プロセスを示しながら**解答してください。

> 重要: 最終答えに飛びつかず、必ず思考過程を明示すること。

## 問題 (Input)

{{PROBLEM}}

## 条件・制約 (Constraints)

{{CONSTRAINTS}}

## 出力形式 (Output Format)

### Step 1: 問題の理解・分解
- 問題の核心は何か
- どんな情報が与えられているか
- 何を求めるのか

### Step 2: アプローチの選択
- 考えられるアプローチとその比較
- 選択したアプローチとその理由

### Step 3: 実行・計算・推論
[詳細なステップを順番に記述]

### Step 4: 検証
- 結果が正しいか確認
- 別の方法での検証（可能な場合）
- エッジケースの確認

### 最終回答
**結論**: [明確な最終回答]
**信頼度**: [高/中/低] と理由
`,
};
