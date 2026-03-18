import type { AiEditTemplate } from '../types';

const proofread: AiEditTemplate = {
  id: 'builtin-proofread',
  name: '校正',
  icon: 'pencil',
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

const rewrite: AiEditTemplate = {
  id: 'builtin-rewrite',
  name: 'リライト',
  icon: 'refresh',
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

const continueWriting: AiEditTemplate = {
  id: 'builtin-continue',
  name: '続きを書く',
  icon: 'document',
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

const summarize: AiEditTemplate = {
  id: 'builtin-summarize',
  name: '要約',
  icon: 'clipboard',
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

const translate: AiEditTemplate = {
  id: 'builtin-translate',
  name: '翻訳',
  icon: 'globe',
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

export const BUILTIN_TEMPLATES: AiEditTemplate[] = [
  proofread,
  rewrite,
  continueWriting,
  summarize,
  translate,
];
