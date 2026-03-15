/**
 * meeting-notes.ts
 *
 * テンプレート: 会議メモ整形
 * 箇条書きのメモを構造化された議事録に変換させるプロンプト。
 */

import type { AiTemplate } from '../template-registry';

export const meetingNotesTemplate: AiTemplate = {
  id: 'meeting-notes',
  name: '会議メモ整形',
  description: '箇条書きのメモを読みやすい議事録フォーマットに整形させます',
  category: 'meeting',
  tags: ['議事録', '会議', 'メモ', '整形', 'まとめ'],
  placeholders: [
    {
      key: 'RAW_NOTES',
      label: '会議メモ（生データ）',
      description: '箇条書きや走り書きのメモをそのまま貼り付けてください',
      type: 'textarea',
      required: true,
    },
    {
      key: 'MEETING_TITLE',
      label: '会議名',
      description: '会議の名称・テーマ',
      type: 'text',
      defaultValue: '定例会議',
      required: false,
    },
    {
      key: 'MEETING_DATE',
      label: '開催日時',
      description: '会議の開催日時',
      type: 'text',
      defaultValue: '（日時不明）',
      required: false,
    },
    {
      key: 'PARTICIPANTS',
      label: '参加者',
      description: '参加者の名前やロール（カンマ区切り）',
      type: 'text',
      defaultValue: '（参加者不明）',
      required: false,
    },
  ],
  content: `# 議事録整形依頼

## 役割 (Role)

あなたはプロのビジネスライターです。
整理されていないメモから、明確で行動可能な議事録を作成することが得意です。

## タスク (Task)

以下の会議メモを、構造化された読みやすい議事録に整形してください。

## 会議メモ（生データ）(Input)

---

{{RAW_NOTES}}

---

## 会議情報 (Context)

- **会議名**: {{MEETING_TITLE}}
- **開催日時**: {{MEETING_DATE}}
- **参加者**: {{PARTICIPANTS}}

## 制約 (Constraints)

- 原文の事実を改ざんしない
- 不明確な点は \`[要確認]\` とマークする
- アクションアイテムは担当者・期限を明示する（不明の場合は空欄）
- 決定事項と議論中の事項を区別する

## 出力形式 (Output Format)

# {{MEETING_TITLE}} 議事録

**日時**: {{MEETING_DATE}}
**参加者**: {{PARTICIPANTS}}

---

## 議題

1. [議題1]
2. [議題2]

---

## 決定事項

- ✅ [決定した内容]

## 議論・検討事項

- [議論中の内容]

## アクションアイテム

| # | 内容 | 担当者 | 期限 |
|---|------|--------|------|
| 1 | [アクション] | [担当] | [期限] |

## 次回の予定

- **次回日時**: [次回会議の日時（不明の場合は省略）]
- **アジェンダ案**: [次回の議題候補]
`,
};
