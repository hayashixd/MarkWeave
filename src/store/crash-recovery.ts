/**
 * クラッシュリカバリモジュール。
 *
 * window-tab-session-design.md §10 に準拠:
 * - @tauri-apps/plugin-store を使って 30 秒ごとにチェックポイントを保存
 * - 正常終了時にリカバリデータを削除
 * - 次回起動時にリカバリデータが残っていれば復元ダイアログを表示
 *
 * 制約:
 * - 3MB 超のファイルはチェックポイント対象外（I/O コスト回避）
 * - 7 日以上古いリカバリデータは自動削除
 */

import { load } from '@tauri-apps/plugin-store';

const RECOVERY_STORE = 'crash-recovery.json';
const CHECKPOINT_INTERVAL_MS = 30_000; // 30 秒ごと
const AUTO_SAVE_MAX_BYTES = 3 * 1024 * 1024; // 3MB
const MAX_RECOVERY_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 日

export interface RecoveryEntry {
  filePath: string;
  content: string;        // エディタ内の最新テキスト（Markdown シリアライズ後）
  savedContent: string;   // 最後にディスクに書き込んだテキスト
  checkpointAt: string;   // ISO 8601 タイムスタンプ
}

/**
 * アクティブな全タブのチェックポイントを保存する。
 * 正常終了時には clearRecoveryData() を呼んで削除する。
 */
export async function saveCheckpoint(entries: RecoveryEntry[]): Promise<void> {
  const store = await load(RECOVERY_STORE, { defaults: {}, autoSave: false });
  await store.set('entries', entries);
  await store.save();
}

/** 正常終了時にリカバリデータを削除する */
export async function clearRecoveryData(): Promise<void> {
  const store = await load(RECOVERY_STORE, { defaults: {}, autoSave: false });
  await store.clear();
  await store.save();
}

/**
 * 起動時にリカバリデータが残っているか確認する。
 * content と savedContent が一致するエントリ（実際に未保存でないもの）を除外。
 * 7 日以上古いエントリも自動削除。
 */
export async function loadRecoveryData(): Promise<RecoveryEntry[] | null> {
  const store = await load(RECOVERY_STORE, { defaults: {}, autoSave: false });
  const entries = await store.get<RecoveryEntry[]>('entries');
  if (!entries || entries.length === 0) return null;

  const now = Date.now();
  const dirty = entries.filter((e) => {
    // content == savedContent は未保存でないので除外
    if (e.content === e.savedContent) return false;
    // 7 日以上古いエントリは除外
    const age = now - new Date(e.checkpointAt).getTime();
    if (age > MAX_RECOVERY_AGE_MS) return false;
    return true;
  });

  return dirty.length > 0 ? dirty : null;
}

/**
 * 30 秒ごとにチェックポイントを保存するスケジューラを開始する。
 * 3MB 超のファイルはチェックポイント対象外。
 *
 * @returns クリーンアップ関数（useEffect で呼ぶ）
 */
export function startCheckpointScheduler(
  getEntries: () => RecoveryEntry[],
): () => void {
  const intervalId = setInterval(async () => {
    try {
      const entries = getEntries().filter((e) => {
        // 3MB 超ファイルはチェックポイント対象外
        const sizeBytes = new TextEncoder().encode(e.content).length;
        if (sizeBytes >= AUTO_SAVE_MAX_BYTES) return false;
        // 未保存のエントリのみ
        return e.content !== e.savedContent;
      });
      if (entries.length > 0) {
        await saveCheckpoint(entries);
      }
    } catch {
      // チェックポイント保存失敗は無視（UIをブロックしない）
    }
  }, CHECKPOINT_INTERVAL_MS);

  return () => clearInterval(intervalId);
}

/** 3MB を超えるファイルかどうかを判定する */
export function isLargeFile(content: string): boolean {
  return new TextEncoder().encode(content).length >= AUTO_SAVE_MAX_BYTES;
}
