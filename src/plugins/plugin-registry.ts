/**
 * PluginRegistry - プラグインの登録・管理
 *
 * plugin-api-design.md §6 に準拠。
 */

import type { EditorPlugin } from './plugin-api';

class PluginRegistryImpl {
  private plugins = new Map<string, EditorPlugin>();

  register(plugin: EditorPlugin): void {
    this.plugins.set(plugin.manifest.id, plugin);
  }

  unregister(pluginId: string): void {
    this.plugins.delete(pluginId);
  }

  get(pluginId: string): EditorPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAll(): EditorPlugin[] {
    return Array.from(this.plugins.values());
  }

  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  hasPermission(pluginId: string, permission: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    return plugin.manifest.permissions.includes(permission as never);
  }
}

/** シングルトンのプラグインレジストリ */
export const pluginRegistry = new PluginRegistryImpl();
