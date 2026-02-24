# プラグイン API 設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

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
      { "id": "com.example.my-plugin", "enabled": true, "path": "..." }
    ]
  }
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
