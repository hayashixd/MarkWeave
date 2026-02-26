# プラグイン API 設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-25

---

## 目次

1. [設計方針](#1-設計方針)
2. [プラグインの拡張ポイント](#2-プラグインの拡張ポイント)
3. [プラグイン API 型定義](#3-プラグイン-api-型定義)
4. [サンドボックス設計](#4-サンドボックス設計)
5. [ビルトインプラグイン](#5-ビルトインプラグイン)
6. [プラグインのライフサイクル](#6-プラグインのライフサイクル)
7. [プラグインの配布とインストール](#7-プラグインの配布とインストール)
8. [実装フェーズ](#8-実装フェーズ)
9. [プラグイン設定 GUI とストア UX](#9-プラグイン設定-gui-とストア-ux)
10. [プラグインパフォーマンス監視と通信オーバーヘッド対策](#10-プラグインパフォーマンス監視と通信オーバーヘッド対策)

---

## 1. 設計方針

### 1.1 基本方針

- **ビルトインプラグインも同じ API に乗せる**: Mermaid・KaTeX・画像処理等のビルトイン機能はプラグイン API を通じて実装し、サードパーティ製プラグインと同一の拡張メカニズムを使う。API の品質を自分たちで検証する仕組みでもある
- **API 契約を早期に固定する**: 一度公開した拡張ポイント（特に `registerNodeType` / `registerCommand`）は後方互換を破れない。Phase 1〜2 のコアアーキテクチャ設計と並行して API の「形」を確定させる
- **サードパーティコードは iframe で隔離する**: ユーザーがインストールした外部プラグインは `<iframe sandbox>` 内で実行し、エディタコアの DOM や Tauri IPC に直接アクセスできないようにする
- **ビルトインプラグインはメインスレッドで実行**: iframe のオーバーヘッドを避けるため、信頼できるビルトインプラグインはメインスレッドで直接実行する

### 1.2 拡張モデルの全体像

```
┌─────────────────────────────────────────────────────────┐
│                    エディタコア                           │
│  TipTap / ProseMirror                                   │
│                                                         │
│  PluginRegistry                                         │
│    ├─ register()                                        │
│    ├─ unregister()                                      │
│    └─ getAll()                                          │
└─────────────┬───────────────────────────────────────────┘
              │ EditorPluginAPI（公開インターフェース）
    ┌─────────┴─────────────────────────────────┐
    │                                           │
    ▼                                           ▼
ビルトインプラグイン                    サードパーティプラグイン
（メインスレッド実行）                  （iframe sandbox 内実行）
  ├─ mermaid-plugin.ts                   ├─ PluginProxy（postMessage）
  ├─ math-plugin.ts                      └─ PluginBridge（iframe管理）
  └─ image-plugin.ts
```

---

## 2. プラグインの拡張ポイント

プラグインは以下の拡張ポイントを組み合わせて機能を追加する。

| 拡張ポイント | 説明 | 例 |
|------------|------|-----|
| `registerNodeType` | カスタム Markdown ノードタイプを追加 | Mermaid コードブロック |
| `registerNodeView` | カスタム NodeView（React コンポーネント）を登録 | 数式レンダラー |
| `registerCommand` | エディタコマンドを追加（ツールバー等から呼べる）| 図表挿入コマンド |
| `registerInputRule` | 入力ルール（オートフォーマット）を追加 | `$$` → 数式ブロック |
| `registerToolbarItem` | ツールバーにボタン/ドロップダウンを追加 | 図表メニュー |
| `registerMenuitem` | ネイティブメニュー（Tauri）にアイテムを追加 | 「図表として挿入」|
| `registerSidebarPanel` | サイドバーにパネルを追加 | テンプレート一覧 |
| `registerMarkdownProcessor` | Markdown の前処理/後処理を追加 | Front Matter 除去 |
| `registerExportPlugin` | エクスポートパイプラインに処理を追加 | 独自要素のHTML変換 |

---

## 3. プラグイン API 型定義

### 3.1 EditorPlugin インターフェース（拡張版）

```typescript
// src/plugins/plugin-api.ts（現行の骨格を拡張）

import { Extension, Node, Mark } from '@tiptap/core';

/**
 * プラグインのメタデータ
 */
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
}

/**
 * プラグインが要求できる権限
 */
export type PluginPermission =
  | 'editor:read'        // エディタのドキュメント内容を読み取る
  | 'editor:write'       // エディタのドキュメントを変更する
  | 'editor:command'     // コマンドを発行する
  | 'clipboard:read'     // クリップボードを読み取る
  | 'clipboard:write'    // クリップボードに書き込む
  | 'fs:read'            // ファイルを読み取る（ワークスペース外は不可）
  | 'fs:write'           // ファイルを書き込む（ワークスペース外は不可）
  | 'network:fetch'      // 外部 URL へ fetch する
  | 'ui:toolbar'         // ツールバーを変更する
  | 'ui:sidebar'         // サイドバーパネルを追加する
  | 'ui:menu'            // ネイティブメニューにアイテムを追加する
  | 'ui:dialog'          // ダイアログを表示する
  | 'ui:toast';          // トースト通知を表示する

/**
 * プラグインが受け取る API オブジェクト
 * プラグインはこのオブジェクト経由でのみエディタと通信する
 */
export interface EditorPluginAPI {
  /** エディタ操作 API */
  editor: {
    /** 現在のドキュメントを Markdown 文字列として取得（'editor:read' 権限必須）*/
    getMarkdown(): string;
    /** 指定位置にテキストを挿入（'editor:write' 権限必須）*/
    insertText(text: string): void;
    /** コマンドを発行（'editor:command' 権限必須）*/
    chain(): ChainedCommands;
  };

  /** TipTap 拡張を登録する（ビルトインプラグイン専用、サードパーティ不可）*/
  registerExtension(extension: Extension | Node | Mark): void;

  /** NodeView（React コンポーネント）を登録する */
  registerNodeView(
    nodeTypeName: string,
    component: React.ComponentType<NodeViewProps>
  ): void;

  /** ツールバーにアイテムを追加（'ui:toolbar' 権限必須）*/
  registerToolbarItem(item: ToolbarItem): void;

  /** サイドバーにパネルを追加（'ui:sidebar' 権限必須）*/
  registerSidebarPanel(panel: SidebarPanel): void;

  /** 入力ルールを追加（'editor:write' 権限必須）*/
  registerInputRule(rule: InputRuleDefinition): void;

  /** Markdown エクスポート前処理を追加 */
  registerMarkdownProcessor(processor: MarkdownProcessor): void;

  /** UI ユーティリティ */
  ui: {
    /** トースト通知（'ui:toast' 権限必須）*/
    showToast(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
    /** ダイアログを表示（'ui:dialog' 権限必須）*/
    showDialog(options: DialogOptions): Promise<DialogResult>;
  };
}

/**
 * プラグインの実装インターフェース
 * ビルトイン・サードパーティともにこのインターフェースを実装する
 */
export interface EditorPlugin {
  manifest: PluginManifest;

  /**
   * プラグイン初期化。
   * api は manifest.permissions で宣言した権限の範囲でのみ動作する。
   */
  activate(api: EditorPluginAPI): void | Promise<void>;

  /**
   * プラグイン破棄（リソース解放）。
   */
  deactivate?(): void | Promise<void>;
}
```

### 3.2 ToolbarItem / SidebarPanel 型

```typescript
export interface ToolbarItem {
  /** ツールバー上での識別子 */
  id: string;
  /** ツールチップテキスト */
  title: string;
  /** アイコン（SVG 文字列 or lucide-react のアイコン名）*/
  icon: string;
  /** クリック時のアクション */
  onClick(): void;
  /**
   * 現在アクティブか（ボタンのハイライト表示）
   * 未指定の場合は常に非アクティブ
   */
  isActive?(): boolean;
  /** ドロップダウンメニューアイテム（省略時は単純ボタン）*/
  items?: Array<{ label: string; onClick(): void }>;
  /** 区切り位置（'before' で左に区切り線）*/
  separator?: 'before' | 'after';
}

export interface SidebarPanel {
  /** パネルの識別子 */
  id: string;
  /** タブのラベル */
  label: string;
  /** タブのアイコン */
  icon: string;
  /**
   * パネルのコンテンツを返す React コンポーネント。
   * iframe でサンドボックス化する場合は HTML 文字列を返す。
   */
  component: React.ComponentType;
}
```

---

## 4. サンドボックス設計

### 4.1 サードパーティプラグインの実行環境

```
┌─────────────────────────────────────────────────────────────┐
│  メインウィンドウ（信頼済み領域）                              │
│                                                             │
│  PluginBridge                                               │
│    - プラグイン用 iframe を生成・管理                         │
│    - postMessage で API 要求を受け取る                       │
│    - 権限チェック後、エディタコアを操作                       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  <iframe sandbox="allow-scripts">                    │   │
│  │  ※ allow-same-origin は付与しない（DOM アクセス不可）  │   │
│  │                                                      │   │
│  │  サードパーティプラグインコード                         │   │
│  │    - エディタコアに直接アクセス不可                    │   │
│  │    - Tauri IPC に直接アクセス不可                     │   │
│  │    - postMessage でのみ PluginBridge と通信           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 iframe sandbox 属性

```html
<!-- サードパーティプラグイン実行用 iframe -->
<iframe
  id="plugin-sandbox-{pluginId}"
  sandbox="allow-scripts"
  src="plugin-runtime.html"
  style="display: none;"
/>
```

`allow-same-origin` を付与しないことで、iframe 内コードは以下にアクセスできない:
- `parent.document`（メインウィンドウの DOM）
- `window.__TAURI__`（Tauri IPC）
- `localStorage` / `sessionStorage`
- `indexedDB`

### 4.3 postMessage プロトコル

```typescript
// プラグイン → PluginBridge への要求
interface PluginRequest {
  type: 'api_call';
  callId: string;            // 非同期応答の照合用
  method: string;            // 例: 'editor.getMarkdown'
  args: unknown[];
}

// PluginBridge → プラグインへの応答
interface PluginResponse {
  type: 'api_response';
  callId: string;
  result?: unknown;
  error?: string;
}

// PluginBridge.ts（メインウィンドウ側）
class PluginBridge {
  private iframes = new Map<string, HTMLIFrameElement>();

  constructor() {
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  private async handleMessage(event: MessageEvent) {
    // 1. 送信元 iframe を特定（pluginId を照合）
    const pluginId = this.getPluginIdFromFrame(event.source as Window);
    if (!pluginId) return;

    const req = event.data as PluginRequest;
    if (req.type !== 'api_call') return;

    // 2. 権限チェック
    const plugin = pluginRegistry.get(pluginId);
    if (!this.hasPermission(plugin, req.method)) {
      this.sendResponse(event.source as Window, req.callId, {
        error: `権限がありません: ${req.method}`,
      });
      return;
    }

    // 3. API を実行してレスポンスを返す
    try {
      const result = await this.executeApiCall(req.method, req.args);
      this.sendResponse(event.source as Window, req.callId, { result });
    } catch (err) {
      this.sendResponse(event.source as Window, req.callId, {
        error: String(err),
      });
    }
  }

  private hasPermission(plugin: EditorPlugin, method: string): boolean {
    const requiredPermission = API_METHOD_PERMISSION_MAP[method];
    return plugin.manifest.permissions.includes(requiredPermission);
  }
}
```

### 4.4 ファイルシステムアクセスの制限

`fs:read` / `fs:write` 権限を持つプラグインでも、アクセスできるパスは**現在のワークスペースフォルダ内のみ**に制限する。Tauri バックエンド側の `plugin-fs` スコープ制限を使用する。

```rust
// src-tauri/src/lib.rs（プラグイン向け fs コマンド）

#[tauri::command]
pub async fn plugin_read_file(
    app: AppHandle,
    plugin_id: String,
    path: String,
) -> Result<String, String> {
    // ワークスペースパス内かどうかを検証
    let workspace_path = get_current_workspace_path(&app)?;
    let abs_path = resolve_path(&workspace_path, &path)?;

    if !abs_path.starts_with(&workspace_path) {
        return Err("プラグインはワークスペース外のファイルにアクセスできません".into());
    }

    std::fs::read_to_string(&abs_path).map_err(|e| e.to_string())
}
```

---

## 5. ビルトインプラグイン

ビルトインプラグインはメインスレッドで実行され、`registerExtension` でTipTap Extension を直接登録できる（サードパーティプラグインは不可）。

### 5.1 Mermaid プラグイン

```typescript
// src/plugins/built-in/mermaid-plugin.ts

import { Node } from '@tiptap/core';
import type { EditorPlugin, EditorPluginAPI } from '../plugin-api';

const MermaidExtension = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return { code: { default: '' } };
  },

  // ... NodeView 定義等
});

export const mermaidPlugin: EditorPlugin = {
  manifest: {
    id: 'builtin.mermaid',
    name: 'Mermaid 図表',
    version: '1.0.0',
    permissions: ['editor:read', 'editor:write', 'ui:toolbar'],
  },

  activate(api: EditorPluginAPI) {
    // TipTap Extension を登録（ビルトイン専用 API）
    api.registerExtension(MermaidExtension);

    api.registerToolbarItem({
      id: 'insert-mermaid',
      title: 'Mermaid 図表を挿入',
      icon: 'git-fork',
      onClick: () => api.editor.chain().insertMermaidBlock().run(),
    });

    api.registerInputRule({
      pattern: /^```mermaid\s$/,
      handler: ({ state, range }) => {
        // mermaidBlock ノードに変換
      },
    });
  },
};
```

### 5.2 ビルトインプラグイン一覧

| プラグイン ID | 名前 | フェーズ |
|-------------|------|---------|
| `builtin.mermaid` | Mermaid 図表 | Phase 3 |
| `builtin.math` | KaTeX 数式 | Phase 3 |
| `builtin.image` | 画像挿入・管理 | Phase 3 |
| `builtin.ai-copy` | AI コピーボタン | Phase 8 |
| `builtin.ai-templates` | AI テンプレート | Phase 8 |

---

## 6. プラグインのライフサイクル

```
プラグイン登録フロー:

[プラグインファイル読み込み]
  │  JSON マニフェスト検証
  ▼
[権限の確認ダイアログ]
  │  「このプラグインは以下の権限を要求します: ...」
  │  ユーザーが承認した場合のみ続行
  ▼
[PluginRegistry.register(plugin)]
  │
  ▼
[plugin.activate(api) 呼び出し]
  │  エラー時: PluginRegistry から除去 + トースト通知
  ▼
[プラグイン稼働中]
  │
  ├─ プラグイン無効化（ユーザー操作）
  │    → plugin.deactivate()
  │    → 登録した Extension / ToolbarItem 等を除去
  │    → iframe 破棄
  │
  └─ プラグインクラッシュ（iframe 例外）
       → エラーをキャプチャ
       → トースト通知:「プラグイン "{name}" がクラッシュしました」
       → プラグインを自動無効化
```

### 6.1 プラグインのクリーンアップ

```typescript
// PluginManager.ts

class PluginManager {
  private disposables = new Map<string, Array<() => void>>();

  async activatePlugin(plugin: EditorPlugin): Promise<void> {
    const disposableList: Array<() => void> = [];

    // API オブジェクトをファクトリから生成
    // 各 register* は disposable を返す
    const api = createPluginAPI(plugin.manifest, (disposable) => {
      disposableList.push(disposable);
    });

    try {
      await plugin.activate(api);
      this.disposables.set(plugin.manifest.id, disposableList);
    } catch (err) {
      // クリーンアップ
      disposableList.forEach(d => d());
      throw err;
    }
  }

  async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = this.registry.get(pluginId);
    await plugin?.deactivate?.();

    // 登録したすべての拡張を除去
    const disposables = this.disposables.get(pluginId) ?? [];
    disposables.forEach(d => d());
    this.disposables.delete(pluginId);
    this.registry.unregister(pluginId);
  }
}
```

---

## 7. プラグインの配布とインストール

### 7.1 プラグインの形式

```
my-plugin/
├── manifest.json     # プラグインメタデータ（id・name・version・permissions）
├── index.js          # プラグインのエントリポイント（バンドル済み JS）
└── README.md         # プラグインの説明（任意）
```

```jsonc
// manifest.json
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "カスタム図表を表示するプラグイン",
  "author": "Example Author",
  "permissions": ["editor:read", "editor:write", "ui:toolbar"]
}
```

### 7.2 インストール方法（Phase 7）

```
設定 → プラグイン → プラグインを追加
  ├─ フォルダを選択（ローカルインストール）
  │    → manifest.json を検証
  │    → 権限確認ダイアログを表示
  │    → ~/.config/md-editor/plugins/{plugin-id}/ にコピー
  │
  └─ [将来] プラグインマーケットプレイスから検索してインストール
```

### 7.3 プラグインの永続化

インストール済みプラグインの一覧と有効/無効状態は `@tauri-apps/plugin-store` に保存する。

```typescript
// ~/.config/md-editor/settings.json（プラグイン設定部分）
{
  "plugins": {
    "installed": [
      { "id": "com.example.my-plugin", "enabled": true, "path": "...", "version": "1.0.0" }
    ]
  }
}
```

### 7.4 プラグインの更新フロー

プラグインの更新は「インストール済みの旧バージョン」を「新バージョン」で置き換える操作。
Phase 7 でローカルインストールと同時に実装する。

#### 7.4.1 更新フロー

```
設定 → プラグイン → [プラグイン名] → 「更新を確認」または「更新ファイルを選択」
  ├─ バージョン比較（manifest.json の "version" フィールド）
  │    → 新バージョン > 現バージョン: 更新可能
  │    → 同じ / 古い: 「最新版です」または「ダウングレードは手動インストールで行ってください」
  │
  ├─ API 互換性チェック
  │    → 新バージョンの "minApiVersion" が現アプリの API バージョン以下: 更新可能
  │    → "minApiVersion" が現アプリより高い: 「このプラグインはアプリを更新してから使用してください」
  │
  ├─ 権限変更の確認
  │    → 旧バージョンにない新権限が含まれる場合: 再度権限確認ダイアログを表示
  │
  └─ インストール実行
       → 旧バージョンを削除（ファイルを退避してバックアップ保持）
       → 新バージョンを所定ディレクトリに配置
       → プラグインを再起動（ページリロード不要: PluginManager.deactivate + activate）
```

#### 7.4.2 ロールバック

更新直後に問題が発生した場合:

```
設定 → プラグイン → [プラグイン名] → 「前バージョンに戻す」
  → バックアップから旧バージョンを復元
  → プラグインを再起動
```

バックアップは更新ごとに 1 世代のみ保持する（前々バージョンは自動削除）。

#### 7.4.3 manifest.json への追加フィールド

```jsonc
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.1.0",
  "minApiVersion": "3.0",   // このプラグインが必要とする最低 API バージョン
  "changelog": "バグ修正・パフォーマンス改善",
  "permissions": ["editor:read", "editor:write"]
}
```

---

## 8. 実装フェーズ

### Phase 3（ビルトインプラグイン基盤）

- [ ] `PluginManifest` / `EditorPluginAPI` / `EditorPlugin` 型定義を確定
- [ ] `PluginRegistry` 実装（register / unregister / getAll）
- [ ] `PluginManager` 実装（activate / deactivate / クリーンアップ）
- [ ] ビルトインプラグイン用 API（`registerExtension` を含む）の実装
- [ ] `mermaid-plugin`・`math-plugin`・`image-plugin` をビルトインプラグインとして移行

### Phase 7（サードパーティプラグイン対応）

- [ ] `PluginBridge` 実装（iframe 生成・postMessage ハンドラ）
- [ ] 権限確認ダイアログ UI
- [ ] `plugin-runtime.html`（iframe 内で動くプラグインランタイム）実装
- [ ] ローカルプラグインのインストール UI（設定ダイアログへの組み込み）
- [ ] Rust 側のプラグイン向け `fs:read` / `fs:write` スコープ制限コマンド
- [ ] プラグインのクラッシュ検知・自動無効化
- [ ] プラグイン管理 UI（有効/無効・アンインストール）
- [ ] §9 で設計したプラグイン設定 GUI・動的フォーム生成の実装
- [ ] セーフモード起動オプション（`--safe-mode` フラグ）

---

## 9. プラグイン設定 GUI とストア UX

### 9.1 manifest.json 設定宣言スキーマ

プラグインが提供する設定項目を `manifest.json` の `settings` フィールドで宣言する。アプリはこの宣言をもとに設定 UI を**動的生成**する。

```jsonc
// manifest.json（拡張版）
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "permissions": ["editor:read", "ui:toolbar"],

  "settings": [
    {
      "key": "highlightColor",
      "label": "ハイライト色",
      "type": "color",
      "default": "#ffeb3b",
      "description": "ハイライト要素の背景色"
    },
    {
      "key": "fontSize",
      "label": "フォントサイズ (px)",
      "type": "number",
      "default": 16,
      "min": 10,
      "max": 48,
      "step": 1
    },
    {
      "key": "mode",
      "label": "動作モード",
      "type": "select",
      "default": "auto",
      "options": [
        { "value": "auto",   "label": "自動" },
        { "value": "manual", "label": "手動" },
        { "value": "off",    "label": "オフ" }
      ]
    },
    {
      "key": "enableNotifications",
      "label": "通知を有効にする",
      "type": "boolean",
      "default": true
    },
    {
      "key": "apiEndpoint",
      "label": "API エンドポイント URL",
      "type": "string",
      "default": "https://api.example.com",
      "placeholder": "https://...",
      "description": "外部 API の URL（network:fetch 権限が必要）"
    }
  ]
}
```

**設定フィールドの型一覧:**

| `type` | 対応する React コンポーネント | 追加属性 |
|--------|--------------------------|---------|
| `string` | `<input type="text">` | `placeholder`, `maxLength` |
| `number` | `<input type="number">` + スライダー | `min`, `max`, `step` |
| `boolean` | `<input type="checkbox">` | — |
| `color` | カラーピッカー（§9.2 参照） | — |
| `select` | `<select>` ドロップダウン | `options: [{value, label}]` |
| `textarea` | `<textarea>` | `rows`, `placeholder` |
| `file` | ファイルピッカー（Tauri dialog） | `filters: [{name, extensions}]` |

### 9.2 動的フォーム生成（Dynamic Settings Form）

```typescript
// src/components/PluginSettingsForm.tsx

import type { PluginSettingDeclaration } from '../plugins/plugin-api';

interface PluginSettingsFormProps {
  pluginId: string;
  declarations: PluginSettingDeclaration[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export function PluginSettingsForm({
  pluginId, declarations, values, onChange,
}: PluginSettingsFormProps) {
  return (
    <div className="plugin-settings-form">
      {declarations.map(decl => (
        <div key={decl.key} className="settings-row">
          <label htmlFor={`${pluginId}-${decl.key}`}>{decl.label}</label>
          {decl.description && (
            <p className="settings-description">{decl.description}</p>
          )}
          <SettingField
            id={`${pluginId}-${decl.key}`}
            decl={decl}
            value={values[decl.key] ?? decl.default}
            onChange={v => onChange(decl.key, v)}
          />
        </div>
      ))}
    </div>
  );
}

function SettingField({
  id, decl, value, onChange,
}: {
  id: string;
  decl: PluginSettingDeclaration;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (decl.type) {
    case 'string':
      return (
        <input
          id={id}
          type="text"
          value={String(value ?? '')}
          placeholder={decl.placeholder}
          maxLength={decl.maxLength}
          onChange={e => onChange(e.target.value)}
        />
      );
    case 'number':
      return (
        <div className="number-field">
          <input
            id={id}
            type="range"
            min={decl.min} max={decl.max} step={decl.step}
            value={Number(value)}
            onChange={e => onChange(Number(e.target.value))}
          />
          <input
            type="number"
            min={decl.min} max={decl.max} step={decl.step}
            value={Number(value)}
            onChange={e => onChange(Number(e.target.value))}
          />
        </div>
      );
    case 'boolean':
      return (
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => onChange(e.target.checked)}
        />
      );
    case 'color':
      return (
        <input
          id={id}
          type="color"
          value={String(value ?? '#000000')}
          onChange={e => onChange(e.target.value)}
        />
      );
    case 'select':
      return (
        <select id={id} value={String(value)} onChange={e => onChange(e.target.value)}>
          {decl.options?.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    case 'textarea':
      return (
        <textarea
          id={id}
          value={String(value ?? '')}
          rows={decl.rows ?? 4}
          placeholder={decl.placeholder}
          onChange={e => onChange(e.target.value)}
        />
      );
    default:
      return null;
  }
}
```

**型定義の追加（`plugin-api.ts`）:**

```typescript
// src/plugins/plugin-api.ts に追加

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

// PluginManifest に settings フィールドを追加
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  repository?: string;
  permissions: PluginPermission[];
  settings?: PluginSettingDeclaration[];   // ← 追加
  minApiVersion?: string;
  changelog?: string;
}

// プラグイン API にプラグイン設定アクセス手段を追加
export interface EditorPluginAPI {
  // ... 既存フィールド ...

  /** プラグイン設定へのアクセス */
  settings: {
    /** 設定値を取得（宣言した key のみ） */
    get<T = unknown>(key: string): T;
    /** 設定値を変更（ui:settings 権限不要、自己設定変更は常に許可） */
    set(key: string, value: unknown): Promise<void>;
    /** 設定変更を購読 */
    onChange(key: string, handler: (value: unknown) => void): () => void;
  };
}
```

### 9.3 プラグインストア UI レイアウト

```
設定 → プラグイン

┌─────────────────────────────────────────────────────────────────┐
│  プラグイン                                                      │
├──────────────────────────────┬──────────────────────────────────┤
│  インストール済み (3)          │  [My Plugin]                    │
│  ────────────────────────    │  v1.0.0  ·  com.example.my-plugin│
│  ✅ My Plugin       [設定 ▶] │                                  │
│  ✅ Highlight Tool  [設定 ▶] │  ハイライト色                    │
│  🔴 Broken Plugin   [削除]   │  ████ #ffeb3b                    │
│                              │                                  │
│  + プラグインを追加           │  フォントサイズ (px)             │
│    （フォルダを選択）          │  ─────●────  16                  │
│                              │                                  │
│                              │  動作モード                      │
│                              │  [自動       ▼]                  │
│                              │                                  │
│                              │  [✓] 通知を有効にする            │
│                              │                                  │
│                              │  API エンドポイント URL          │
│                              │  [https://api.example.com    ]   │
│                              │                                  │
│                              │  [無効にする]  [アンインストール] │
└──────────────────────────────┴──────────────────────────────────┘
```

**プラグイン状態表示:**

| アイコン | 状態 | 説明 |
|--------|------|------|
| ✅ | 有効 | 正常稼働中 |
| ⏸ | 無効 | ユーザーが手動で無効化 |
| 🔴 | エラー | クラッシュ・起動失敗 |
| 🔒 | セーフモード | セーフモード起動のため自動無効化 |

### 9.4 プラグイン設定の永続化

プラグイン設定は `@tauri-apps/plugin-store` の `settings.json` に `plugins.settings` セクションとして保存する。

```typescript
// settings.json（プラグイン設定部分）
{
  "plugins": {
    "installed": [
      { "id": "com.example.my-plugin", "enabled": true, "path": "...", "version": "1.0.0" }
    ],
    "settings": {
      "com.example.my-plugin": {
        "highlightColor": "#ff9900",
        "fontSize": 18,
        "mode": "manual",
        "enableNotifications": false,
        "apiEndpoint": "https://custom.api.com"
      }
    }
  }
}
```

```typescript
// src/plugins/pluginSettingsStore.ts
import { create } from 'zustand';
import { load } from '@tauri-apps/plugin-store';

interface PluginSettingsStore {
  /** プラグインID → 設定値マップ */
  settings: Record<string, Record<string, unknown>>;
  getPluginSettings: (pluginId: string) => Record<string, unknown>;
  setPluginSetting: (pluginId: string, key: string, value: unknown) => Promise<void>;
}

export const usePluginSettingsStore = create<PluginSettingsStore>((set, get) => ({
  settings: {},

  getPluginSettings: (pluginId) => get().settings[pluginId] ?? {},

  setPluginSetting: async (pluginId, key, value) => {
    const next = {
      ...get().settings,
      [pluginId]: { ...get().settings[pluginId], [key]: value },
    };
    set({ settings: next });
    const store = await load('settings.json');
    await store.set('plugins.settings', next);
    await store.save();
  },
}));
```

### 9.5 セーフモード設計

セーフモードでは全サードパーティプラグインを無効化して起動する。クラッシュループからの回復手段。

```
セーフモード起動トリガー:
  1. コマンドラインオプション: mdeditor --safe-mode
  2. クラッシュリカバリ検出: 連続 3 回起動失敗 → 次回はセーフモード
  3. 起動時の確認ダイアログ（重篤クラッシュ後）

セーフモード中の動作:
  - ビルトインプラグインは通常通り有効（Mermaid・KaTeX・画像）
  - サードパーティプラグインは全て 🔒 無効化（永続設定は保持）
  - ステータスバーに「🔒 セーフモード」バナー表示
  - 設定画面の「通常モードで再起動」ボタンからのみ通常起動に戻れる
```

```typescript
// src/plugins/safeMode.ts
import { invoke } from '@tauri-apps/api/core';

export async function isSafeModeActive(): Promise<boolean> {
  return invoke<boolean>('is_safe_mode_active');
}

export async function restartInNormalMode(): Promise<void> {
  await invoke('restart_app', { safeMode: false });
}

// PluginManager.activatePlugin の先頭で呼ばれる
export function shouldSkipPlugin(pluginId: string, safeModeActive: boolean): boolean {
  if (!safeModeActive) return false;
  // ビルトインプラグインは ID が "builtin." で始まる
  return !pluginId.startsWith('builtin.');
}

---

## 10. プラグインパフォーマンス監視と通信オーバーヘッド対策

### 10.1 問題の整理

サードパーティプラグインは `<iframe sandbox>` 内で実行され、エディタコアとは **postMessage による非同期 IPC** でのみ通信する（§4 参照）。この設計はセキュリティ面で堅牢だが、パフォーマンス面でのリスクを持つ。

`performance-design.md §1` で定義したキー入力レイテンシ目標は **< 16ms (60fps)**。ユーザーが1文字タイプするたびに iframe 内のプラグインに `editor:onChange` イベントを送信し、処理結果を受け取って DOM を更新するような処理（例: カスタムシンタックスハイライト・リアルタイム Lint）が走ると、16ms のバジェットを容易に超過する。

```
キー入力 → TipTap トランザクション → [16ms 以内に]
  ├─ DOM 更新（ProseMirror）        ≈ 2〜5ms   ← OK
  ├─ postMessage → iframe 処理 → postMessage 応答 → DOM 更新
  │                                ≈ 5〜50ms+  ← 問題
  └─ 合計で 16ms 超過 → コマ落ち
```

### 10.2 設計原則

1. **エディタ更新イベントはスロットリングする**: プラグインへの `editor:onChange` 通知は最低でも **100ms デバウンス**をかける。リアルタイム処理は要求しない
2. **プラグインの処理はメインスレッドをブロックしない**: iframe 内での処理は非同期 postMessage で完結し、エディタ側は応答を**ブロック待ちしない**
3. **処理時間を計測・監視する**: 遅いプラグインを検出して警告・自動無効化する
4. **重い処理は Web Worker に委譲する**: プラグイン内でも Web Worker を使えるよう設計する

---

### 10.3 エディタイベントのスロットリング

プラグインへの `editor:onChange` イベントは**デバウンス付き**で通知する。プラグインがリアルタイム処理を要求しても、エディタのレイテンシには影響しない。

```typescript
// src/plugins/plugin-bridge.ts（イベント通知部分）

/**
 * エディタ変更をプラグインに通知するデバウンサー。
 * キー入力ごとに即時通知するのではなく、入力停止後に一括通知する。
 */
const EDITOR_CHANGE_DEBOUNCE_MS = 100;

export class PluginBridge {
  private changeDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * エディタ変更をすべてのプラグインに通知する。
   * 100ms デバウンス付き。
   */
  notifyEditorChange(changePayload: EditorChangePayload): void {
    for (const [pluginId, iframe] of this.iframes) {
      // 既存タイマーをキャンセルして再スケジュール
      const existing = this.changeDebounceTimers.get(pluginId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        this.changeDebounceTimers.delete(pluginId);
        iframe.contentWindow?.postMessage({
          type: 'editor_event',
          eventName: 'editor:onChange',
          payload: changePayload,
        }, '*');
      }, EDITOR_CHANGE_DEBOUNCE_MS);

      this.changeDebounceTimers.set(pluginId, timer);
    }
  }

  /**
   * ユーザー操作に直結する低レイテンシイベント（カーソル移動・選択変化等）は
   * デバウンスなしで通知するが、「fire-and-forget」であり応答を待たない。
   */
  notifySelectionChange(payload: SelectionPayload): void {
    for (const [, iframe] of this.iframes) {
      iframe.contentWindow?.postMessage({
        type: 'editor_event',
        eventName: 'editor:onSelectionChange',
        payload,
      }, '*');
      // ← 応答を await しない（fire-and-forget）
    }
  }
}
```

---

### 10.4 プラグイン処理時間の計測

`PluginBridge` は各プラグインへの API 呼び出しの往復時間（RTT）を計測し、移動平均を追跡する。

```typescript
// src/plugins/plugin-bridge.ts（計測部分）

interface PluginPerfStats {
  pluginId: string;
  /** 直近 N 回の API 呼び出し RTT（ms）*/
  recentRtts: number[];
  /** RTT の移動平均（ms）*/
  avgRtt: number;
  /** 遅延超過カウント（SLOW_THRESHOLD_MS を超えた回数）*/
  slowCount: number;
  /** 連続タイムアウト回数 */
  timeoutCount: number;
}

const SLOW_THRESHOLD_MS = 50;       // これを超えると「遅い」
const TIMEOUT_MS = 2000;            // 2秒で応答なし → タイムアウト
const MAX_SLOW_COUNT = 10;          // 10回遅延 → 警告
const MAX_CONSECUTIVE_TIMEOUTS = 3; // 3回連続タイムアウト → 自動無効化
const RTT_WINDOW = 20;              // 移動平均の窓サイズ

export class PluginBridge {
  private perfStats = new Map<string, PluginPerfStats>();

  private async executeApiCall(
    pluginId: string,
    method: string,
    args: unknown[]
  ): Promise<unknown> {
    const callId = crypto.randomUUID();
    const startMs = performance.now();

    const resultPromise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(callId);
        reject(new Error(`Plugin API timeout: ${method}`));
      }, TIMEOUT_MS);

      this.pendingCalls.set(callId, { resolve, reject, timer });
    });

    // iframe にリクエストを送信
    this.iframes.get(pluginId)?.contentWindow?.postMessage({
      type: 'api_call', callId, method, args,
    }, '*');

    try {
      const result = await resultPromise;
      const rttMs = performance.now() - startMs;
      this.recordRtt(pluginId, rttMs, false);
      return result;
    } catch (err) {
      const isTimeout = String(err).includes('timeout');
      this.recordRtt(pluginId, TIMEOUT_MS, isTimeout);
      throw err;
    }
  }

  private recordRtt(pluginId: string, rttMs: number, isTimeout: boolean): void {
    const stats = this.getOrCreateStats(pluginId);

    stats.recentRtts.push(rttMs);
    if (stats.recentRtts.length > RTT_WINDOW) stats.recentRtts.shift();
    stats.avgRtt = stats.recentRtts.reduce((a, b) => a + b, 0) / stats.recentRtts.length;

    if (isTimeout) {
      stats.timeoutCount++;
      if (stats.timeoutCount >= MAX_CONSECUTIVE_TIMEOUTS) {
        this.autoDisablePlugin(pluginId, 'timeout');
        return;
      }
    } else {
      stats.timeoutCount = 0; // 成功したらリセット
    }

    if (rttMs > SLOW_THRESHOLD_MS) {
      stats.slowCount++;
      if (stats.slowCount >= MAX_SLOW_COUNT) {
        this.warnSlowPlugin(pluginId, stats.avgRtt);
      }
    }
  }
}
```

---

### 10.5 遅いプラグインの警告と自動無効化

#### 警告フロー

```
プラグインが SLOW_THRESHOLD_MS（50ms）を MAX_SLOW_COUNT（10）回超えた場合:
  → トースト通知:
    「プラグイン "{name}" の処理が遅い可能性があります（平均 {avgRtt}ms）。
     パフォーマンスに影響している場合は無効化を検討してください。」
  → 設定画面のプラグイン一覧に ⚠ アイコンを表示
  → slowCount を 0 にリセット（次の 10 回の遅延まで通知しない）
```

#### 自動無効化フロー（タイムアウト連続発生時）

```
プラグインが TIMEOUT_MS（2秒）を MAX_CONSECUTIVE_TIMEOUTS（3）回連続で超えた場合:
  → プラグインを自動無効化（§6 の deactivatePlugin() を呼ぶ）
  → トースト通知（永続表示）:
    「プラグイン "{name}" が応答しないため自動的に無効化されました。
     設定画面から再有効化できます。」
  → 設定画面でプラグインの状態を 🔴 エラーに変更
```

```typescript
// src/plugins/plugin-bridge.ts

private warnSlowPlugin(pluginId: string, avgRttMs: number): void {
  const plugin = pluginRegistry.get(pluginId);
  const name = plugin?.manifest.name ?? pluginId;

  // トースト通知（3秒で自動消去）
  useToastStore.getState().show({
    type: 'warning',
    message: `プラグイン "${name}" の処理が遅い可能性があります（平均 ${avgRttMs.toFixed(0)}ms）。`,
    duration: 3000,
  });

  // 設定画面のプラグイン一覧に perf warning フラグを立てる
  usePluginStatusStore.getState().setPerfWarning(pluginId, true);

  // slowCount をリセット（次の 10 回超えまで通知しない）
  this.perfStats.get(pluginId)!.slowCount = 0;
}

private autoDisablePlugin(pluginId: string, reason: 'timeout' | 'crash'): void {
  const plugin = pluginRegistry.get(pluginId);
  const name = plugin?.manifest.name ?? pluginId;

  pluginManager.deactivatePlugin(pluginId).catch(() => {});

  useToastStore.getState().show({
    type: 'error',
    message: `プラグイン "${name}" が応答しないため自動的に無効化されました。設定画面から再有効化できます。`,
    persistent: true, // ユーザーが明示的に閉じるまで表示
  });

  usePluginStatusStore.getState().setStatus(pluginId, 'error');
}
```

---

### 10.6 プラグイン内での Web Worker 利用

iframe 内のプラグインコードは独自の Web Worker を生成できる。重い処理（シンタックスハイライト・テキスト解析・Lint 等）をメインスレッドから分離することで、postMessage の往復時間を短縮できる。

```
iframe（プラグインメインスレッド）
  │
  ├─ 軽量な UI イベント処理（クリック・ホバー等）はメインスレッドで即時応答
  │
  └─ 重い解析処理 → Web Worker に委譲
       │
       ├─ Worker: テキスト解析・Lint・シンタックスハイライト計算
       │   （非同期・非ブロッキング）
       │
       └─ 結果を iframe メインスレッドに返す → postMessage でエディタコアへ通知
```

```javascript
// サードパーティプラグイン側のコード例（iframe 内）
// src/ 内には含まれない（プラグイン開発者のコード）

const worker = new Worker('lint-worker.js');

// エディタ変更イベントを受け取ったら Worker に処理を委譲
window.addEventListener('message', (event) => {
  if (event.data?.eventName === 'editor:onChange') {
    const { markdown } = event.data.payload;
    worker.postMessage({ type: 'lint', markdown });
  }
});

// Worker からの結果を受け取ってエディタに通知
worker.onmessage = (e) => {
  const { warnings } = e.data;
  // PluginBridge 経由でエディタに Lint 結果を送信
  window.parent.postMessage({
    type: 'api_call',
    callId: crypto.randomUUID(),
    method: 'editor.setDecorations',
    args: [warnings],
  }, '*');
};
```

**セキュリティ上の注意**: `<iframe sandbox="allow-scripts">` 内では Web Worker の `new Worker(url)` 構文が利用可能。`allow-same-origin` を付与していないため、Worker からも Tauri IPC には直接アクセスできない。

---

### 10.7 パフォーマンス統計の表示 UI

設定画面のプラグイン一覧に、各プラグインのパフォーマンス統計を表示する。

```
設定 → プラグイン → [My Lint Plugin]

  ────────────────────────────────────────
  パフォーマンス統計                   [リセット]
  ────────────────────────────────────────
  API 呼び出し平均応答時間:  12ms  ✅
  最大応答時間（直近 20 回）: 48ms
  タイムアウト発生回数:        0 回
  ────────────────────────────────────────
  ⚠ 処理が 50ms を超えた回数: 3 回（直近 20 回中）
```

| 平均 RTT | アイコン | 意味 |
|---------|---------|------|
| < 50ms | ✅ | 良好 |
| 50〜200ms | ⚠ | 注意（エディタへの影響可能性あり）|
| > 200ms または タイムアウトあり | 🔴 | 問題あり（無効化を推奨） |

---

### 10.8 実装フェーズ

| フェーズ | 実装内容 |
|---------|---------|
| **Phase 7**（サードパーティプラグイン対応時）| §10.3 のデバウンス通知・§10.4 の RTT 計測・§10.5 の自動無効化 |
| **Phase 7**（同上） | §10.7 の設定画面パフォーマンス統計表示 |
| **Phase 7 以降** | §10.6 の Web Worker 利用ガイドをプラグイン開発ドキュメントとして公開 |
