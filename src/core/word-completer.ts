/**
 * 単語補完ロジック（Phase 3）
 *
 * editor-ux-design.md §14 に準拠:
 * - ドキュメント内の単語を抽出しサジェスト候補を構築
 * - Unicode対応（日本語・英語混在）
 * - 出現頻度降順ソート
 */

/**
 * テキストから単語リストを構築する
 * @returns 単語 → 出現回数のマップ
 */
export function buildWordList(text: string): Map<string, number> {
  const wordMap = new Map<string, number>();
  // Unicode 対応の単語境界で分割（日本語は文字単位、英語はスペース区切り）
  const words = text.match(/[\p{L}\p{N}ー々〆〇]+/gu) ?? [];
  for (const word of words) {
    if (word.length < 2) continue; // 1 文字は除外
    wordMap.set(word, (wordMap.get(word) ?? 0) + 1);
  }
  return wordMap;
}

/**
 * プレフィックスに一致する候補を返す
 * @param wordMap 単語 → 出現回数のマップ
 * @param prefix 入力中のプレフィックス
 * @param maxResults 最大候補数（デフォルト10）
 * @returns ソート済み候補リスト
 */
export function getSuggestions(
  wordMap: Map<string, number>,
  prefix: string,
  maxResults = 10,
): { word: string; count: number }[] {
  if (prefix.length < 1) return [];

  const lowerPrefix = prefix.toLowerCase();
  const results: { word: string; count: number }[] = [];

  for (const [word, count] of wordMap) {
    // プレフィックスと完全一致する単語は候補から除外
    if (word === prefix) continue;
    if (word.toLowerCase().startsWith(lowerPrefix)) {
      results.push({ word, count });
    }
  }

  // 出現頻度降順 → アルファベット順
  results.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.word.localeCompare(b.word);
  });

  return results.slice(0, maxResults);
}
