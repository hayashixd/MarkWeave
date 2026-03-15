/**
 * 文章可読性スコア
 *
 * 漢字率・平均文長・読みやすさ指標を計算する。
 * feature-list.md Phase 7「執筆体験強化」に準拠。
 */

export interface ReadabilityMetrics {
  /** 漢字率 (0.0–1.0) */
  kanjiRatio: number;
  /** 平均文長（文あたりの文字数） */
  averageSentenceLength: number;
  /** ひらがな率 (0.0–1.0) */
  hiraganaRatio: number;
  /** カタカナ率 (0.0–1.0) */
  katakanaRatio: number;
  /** 可読性スコア (0–100)。高いほど読みやすい */
  score: number;
  /** 可読性レベル */
  level: ReadabilityLevel;
  /** 総文字数（スペースなし） */
  totalChars: number;
  /** 文数 */
  sentenceCount: number;
}

export type ReadabilityLevel = 'easy' | 'moderate' | 'hard';

/**
 * 漢字を検出する正規表現（CJK統合漢字 + 拡張A）
 */
const KANJI_RE = /[\u4E00-\u9FFF\u3400-\u4DBF]/g;

/**
 * ひらがなを検出する正規表現
 */
const HIRAGANA_RE = /[\u3040-\u309F]/g;

/**
 * カタカナを検出する正規表現
 */
const KATAKANA_RE = /[\u30A0-\u30FF]/g;

/**
 * 文の区切りを検出する正規表現（日本語・英語の句点）
 */
const SENTENCE_END_RE = /[。！？.!?]+/g;

/**
 * Markdown 記法を除去してプレーンテキストを返す
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '') // YAML Front Matter
    .replace(/^#{1,6}\s+/gm, '')                     // 見出し
    .replace(/```[\s\S]*?```/g, '')                   // コードブロック
    .replace(/`[^`]*`/g, '')                          // インラインコード
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')          // リンク
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')           // 画像
    .replace(/[*_~]{1,3}/g, '')                       // 太字・斜体・取り消し線
    .replace(/^>\s+/gm, '')                           // 引用
    .replace(/^[-*+]\s+/gm, '')                       // リスト
    .replace(/^\d+\.\s+/gm, '')                       // 番号付きリスト
    .replace(/^-{3,}$/gm, '')                         // 水平線
    .replace(/\$\$[\s\S]*?\$\$/g, '')                 // ブロック数式
    .replace(/\$[^$\n]+\$/g, '');                     // インライン数式
}

/**
 * テキストを文に分割する
 */
function splitSentences(text: string): string[] {
  // 空白行を除去して1行にする
  const normalized = text.replace(/\n+/g, ' ').trim();
  if (!normalized) return [];

  const sentences = normalized
    .split(SENTENCE_END_RE)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return sentences;
}

/**
 * 可読性スコアを計算する
 *
 * スコアは以下の基準で算出:
 * - 漢字率: 20〜30% が読みやすい（日本語の一般的な推奨値）
 * - 平均文長: 40〜60文字程度が読みやすい
 * - ひらがな率: 高いほど柔らかく読みやすい傾向
 *
 * 参考: 日本語可読性の研究に基づき、漢字率 30% 前後を最適とする。
 */
export function calculateReadability(text: string): ReadabilityMetrics {
  const plain = stripMarkdown(text);
  const noSpace = plain.replace(/\s/g, '');
  const chars = [...noSpace];
  const totalChars = chars.length;

  if (totalChars === 0) {
    return {
      kanjiRatio: 0,
      averageSentenceLength: 0,
      hiraganaRatio: 0,
      katakanaRatio: 0,
      score: 0,
      level: 'moderate',
      totalChars: 0,
      sentenceCount: 0,
    };
  }

  const kanjiCount = (noSpace.match(KANJI_RE) ?? []).length;
  const hiraganaCount = (noSpace.match(HIRAGANA_RE) ?? []).length;
  const katakanaCount = (noSpace.match(KATAKANA_RE) ?? []).length;

  const kanjiRatio = kanjiCount / totalChars;
  const hiraganaRatio = hiraganaCount / totalChars;
  const katakanaRatio = katakanaCount / totalChars;

  const sentences = splitSentences(plain);
  const sentenceCount = Math.max(sentences.length, 1);
  const averageSentenceLength = totalChars / sentenceCount;

  // スコア計算 (0–100)
  // 1. 漢字率スコア (0–40点): 25–35% が最適、離れるほど減点
  const optimalKanjiRatio = 0.30;
  const kanjiDeviation = Math.abs(kanjiRatio - optimalKanjiRatio);
  const kanjiScore = Math.max(0, 40 - kanjiDeviation * 200);

  // 2. 平均文長スコア (0–40点): 40–60文字が最適、長すぎると減点
  const optimalLength = 50;
  const lengthDeviation = Math.abs(averageSentenceLength - optimalLength);
  const lengthScore = Math.max(0, 40 - lengthDeviation * 0.8);

  // 3. ひらがな率ボーナス (0–20点): 適度なひらがな率は読みやすさに寄与
  const hiraganaScore = Math.min(20, hiraganaRatio * 50);

  const score = Math.round(Math.min(100, kanjiScore + lengthScore + hiraganaScore));

  let level: ReadabilityLevel;
  if (score >= 60) {
    level = 'easy';
  } else if (score >= 35) {
    level = 'moderate';
  } else {
    level = 'hard';
  }

  return {
    kanjiRatio,
    averageSentenceLength: Math.round(averageSentenceLength * 10) / 10,
    hiraganaRatio,
    katakanaRatio,
    score,
    level,
    totalChars,
    sentenceCount,
  };
}

/**
 * 可読性レベルの日本語ラベルを返す
 */
export function getReadabilityLabel(level: ReadabilityLevel): string {
  switch (level) {
    case 'easy':
      return '読みやすい';
    case 'moderate':
      return '普通';
    case 'hard':
      return '難しい';
  }
}

/**
 * パーセンテージ表示用のフォーマッタ
 */
export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}
