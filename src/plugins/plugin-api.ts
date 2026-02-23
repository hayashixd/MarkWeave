/**
 * Plugin API - プラグインシステムのインターフェース定義
 *
 * プラグインは以下の拡張ポイントを利用できる:
 * - 新しいマークダウンノードタイプの追加
 * - レンダリングのカスタマイズ
 * - ツールバーアイテムの追加
 * - キーバインディングの追加
 * - メニューアイテムの追加
 *
 * TODO: Phase 4 で実装
 */

export interface EditorPlugin {
  /** プラグインの一意な識別子 */
  id: string;
  /** プラグインの表示名 */
  name: string;
  /** バージョン */
  version: string;

  /** プラグイン初期化 */
  initialize?(): void;

  /** プラグイン破棄 */
  destroy?(): void;
}

export interface PluginRegistry {
  register(plugin: EditorPlugin): void;
  unregister(pluginId: string): void;
  get(pluginId: string): EditorPlugin | undefined;
  getAll(): EditorPlugin[];
}
