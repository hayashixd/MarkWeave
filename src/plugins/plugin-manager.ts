/**
 * PluginManager - プラグインのライフサイクル管理
 *
 * plugin-api-design.md §6, §8 に準拠。
 * - activate(plugin): API を生成して plugin.activate() を呼び出す
 * - deactivate(pluginId): cleanup + registry から除去
 * - セーフモード時はビルトインプラグイン（"builtin." prefix）のみ有効化
 */

import type {
  EditorPlugin,
  EditorPluginAPI,
  ToolbarItem,
  SidebarPanel,
  InputRuleDefinition,
  MarkdownProcessor,
  DialogOptions,
  NodeViewProps,
  InstalledPlugin,
} from './plugin-api';
import type { Extension, Node, Mark } from '@tiptap/core';
import type React from 'react';
import { pluginRegistry } from './plugin-registry';
import { pluginBridge } from './plugin-bridge';
import { usePluginSettingsStore } from './plugin-settings-store';

type Disposable = () => void;

class PluginManager {
  /** pluginId → クリーンアップ関数リスト */
  private disposables = new Map<string, Disposable[]>();

  /** インストール済みプラグイン一覧（設定ストアと連携）*/
  private installed = new Map<string, InstalledPlugin>();

  /** セーフモードフラグ */
  private safeModeActive = false;

  /** 外部から注入されるコールバック */
  onToolbarItemRegistered: ((item: ToolbarItem) => void) | null = null;
  onToolbarItemRemoved: ((id: string) => void) | null = null;
  onSidebarPanelRegistered: ((panel: SidebarPanel) => void) | null = null;
  onSidebarPanelRemoved: ((id: string) => void) | null = null;
  onPluginStatusChanged: ((pluginId: string, info: InstalledPlugin) => void) | null = null;

  /** エディタ操作の注入 */
  getMarkdownFn: (() => string) | null = null;
  insertTextFn: ((text: string) => void) | null = null;
  showToastFn: ((msg: string, type?: string) => void) | null = null;

  // -------------------------------------------------------------------------
  // セーフモード
  // -------------------------------------------------------------------------

  setSafeMode(active: boolean): void {
    this.safeModeActive = active;
  }

  isSafeModeActive(): boolean {
    return this.safeModeActive;
  }

  /** セーフモード時にスキップすべきプラグインかどうか */
  private shouldSkipPlugin(pluginId: string): boolean {
    if (!this.safeModeActive) return false;
    return !pluginId.startsWith('builtin.');
  }

  // -------------------------------------------------------------------------
  // activate
  // -------------------------------------------------------------------------

  async activatePlugin(plugin: EditorPlugin): Promise<void> {
    if (this.shouldSkipPlugin(plugin.manifest.id)) {
      const installed = this.installed.get(plugin.manifest.id);
      if (installed) {
        this.updateStatus(plugin.manifest.id, { ...installed, status: 'safe-mode' });
      }
      return;
    }

    const disposableList: Disposable[] = [];

    const addDisposable = (fn: Disposable): void => {
      disposableList.push(fn);
    };

    const api = this.createApi(plugin, addDisposable);

    try {
      await plugin.activate(api);
      pluginRegistry.register(plugin);
      this.disposables.set(plugin.manifest.id, disposableList);

      const installed = this.installed.get(plugin.manifest.id);
      if (installed) {
        this.updateStatus(plugin.manifest.id, { ...installed, status: 'active' });
      }
    } catch (err) {
      // クリーンアップしてエラー状態に
      disposableList.forEach((d) => d());
      const installed = this.installed.get(plugin.manifest.id);
      if (installed) {
        this.updateStatus(plugin.manifest.id, {
          ...installed,
          status: 'error',
          errorMessage: String(err),
        });
      }
      throw err;
    }
  }

  async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = pluginRegistry.get(pluginId);
    try {
      await plugin?.deactivate?.();
    } catch {
      // deactivate エラーは無視してクリーンアップを続行
    }

    const disposables = this.disposables.get(pluginId) ?? [];
    disposables.forEach((d) => d());
    this.disposables.delete(pluginId);

    pluginRegistry.unregister(pluginId);
    pluginBridge.destroySandbox(pluginId);

    const installed = this.installed.get(pluginId);
    if (installed) {
      this.updateStatus(pluginId, { ...installed, status: 'inactive' });
    }
  }

  // -------------------------------------------------------------------------
  // API ファクトリ
  // -------------------------------------------------------------------------

  private createApi(plugin: EditorPlugin, addDisposable: (fn: Disposable) => void): EditorPluginAPI {
    const manifest = plugin.manifest;
    const hasPermission = (perm: string): boolean =>
      manifest.permissions.includes(perm as never);

    const settingsStore = usePluginSettingsStore.getState();

    return {
      editor: {
        getMarkdown: () => {
          if (!hasPermission('editor:read')) throw new Error('editor:read 権限が必要です');
          return this.getMarkdownFn?.() ?? '';
        },
        insertText: (text: string) => {
          if (!hasPermission('editor:write')) throw new Error('editor:write 権限が必要です');
          this.insertTextFn?.(text);
        },
      },

      registerExtension: (extension: Extension | Node | Mark) => {
        // ビルトインプラグイン専用。サードパーティは PluginBridge 経由のみ
        if (!manifest.id.startsWith('builtin.')) {
          throw new Error('registerExtension はビルトインプラグイン専用です');
        }
        // TipTap への Extension 登録は AppShell レベルで行う
        // ここでは登録情報をイベントで通知する
        window.dispatchEvent(
          new CustomEvent('plugin:registerExtension', { detail: extension }),
        );
        addDisposable(() => {
          window.dispatchEvent(
            new CustomEvent('plugin:unregisterExtension', {
              detail: { name: (extension as { name: string }).name },
            }),
          );
        });
      },

      registerNodeView: (nodeTypeName: string, component: React.ComponentType<NodeViewProps>) => {
        window.dispatchEvent(
          new CustomEvent('plugin:registerNodeView', { detail: { nodeTypeName, component } }),
        );
        addDisposable(() => {
          window.dispatchEvent(
            new CustomEvent('plugin:unregisterNodeView', { detail: { nodeTypeName } }),
          );
        });
      },

      registerToolbarItem: (item: ToolbarItem) => {
        if (!hasPermission('ui:toolbar')) throw new Error('ui:toolbar 権限が必要です');
        this.onToolbarItemRegistered?.(item);
        addDisposable(() => {
          this.onToolbarItemRemoved?.(item.id);
        });
      },

      registerSidebarPanel: (panel: SidebarPanel) => {
        if (!hasPermission('ui:sidebar')) throw new Error('ui:sidebar 権限が必要です');
        this.onSidebarPanelRegistered?.(panel);
        addDisposable(() => {
          this.onSidebarPanelRemoved?.(panel.id);
        });
      },

      registerInputRule: (_rule: InputRuleDefinition) => {
        if (!hasPermission('editor:write')) throw new Error('editor:write 権限が必要です');
        // TipTap への InputRule 登録は Extension として処理
        // Phase 7 では登録のみ記録し、実際の TipTap 統合は将来対応
      },

      registerMarkdownProcessor: (_processor: MarkdownProcessor) => {
        // Markdown 変換パイプラインへの統合は将来対応
      },

      ui: {
        showToast: (message, type) => {
          if (!hasPermission('ui:toast')) throw new Error('ui:toast 権限が必要です');
          this.showToastFn?.(message, type);
        },
        showDialog: async (options: DialogOptions) => {
          if (!hasPermission('ui:dialog')) throw new Error('ui:dialog 権限が必要です');
          // ネイティブ confirm/alert でシンプルに実装
          const ok = window.confirm(`${options.title}\n\n${options.message}`);
          return { value: ok ? (options.buttons?.[0]?.value ?? 'ok') : null };
        },
      },

      settings: {
        get: <T>(key: string): T => {
          const values = settingsStore.getPluginSettings(manifest.id);
          const decl = manifest.settings?.find((s) => s.key === key);
          return (values[key] ?? decl?.default) as T;
        },
        set: async (key, value) => {
          await settingsStore.setPluginSetting(manifest.id, key, value);
        },
        onChange: (key, handler) => {
          const unsubscribe = usePluginSettingsStore.subscribe((state: { settings: Record<string, Record<string, unknown>> }) => {
            const value = state.settings[manifest.id]?.[key];
            handler(value);
          });
          addDisposable(unsubscribe);
          return unsubscribe;
        },
      },
    };
  }

  // -------------------------------------------------------------------------
  // インストール済みプラグイン管理
  // -------------------------------------------------------------------------

  setInstalled(plugins: InstalledPlugin[]): void {
    this.installed.clear();
    for (const p of plugins) {
      this.installed.set(p.manifest.id, p);
    }
  }

  getInstalled(): InstalledPlugin[] {
    return Array.from(this.installed.values());
  }

  private updateStatus(pluginId: string, info: InstalledPlugin): void {
    this.installed.set(pluginId, info);
    this.onPluginStatusChanged?.(pluginId, info);
  }
}

/** シングルトンの PluginManager */
export const pluginManager = new PluginManager();
