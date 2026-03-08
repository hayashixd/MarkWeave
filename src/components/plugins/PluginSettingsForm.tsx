/**
 * プラグイン設定動的フォーム
 *
 * plugin-api-design.md §9.2 に準拠。
 * manifest.settings の宣言をもとに設定 UI を動的生成する。
 */

import type { PluginSettingDeclaration } from '../../plugins/plugin-api';

interface PluginSettingsFormProps {
  pluginId: string;
  declarations: PluginSettingDeclaration[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export function PluginSettingsForm({
  pluginId,
  declarations,
  values,
  onChange,
}: PluginSettingsFormProps) {
  if (declarations.length === 0) {
    return <p className="text-sm text-gray-400 py-2">設定項目はありません。</p>;
  }

  return (
    <div className="space-y-4">
      {declarations.map((decl) => (
        <div key={decl.key}>
          <label
            htmlFor={`${pluginId}-${decl.key}`}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {decl.label}
          </label>
          {decl.description && (
            <p className="text-xs text-gray-500 mb-1">{decl.description}</p>
          )}
          <SettingField
            id={`${pluginId}-${decl.key}`}
            decl={decl}
            value={values[decl.key] ?? decl.default}
            onChange={(v) => onChange(decl.key, v)}
          />
        </div>
      ))}
    </div>
  );
}

interface SettingFieldProps {
  id: string;
  decl: PluginSettingDeclaration;
  value: unknown;
  onChange: (v: unknown) => void;
}

function SettingField({ id, decl, value, onChange }: SettingFieldProps) {
  const inputClass = 'block w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';

  switch (decl.type) {
    case 'string':
      return (
        <input
          id={id}
          type="text"
          className={inputClass}
          value={String(value ?? '')}
          placeholder={decl.placeholder}
          maxLength={decl.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'number':
      return (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="range"
            className="flex-1"
            min={decl.min}
            max={decl.max}
            step={decl.step ?? 1}
            value={Number(value)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <input
            type="number"
            className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-center"
            min={decl.min}
            max={decl.max}
            step={decl.step ?? 1}
            value={Number(value)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </div>
      );

    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            id={id}
            type="checkbox"
            className="rounded border-gray-300"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-sm text-gray-700">有効</span>
        </label>
      );

    case 'color':
      return (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="color"
            className="h-8 w-16 rounded border border-gray-300 cursor-pointer"
            value={String(value ?? '#000000')}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="text-xs text-gray-500">{String(value ?? '#000000')}</span>
        </div>
      );

    case 'select':
      return (
        <select
          id={id}
          className={inputClass}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        >
          {decl.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case 'textarea':
      return (
        <textarea
          id={id}
          className={`${inputClass} resize-y`}
          value={String(value ?? '')}
          rows={decl.rows ?? 4}
          placeholder={decl.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    default:
      return null;
  }
}
