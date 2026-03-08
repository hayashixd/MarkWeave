/**
 * 設定ダイアログ - プラグインタブ
 *
 * plugin-api-design.md §9.3 に準拠。
 * PluginManagerPanel をラップする薄いコンポーネント。
 */

import { PluginManagerPanel } from '../../plugins/PluginManagerPanel';

export function PluginsTab() {
  return (
    <div className="h-full flex flex-col">
      <PluginManagerPanel />
    </div>
  );
}
