/**
 * i18next 初期化設定
 *
 * i18n-design.md §4 に準拠。
 * Phase 1: 日本語のみ。英語辞書は空枠として配置。
 */
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

// 各名前空間の辞書を静的インポート（Vite バンドル最適化）
import jaCommon from './locales/ja/common.json';
import jaSettings from './locales/ja/settings.json';
import jaEditor from './locales/ja/editor.json';
import jaMenu from './locales/ja/menu.json';
import jaErrors from './locales/ja/errors.json';
// en は Phase 5 以降に追加

i18next
  .use(initReactI18next)
  .init({
    lng: 'ja',           // 初期言語（起動時に settingsStore の値で上書き）
    fallbackLng: 'ja',   // 該当キーが未翻訳の場合は日本語にフォールバック
    defaultNS: 'common', // デフォルト名前空間
    resources: {
      ja: {
        common: jaCommon,
        settings: jaSettings,
        editor: jaEditor,
        menu: jaMenu,
        errors: jaErrors,
      },
    },
    interpolation: {
      escapeValue: false, // React が XSS エスケープを担うため不要
    },
  });

export default i18next;
