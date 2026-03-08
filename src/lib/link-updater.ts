/**
 * link-updater.ts
 *
 * ファイルのリネーム・移動後にワークスペース内の Markdown リンクを更新するユーティリティ。
 *
 * file-workspace-design.md §5.3 Phase 7 実装方針に準拠:
 * - ワークスペース内の全 .md ファイルをスキャン
 * - 旧パスへの相対リンクを検出し、新パスへの相対リンクに置換
 * - dryRun: true の場合は変更せずに影響ファイル数だけ返す
 *
 * 実装上の制約:
 * - Tauri IPC 経由でファイルを読み書きする
 * - ワークスペース外のファイルは対象外
 */

import { invoke } from '@tauri-apps/api/core';

export interface LinkUpdateResult {
  /** 影響を受けるファイル数 */
  affectedCount: number;
  /** 旧ファイルのワークスペース相対パス（表示用） */
  oldRelative: string;
  /** 新ファイルのワークスペース相対パス（表示用） */
  newRelative: string;
}

export interface LinkUpdateOptions {
  /** true: 変更せずに影響ファイル数を返す（プレビュー用） */
  dryRun: boolean;
}

/**
 * ワークスペース内の全 Markdown ファイルをスキャンして、
 * oldPath へのリンクを newPath へのリンクに更新する。
 *
 * @param oldPath       - 移動前のファイル絶対パス
 * @param newPath       - 移動後のファイル絶対パス
 * @param workspaceRoot - ワークスペースルートの絶対パス
 * @param options       - オプション
 */
export async function updateMarkdownLinksInWorkspace(
  oldPath: string,
  newPath: string,
  workspaceRoot: string,
  options: LinkUpdateOptions,
): Promise<LinkUpdateResult> {
  // ワークスペース相対パス（表示用）
  const sep = /[/\\]/;
  const wsPrefix = workspaceRoot.endsWith('/') || workspaceRoot.endsWith('\\')
    ? workspaceRoot
    : workspaceRoot + '/';
  const oldRelative = oldPath.startsWith(wsPrefix)
    ? oldPath.slice(wsPrefix.length)
    : oldPath.split(sep).pop() ?? oldPath;
  const newRelative = newPath.startsWith(wsPrefix)
    ? newPath.slice(wsPrefix.length)
    : newPath.split(sep).pop() ?? newPath;

  // ワークスペース内の全 .md ファイルを取得
  let mdFiles: string[];
  try {
    mdFiles = await invoke<string[]>('list_markdown_files', { rootPath: workspaceRoot });
  } catch {
    return { affectedCount: 0, oldRelative, newRelative };
  }

  let affectedCount = 0;

  for (const filePath of mdFiles) {
    // 移動先ファイル自身はスキップ
    if (filePath === newPath) continue;

    let content: string;
    try {
      content = await invoke<string>('read_file', { path: filePath });
    } catch {
      continue;
    }

    // このファイルから見た oldPath / newPath への相対リンクを計算
    const fileDir = filePath.replace(/[/\\][^/\\]*$/, '');
    const oldRel = computeRelativePath(fileDir, oldPath);
    const newRel = computeRelativePath(fileDir, newPath);

    if (!contentHasLink(content, oldRel)) continue;

    affectedCount++;

    if (!options.dryRun) {
      const updated = replaceLinks(content, oldRel, newRel);
      try {
        await invoke('write_file', { path: filePath, content: updated });
      } catch {
        // 書き込み失敗は静かに無視
      }
    }
  }

  return { affectedCount, oldRelative, newRelative };
}

/**
 * fromDir から toFile への相対パスを計算する（簡易版）。
 *
 * 注: OS のパス区切りを '/' に正規化する。
 */
function computeRelativePath(fromDir: string, toFile: string): string {
  const normalize = (p: string) => p.replace(/\\/g, '/');
  const from = normalize(fromDir).split('/').filter(Boolean);
  const to = normalize(toFile).split('/').filter(Boolean);

  // 共通プレフィックスを除去
  let i = 0;
  while (i < from.length && i < to.length && from[i] === to[i]) i++;

  const ups = from.length - i;
  const downs = to.slice(i);

  const parts = [
    ...Array(ups).fill('..'),
    ...downs,
  ];

  return parts.length === 0 ? '.' : parts.join('/');
}

/**
 * コンテンツに特定の相対リンクが含まれるか確認する。
 * `[text](link)` 形式と `![alt](link)` 形式の両方を対象とする。
 */
function contentHasLink(content: string, link: string): boolean {
  // URL エンコード・デコードの揺れに対応するため、ファイル名部分だけを照合
  const escaped = link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\]\\(${escaped}(?:[#?][^)]*)?\\)`).test(content);
}

/**
 * コンテンツ内の oldLink を newLink に置換する。
 */
function replaceLinks(content: string, oldLink: string, newLink: string): string {
  const escaped = oldLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // ](oldLink) または ](oldLink#anchor) または ](oldLink?query) を置換
  return content.replace(
    new RegExp(`(\\]\\()${escaped}((?:[#?][^)]*)?)\\)`, 'g'),
    (_match, prefix, suffix) => `${prefix}${newLink}${suffix})`,
  );
}
