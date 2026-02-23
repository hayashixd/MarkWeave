/**
 * summarization.ts
 *
 * テンプレート: 要約用プロンプト
 * 長文テキストを指定フォーマットで要約させるプロンプト。
 */

import type { AiTemplate } from '../template-registry';

export const summarizationTemplate: AiTemplate = {
  id: 'summarization',
  name: '要約用プロンプト',
  description: '長文テキストを指定したフォーマット・長さ・観点で要約させます',
  category: 'summary',
  tags: ['要約', 'サマリー', '整理', 'まとめ', '抽出'],
  placeholders: [
    {
      key: 'TEXT',
      label: '要約するテキスト',
      description: '要約させたい長文テキストを貼り付けてください',
      type: 'textarea',
      required: true,
    },
    {
      key: 'LENGTH',
      label: '要約の長さ',
      description: '要約後のおおよその長さ',
      type: 'select',
      options: ['1文（ツイート級）', '3文', '5文', '200文字以内', '400文字以内', '箇条書き5点', '箇条書き10点'],
      defaultValue: '箇条書き5点',
      required: false,
    },
    {
      key: 'PERSPECTIVE',
      label: '要約の観点',
      description: 'どの観点から要約するか',
      type: 'select',
      options: ['客観的・中立的', 'ビジネス視点', '技術的観点', '読者へのメリット', '問題と解決策'],
      defaultValue: '客観的・中立的',
      required: false,
    },
    {
      key: 'OUTPUT_LANGUAGE',
      label: '出力言語',
      description: '要約文の言語',
      type: 'select',
      options: ['日本語', '英語', '元の言語を維持'],
      defaultValue: '日本語',
      required: false,
    },
  ],
  content: `# テキスト要約依頼

## 役割 (Role)

あなたは情報の本質を的確に抽出するプロのエディターです。

## タスク (Task)

以下のテキストを要約してください。

## 入力テキスト (Input)

---

{{TEXT}}

---

## 要約の条件 (Context)

- **要約の長さ**: {{LENGTH}}
- **要約の観点**: {{PERSPECTIVE}}
- **出力言語**: {{OUTPUT_LANGUAGE}}

## 制約 (Constraints)

- 原文の事実を歪めない（創作・推測を加えない）
- 重要なキーワードや固有名詞は保持する
- 読者が原文を読まなくても概要が分かるようにする
- 体言止めや口語表現は避け、読みやすい文語体にする

## 出力形式 (Output Format)

**要約:**
[ここに要約を出力]

**抽出したキーワード（3〜5個）:**
- キーワード1
- キーワード2
- ...
`,
};
