/**
 * ウィンドウ間同期イベントの型定義
 *
 * window-tab-session-design.md §11.3 に準拠:
 * Tauri Events の payload フィールドに JSON シリアライズして送受信する。
 */

/** 設定変更（テーマ・フォントサイズ等） */
export interface SettingsChangedPayload {
  key: string;
  value: unknown;
}

/** あるウィンドウでファイルが開かれた（ロック通知用） */
export interface FileOpenedPayload {
  windowLabel: string;
  filePath: string;
  isReadOnly: boolean;
}

/** あるウィンドウでファイルが閉じられた（ロック解放通知） */
export interface FileClosedPayload {
  windowLabel: string;
  filePath: string;
}

/** あるウィンドウでファイルが保存された（他ウィンドウへ外部変更通知） */
export interface FileSavedPayload {
  windowLabel: string;
  filePath: string;
  savedAt: string;
}

/** ワークスペース（フォルダ）の変更 */
export interface WorkspaceChangedPayload {
  workspacePath: string | null;
}

/** ファイルロック状態の変更 */
export interface FileLockPayload {
  filePath: string;
  windowLabel: string;
}

/** Read-Only ウィンドウが書き込みウィンドウに権限譲渡をリクエスト */
export interface WriteAccessTransferPayload {
  filePath: string;
  requesterLabel: string;
  ownerLabel: string;
}

/** 書き込み権限の拒否通知 */
export interface WriteAccessDeniedPayload {
  filePath: string;
}

/** detach_tab_to_window からの初期化データ */
export interface InitDetachedTabPayload {
  filePath: string | null;
  fileName: string;
  content: string;
  encoding: string;
  lineEnding: string;
  fileType: string;
}
