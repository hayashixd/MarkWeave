/**
 * Plugin API - プラグインシステムの型定義
 *
 * plugin-api-design.md §3 に準拠。
 *
 * - PluginManifest: プラグインのメタデータ・権限宣言
 * - EditorPluginAPI: プラグインがエディタと通信するためのインターフェース
 * - EditorPlugin: プラグイン実装のインターフェース
 */

import type { Extension, Node, Mark } from '@tiptap/core';
import type React from 'react';

// ---------------------------------------------------------------------------
// 権限
// ---------------------------------------------------------------------------

/**
 * プラグインが要求できる権限。
 * manifest.permissions に宣言した権限のみアクセスが許可される。
 */
export type PluginPermission =
  | 'editor:read'      // エディタのドキュメント内容を読み取る
  | 'editor:write'     // エディタのドキュメントを変更する
  | 'editor:command'   // コマンドを発行する
  | 'clipboard:read'   // クリップボードを読み取る
  | 'clipboard:write'  // クリップボードに書き込む
  | 'fs:read'          // ファイルを読み取る（ワークスペース内のみ）
  | 'fs:write'         // ファイルを書き込む（ワークスペース内のみ）
  | 'network:fetch'    // 外部 URL へ fetch する
  | 'ui:toolbar'       // ツールバーを変更する
  | 'ui:sidebar'       // サイドバーパネルを追加する
  | 'ui:menu'          // ネイティブメニューにアイテムを追加する
  | 'ui:dialog'        // ダイアログを表示する
  | 'ui:toast';        // トースト通知を表示する

// ---------------------------------------------------------------------------
// 設定スキーマ
// ---------------------------------------------------------------------------

/** プラグイン設定フィールドの宣言 */
export interface PluginSettingDeclaration {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'color' | 'select' | 'textarea' | 'file';
  default: unknown;
  description?: string;
  placeholder?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  options?: Array<{ value: string; label: string }>;
  filters?: Array<{ name: string; extensions: string[] }>;
}

// ---------------------------------------------------------------------------
// マニフェスト
// ---------------------------------------------------------------------------

/** プラグインのメタデータ */
export interface PluginManifest {
  /** プラグインの一意な識別子（例: "com.example.mermaid"）*/
  id: string;
  /** 表示名 */
  name: string;
  /** セマンティックバージョン（例: "1.0.0"）*/
  version: string;
  /** 説明文 */
  description?: string;
  /** 作者 */
  author?: string;
  /** リポジトリ URL */
  repository?: string;
  /**
   * プラグインが要求する権限。
   * 宣言した権限のみアクセスが許可される。
   */
  permissions: PluginPermission[];
  /** プラグインが提供する設定項目（動的フォーム生成用）*/
  settings?: PluginSettingDeclaration[];
  /** このプラグインが必要とする最低 API バージョン */
  minApiVersion?: string;
  /** 変更履歴 */
  changelog?: string;
}

// ---------------------------------------------------------------------------
// UI 拡張型
// ---------------------------------------------------------------------------

/** ツールバーアイテム定義 */
export interface ToolbarItem {
  id: string;
  title: string;
  /** アイコン（SVG 文字列 or lucide-react のアイコン名）*/
  icon: string;
  onClick(): void;
  isActive?(): boolean;
  items?: Array<{ label: string; onClick(): void }>;
  separator?: 'before' | 'after';
}

/** サイドバーパネル定義 */
export interface SidebarPanel {
  id: string;
  label: string;
  icon: string;
  component: React.ComponentType;
}

/** 入力ルール定義 */
export interface InputRuleDefinition {
  pattern: RegExp;
  handler: (context: { state: unknown; range: unknown }) => void;
}

/** Markdown 前後処理 */
export interface MarkdownProcessor {
  /** 'pre' = Markdown を TipTap に変換する前, 'post' = TipTap から Markdown に変換した後 */
  phase: 'pre' | 'post';
  process(markdown: string): string;
}

/** ダイアログオプション */
export interface DialogOptions {
  title: string;
  message: string;
  buttons?: Array<{ label: string; value: string }>;
}

/** ダイアログ結果 */
export interface DialogResult {
  value: string | null;
}

// ---------------------------------------------------------------------------
// NodeView Props（最小定義）
// ---------------------------------------------------------------------------

export interface NodeViewProps {
  node: {
    attrs: Record<string, unknown>;
    textContent: string;
  };
  updateAttributes: (attrs: Record<string, unknown>) => void;
  selected: boolean;
}

// ---------------------------------------------------------------------------
// Editor Plugin API
// ---------------------------------------------------------------------------

/**
 * プラグインが受け取る API オブジェクト。
 * プラグインはこのオブジェクト経由でのみエディタと通信する。
 */
export interface EditorPluginAPI {
  /** エディタ操作 API */
  editor: {
    /** 現在のドキュメントを Markdown 文字列として取得（'editor:read' 権限必須）*/
    getMarkdown(): string;
    /** 指定位置にテキストを挿入（'editor:write' 権限必須）*/
    insertText(text: string): void;
  };

  /**
   * TipTap 拡張を登録する（ビルトインプラグイン専用。サードパーティは不可）
   */
  registerExtension(extension: Extension | Node | Mark): void;

  /** NodeView（React コンポーネント）を登録する */
  registerNodeView(
    nodeTypeName: string,
    component: React.ComponentType<NodeViewProps>,
  ): void;

  /** ツールバーにアイテムを追加（'ui:toolbar' 権限必須）*/
  registerToolbarItem(item: ToolbarItem): void;

  /** サイドバーにパネルを追加（'ui:sidebar' 権限必須）*/
  registerSidebarPanel(panel: SidebarPanel): void;

  /** 入力ルールを追加（'editor:write' 権限必須）*/
  registerInputRule(rule: InputRuleDefinition): void;

  /** Markdown エクスポート前後処理を追加 */
  registerMarkdownProcessor(processor: MarkdownProcessor): void;

  /** UI ユーティリティ */
  ui: {
    /** トースト通知（'ui:toast' 権限必須）*/
    showToast(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
    /** ダイアログを表示（'ui:dialog' 権限必須）*/
    showDialog(options: DialogOptions): Promise<DialogResult>;
  };

  /** プラグイン設定へのアクセス */
  settings: {
    /** 設定値を取得（宣言した key のみ）*/
    get<T = unknown>(key: string): T;
    /** 設定値を変更（自己設定変更は常に許可）*/
    set(key: string, value: unknown): Promise<void>;
    /** 設定変更を購読。返り値はアンサブスクライブ関数 */
    onChange(key: string, handler: (value: unknown) => void): () => void;
  };
}

// ---------------------------------------------------------------------------
// EditorPlugin インターフェース
// ---------------------------------------------------------------------------

/**
 * プラグインの実装インターフェース。
 * ビルトイン・サードパーティともにこのインターフェースを実装する。
 */
export interface EditorPlugin {
  manifest: PluginManifest;

  /**
   * プラグイン初期化。
   * api は manifest.permissions で宣言した権限の範囲でのみ動作する。
   */
  activate(api: EditorPluginAPI): void | Promise<void>;

  /** プラグイン破棄（リソース解放）*/
  deactivate?(): void | Promise<void>;
}

// ---------------------------------------------------------------------------
// インストール済みプラグイン情報
// ---------------------------------------------------------------------------

export type PluginStatus = 'active' | 'inactive' | 'error' | 'safe-mode';

export interface InstalledPlugin {
  manifest: PluginManifest;
  /** プラグインフォルダへのパス */
  path: string;
  /** 有効/無効フラグ */
  enabled: boolean;
  /** 実行時の状態 */
  status: PluginStatus;
  /** エラー時のメッセージ */
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// PluginRegistry インターフェース（後方互換を保つため残す）
// ---------------------------------------------------------------------------

export interface PluginRegistry {
  register(plugin: EditorPlugin): void;
  unregister(pluginId: string): void;
  get(pluginId: string): EditorPlugin | undefined;
  getAll(): EditorPlugin[];
}

// ---------------------------------------------------------------------------
// postMessage プロトコル（iframe 通信用）
// ---------------------------------------------------------------------------

/** プラグイン → PluginBridge への要求 */
export interface PluginRequest {
  type: 'api_call';
  callId: string;
  method: string;
  args: unknown[];
}

/** PluginBridge → プラグインへの応答 */
export interface PluginResponse {
  type: 'api_response';
  callId: string;
  result?: unknown;
  error?: string;
}

/** PluginBridge → プラグインへのイベント通知 */
export interface PluginEvent {
  type: 'editor_event';
  eventName: string;
  payload: unknown;
}

/** メソッド名 → 必要権限のマッピング */
export const API_METHOD_PERMISSION_MAP: Record<string, PluginPermission> = {
  'editor.getMarkdown':    'editor:read',
  'editor.insertText':     'editor:write',
  'fs.readFile':           'fs:read',
  'fs.writeFile':          'fs:write',
  'fs.listDirectory':      'fs:read',
  'clipboard.readText':    'clipboard:read',
  'clipboard.writeText':   'clipboard:write',
  'network.fetch':         'network:fetch',
  'ui.showToast':          'ui:toast',
  'ui.showDialog':         'ui:dialog',
  'registerToolbarItem':   'ui:toolbar',
  'registerSidebarPanel':  'ui:sidebar',
};
