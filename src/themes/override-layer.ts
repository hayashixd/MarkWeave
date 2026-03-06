/**
 * CSS 変数オーバーライドレイヤー。
 *
 * theme-design.md §5.7 に準拠。
 * カスタマイザーで変更した CSS 変数は <style id="custom-theme-vars"> タグに書き込む。
 * :root への直接代入はしない（テーマ切り替え時に上書きされてしまうため）。
 */

const OVERRIDE_STYLE_ID = 'custom-theme-vars';

/** 変数オーバーライドを DOM に適用する（即時反映） */
export function applyOverrideVars(vars: Record<string, string>): void {
  let el = document.getElementById(OVERRIDE_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = OVERRIDE_STYLE_ID;
    document.head.appendChild(el);
  }

  if (Object.keys(vars).length === 0) {
    el.textContent = '';
    return;
  }

  const declarations = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  el.textContent = `:root {\n${declarations}\n}`;
}

/** 現在の <style> タグから変数マップを読み取る（設定画面の初期化用） */
export function readCurrentOverrideVars(): Record<string, string> {
  const el = document.getElementById(OVERRIDE_STYLE_ID) as HTMLStyleElement | null;
  if (!el?.textContent) return {};

  const result: Record<string, string> = {};
  for (const match of el.textContent.matchAll(/\s*(--[\w-]+):\s*([^;]+);/g)) {
    result[match[1].trim()] = match[2].trim();
  }
  return result;
}
