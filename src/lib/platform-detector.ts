/**
 * プラットフォーム検出
 *
 * YAML Front Matter の内容から、ファイルの対象プラットフォームを判定する。
 */

export type Platform = 'zenn' | 'qiita' | 'generic';

/**
 * YAML 文字列からプラットフォームを検出する。
 *
 * Zenn:    emoji / type: tech|idea / topics フィールドのいずれかが存在する場合
 * Qiita:   tags がブロックリスト形式（- name: xxx）で存在する場合
 * generic: それ以外（通常の Markdown ファイル）
 */
export function detectPlatform(yaml: string): Platform {
  if (!yaml.trim()) return 'generic';

  // Zenn: emoji, type: tech|idea, topics のいずれかが存在
  if (
    /^emoji:\s/m.test(yaml) ||
    /^type:\s*["']?(?:tech|idea)["']?\s*$/m.test(yaml) ||
    /^topics:\s*(\[|$)/m.test(yaml)
  ) {
    return 'zenn';
  }

  // Qiita: tags ブロックに "- name:" 形式が存在
  if (/^tags:\s*$/m.test(yaml) && /^\s+-\s+name:\s/m.test(yaml)) {
    return 'qiita';
  }

  return 'generic';
}
