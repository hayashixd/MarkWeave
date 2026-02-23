/**
 * blog-structure.ts
 *
 * テンプレート: ブログ構成案
 * AIにブログ記事のタイトル・章立て・キーメッセージを生成させるプロンプト。
 */

import type { AiTemplate } from '../template-registry';

export const blogStructureTemplate: AiTemplate = {
  id: 'blog-structure',
  name: 'ブログ構成案',
  description: '記事のタイトル・章立て・各セクションのキーポイントをAIに生成させます',
  category: 'blog',
  tags: ['ブログ', '記事', '構成', 'コンテンツ', 'SEO'],
  placeholders: [
    {
      key: 'TOPIC',
      label: 'ブログのトピック',
      description: '記事で扱うテーマや題材を具体的に入力してください',
      type: 'text',
      required: true,
    },
    {
      key: 'TARGET_AUDIENCE',
      label: 'ターゲット読者',
      description: '記事の想定読者層',
      type: 'text',
      defaultValue: '一般的なWeb読者',
      required: false,
    },
    {
      key: 'TONE',
      label: '文体・トーン',
      description: '記事のトーンを選択してください',
      type: 'select',
      options: ['カジュアル', 'フォーマル', '技術的', '親しみやすい', '教育的'],
      defaultValue: 'カジュアル',
      required: false,
    },
    {
      key: 'SECTION_COUNT',
      label: 'セクション数',
      description: '記事の主要セクション数（見出し数の目安）',
      type: 'select',
      options: ['3', '4', '5', '6', '7'],
      defaultValue: '5',
      required: false,
    },
    {
      key: 'WORD_COUNT',
      label: '目標文字数',
      description: '記事全体のおおよその文字数',
      type: 'select',
      options: ['1,000文字', '2,000文字', '3,000文字', '5,000文字以上'],
      defaultValue: '2,000文字',
      required: false,
    },
  ],
  content: `# ブログ記事構成依頼

## 役割 (Role)

あなたはSEOと読者エンゲージメントに精通したプロのコンテンツストラテジストです。

## タスク (Task)

以下のトピックについて、読者を引きつける**ブログ記事の構成案**を作成してください。

## コンテキスト (Context)

- **トピック**: {{TOPIC}}
- **ターゲット読者**: {{TARGET_AUDIENCE}}
- **文体・トーン**: {{TONE}}
- **目標セクション数**: {{SECTION_COUNT}}個
- **目標文字数**: {{WORD_COUNT}}

## 制約 (Constraints)

- 読者が最後まで読み続けたくなる構成にする
- 各セクションに要点を箇条書きで示す
- SEOを意識した具体的な見出しにする（数字・疑問形・ベネフィット訴求）
- 導入部で読者の課題や興味を引くフックを設ける
- まとめに行動喚起（CTA）を含める

## 出力形式 (Output Format)

以下のMarkdown形式で出力してください:

\`\`\`markdown
# [SEO最適化された記事タイトル（30〜40文字）]

**対象読者**: [ターゲット読者の説明]
**読了時間**: [おおよその読了時間]

## はじめに（導入）
- フックとなる問いかけや驚きの事実
- この記事で得られるベネフィット

## [セクション1タイトル]
- キーポイント1
- キーポイント2
- キーポイント3

[...{{SECTION_COUNT}}個のセクション...]

## まとめ
- 記事の要点整理
- 読者への次のアクション（CTA）
\`\`\`

また、SEOキーワード候補を5つ提案してください。
`,
};
