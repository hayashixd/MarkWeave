# 国際化（i18n）設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-25

---

## 目次

1. [設計方針とフェーズ分け](#1-設計方針とフェーズ分け)
2. [技術選定](#2-技術選定)
3. [辞書ファイル（リソース）の管理構造](#3-辞書ファイルリソースの管理構造)
4. [i18next 初期化設定](#4-i18next-初期化設定)
5. [状態管理（Zustand）とOS連携](#5-状態管理zustandとos連携)
6. [Tauri ネイティブメニューの i18n](#6-tauri-ネイティブメニューの-i18n)
7. [実装ベストプラクティス（Phase 1 コーディングルール）](#7-実装ベストプラクティスphase-1-コーディングルール)

---

## 1. 設計方針とフェーズ分け

### Phase 1（MVP）での方針

- 多言語化の「仕組み（ライブラリとディレクトリ構造）」のみを導入する。
- UI テキストのハードコードを禁止し、すべて翻訳関数経由で出力するルールを徹底する。
- デフォルト言語は「日本語（`ja`）」とし、英語などの他言語の辞書ファイルは空枠のみ用意する。

### Phase 5 以降での方針

- 英語（`en`）辞書の本格的な作成。
- OS のロケール設定との自動同期機能の実装。
- 追加言語（中国語・韓国語等）への対応検討。

---

## 2. 技術選定

| ライブラリ | 用途 |
|-----------|------|
| `i18next` | i18n コアライブラリ |
| `react-i18next` | React バインディング（`useTranslation` フック提供） |

**採用理由**: React エコシステムにおけるデファクトスタンダードであり、`useTranslation` フックを用いた宣言的な UI 構築と相性が良い。また、React コンポーネント外（Zustand のストア内やユーティリティ関数内）でも直接インスタンスを呼び出してテキストを解決できる柔軟性がある。

---

## 3. 辞書ファイル（リソース）の管理構造

単一の巨大な JSON ファイルに全テキストを詰め込むと、将来的な機能追加時にキーの衝突や Git でのマージコンフリクトの温床となる。機能ドメインごとに**名前空間（Namespace）**を分割して管理する。

```plaintext
src/
 └─ locales/
     ├─ ja/
     │   ├─ common.json     # 汎用ボタン「保存」「キャンセル」など
     │   ├─ settings.json   # 環境設定ダイアログの各項目
     │   ├─ editor.json     # エディタ内のトースト通知や状態表示
     │   ├─ menu.json       # アプリケーションメニュー・コンテキストメニュー
     │   └─ errors.json     # エラーコード → ユーザー向けメッセージ
     └─ en/
         ├─ common.json
         ├─ settings.json
         ├─ editor.json
         ├─ menu.json
         └─ errors.json
```

> **`errors.json` について**: Rust バックエンドから返るエラーコード（例: `ERR_FILE_NOT_FOUND`）を
> ユーザー言語に合わせたメッセージへ変換するための専用名前空間。
> 詳細は [error-handling-design.md](../08_Testing_Quality/error-handling-design.md) §5 を参照。

---

## 4. i18next 初期化設定

```typescript
// src/i18n.ts
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
```

`i18n.ts` は `src/main.tsx` の先頭でインポートし、アプリ起動時に必ず初期化する。

---

## 5. 状態管理（Zustand）とOS連携

[user-settings-design.md](./user-settings-design.md) で設計された `settingsStore` と i18next を連動させる。

### 5.1 設定スキーマの拡張

`AppSettings` 型に `language` フィールドを追加する（詳細: [user-settings-design.md](./user-settings-design.md) §3）。

```typescript
// user-settings-design.md §3 の AppSettings に追加
export interface AppSettings {
  // ... 既存フィールド ...
  /** UI 表示言語。'auto' は OS ロケールに自動追従 */
  language: 'auto' | 'ja' | 'en';
}
```

デフォルト値は `'auto'`。

### 5.2 OS 言語の検出（Tauri 連携）

起動時、`language` が `'auto'` の場合は以下の優先順位で OS のロケールを判定する。

| 優先順位 | 手段 | 理由 |
|---------|------|------|
| 1 | `@tauri-apps/plugin-os` の `locale()` API | Tauri アプリとして OS レベルのロケールを正確に取得できる |
| 2 | `navigator.language` | `plugin-os` が利用不可（Web 版・モバイルの一部）な場合のフォールバック |

```typescript
import { locale } from '@tauri-apps/plugin-os';

async function detectOsLanguage(): Promise<'ja' | 'en'> {
  try {
    const osLocale = await locale(); // 例: "ja-JP", "en-US"
    return osLocale?.startsWith('ja') ? 'ja' : 'en';
  } catch {
    // plugin-os が利用不可な環境では navigator.language にフォールバック
    return navigator.language.startsWith('ja') ? 'ja' : 'en';
  }
}
```

### 5.3 動的言語切り替え

Zustand ストアの `language` 更新に subscribe して `i18next.changeLanguage()` を発火させることで、アプリの再起動なしにリアルタイムで UI 言語を切り替える。

```typescript
// settingsStore.ts 内
useSettingsStore.subscribe(
  (state) => state.settings.language,
  async (language) => {
    const lang = language === 'auto' ? await detectOsLanguage() : language;
    await i18next.changeLanguage(lang);
    // Tauri ネイティブメニューの再構築（§6 参照）
    await rebuildNativeMenu(lang);
  }
);
```

---

## 6. Tauri ネイティブメニューの i18n

macOS メニューバーや Windows のシステムメニューは Tauri の Rust 側で構築されるため、React の `useTranslation` が直接使えない。以下の方針で対応する。

### 6.1 対応方針

- React 側でメニューラベルの翻訳済み文字列を組み立て、`invoke('rebuild_native_menu', { labels })` で Rust へ渡す。
- Rust 側は受け取ったラベル文字列でメニューを再構築する（メニューの意味は Rust が持ち、テキストのみを受け渡す）。
- 言語切り替え時は §5.3 の `rebuildNativeMenu()` から呼び出す。

### 6.2 実装スコープ

ネイティブメニューの再構築は複雑なため、Phase 1 では**初回起動時の言語設定のみ反映**する（再起動不要な動的切り替えは Phase 5 以降に対応）。

---

## 7. 実装ベストプラクティス（Phase 1 コーディングルール）

Phase 1 から以下のルールを適用することで、後からの多言語化対応（文字列の抽出・置換作業）という技術的負債を回避する。

### 7.1 UI テキストのハードコード禁止

```typescript
// ❌ 悪い例（後から修正が大変）
<button>保存して閉じる</button>

// ✅ 良い例
import { useTranslation } from 'react-i18next';

export const SaveButton = () => {
  const { t } = useTranslation('common');
  return <button>{t('actions.saveAndClose')}</button>;
};
```

### 7.2 動的テキストにおける文字列結合の禁止

言語によって語順（主語・動詞・目的語の順番）は異なるため、変数を文字列結合してはならない。

```typescript
// ❌ 悪い例
const message = count + '件のファイルを削除しました';

// ✅ 良い例（辞書側: "deletedFiles": "{{count}}件のファイルを削除しました"）
const message = t('editor.deletedFiles', { count: 3 });
```

### 7.3 Tauri コマンド（Rust）のエラーハンドリング

Rust 側からフロントエンドへエラーを返す際、Rust 側で日本語のエラーメッセージを生成せず、**エラーコード**（例: `ERR_FILE_NOT_FOUND`）を返す。フロントエンドでそのコードを受け取り、`t('errors.ERR_FILE_NOT_FOUND')` としてユーザー言語に合わせたメッセージに変換してトースト表示する（[error-handling-design.md](../08_Testing_Quality/error-handling-design.md) §5 準拠）。

```typescript
// ❌ 悪い例（Rust 側で言語固定のメッセージを生成）
// Err("ファイルが見つかりません".to_string())

// ✅ 良い例（Rust 側はエラーコードのみ返す）
// Err("ERR_FILE_NOT_FOUND".to_string())

// フロントエンド側
try {
  await invoke('open_file', { path });
} catch (errorCode) {
  toast.error(t(`errors.${errorCode}`));
}
```

---

## 関連ドキュメント

| ドキュメント | 関連内容 |
|-------------|---------|
| [user-settings-design.md](./user-settings-design.md) | `AppSettings.language` フィールド・`settingsStore` 設計 |
| [error-handling-design.md](../08_Testing_Quality/error-handling-design.md) | エラーコード体系・トースト通知設計 |
| [cross-platform-design.md](./cross-platform-design.md) | OS 別ロケール差異・`plugin-os` 対応状況 |
| [app-shell-design.md](../03_UI_UX/app-shell-design.md) | Tauri ネイティブメニュー構造 |
