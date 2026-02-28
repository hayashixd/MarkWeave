/**
 * テキスト整形コマンド
 *
 * editor-ux-design.md §12 に準拠。
 * 選択範囲のテキストに対して一括変換処理を行うユーティリティ関数群。
 */

/** 行を昇順ソート */
export function sortLinesAsc(text: string): string {
  const lines = text.split('\n');
  lines.sort((a, b) => a.localeCompare(b, 'ja'));
  return lines.join('\n');
}

/** 行を降順ソート */
export function sortLinesDesc(text: string): string {
  const lines = text.split('\n');
  lines.sort((a, b) => b.localeCompare(a, 'ja'));
  return lines.join('\n');
}

/** 重複行を削除（初回出現を残す） */
export function removeDuplicateLines(text: string): string {
  const seen = new Set<string>();
  return text
    .split('\n')
    .filter((line) => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    })
    .join('\n');
}

/** 行頭の空白・タブを削除 */
export function trimLeading(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^[\t ]+/, ''))
    .join('\n');
}

/** 行末の空白・タブを削除 */
export function trimTrailing(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/[\t ]+$/, ''))
    .join('\n');
}

/** 大文字に変換 */
export function toUpperCase(text: string): string {
  return text.toUpperCase();
}

/** 小文字に変換 */
export function toLowerCase(text: string): string {
  return text.toLowerCase();
}

/**
 * 半角→全角変換
 * ASCII 0x21〜0x7E → 全角 0xFF01〜0xFF5E
 * 半角スペースは全角スペースに変換
 */
export function toFullWidth(text: string): string {
  return text.replace(/[\x20-\x7E]/g, (c) => {
    if (c === ' ') return '\u3000';
    return String.fromCharCode(c.charCodeAt(0) + 0xfee0);
  });
}

/**
 * 全角→半角変換
 * 全角 0xFF01〜0xFF5E → ASCII 0x21〜0x7E
 * 全角スペースは半角スペースに変換
 */
export function toHalfWidth(text: string): string {
  return text.replace(/[\uFF01-\uFF5E\u3000]/g, (c) => {
    if (c === '\u3000') return ' ';
    return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
  });
}

/** コマンド定義 */
export interface TextTransformCommand {
  id: string;
  label: string;
  transform: (text: string) => string;
}

export const TEXT_TRANSFORM_COMMANDS: TextTransformCommand[] = [
  { id: 'text.sortAsc', label: '行を昇順ソート', transform: sortLinesAsc },
  { id: 'text.sortDesc', label: '行を降順ソート', transform: sortLinesDesc },
  { id: 'text.removeDuplicates', label: '重複行を削除', transform: removeDuplicateLines },
  { id: 'text.trimLeading', label: '行頭の空白を削除', transform: trimLeading },
  { id: 'text.trimTrailing', label: '行末の空白を削除', transform: trimTrailing },
  { id: 'text.toUpperCase', label: '大文字に変換', transform: toUpperCase },
  { id: 'text.toLowerCase', label: '小文字に変換', transform: toLowerCase },
  { id: 'text.toFullWidth', label: '半角→全角変換', transform: toFullWidth },
  { id: 'text.toHalfWidth', label: '全角→半角変換', transform: toHalfWidth },
];
