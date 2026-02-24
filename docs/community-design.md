# コミュニティ・配布設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [ライセンスポリシー](#1-ライセンスポリシー)
2. [プライバシーポリシー・テレメトリ](#2-プライバシーポリシーテレメトリ)
3. [クラッシュレポート設計](#3-クラッシュレポート設計)
4. [フィードバック UI](#4-フィードバック-ui)
5. [アップデート配布](#5-アップデート配布)

---

## 1. ライセンスポリシー

### 1.1 アプリケーションライセンス

| 項目 | 内容 |
|------|------|
| ライセンス | MIT License |
| 対象 | アプリケーション本体のソースコード |
| 商用利用 | 許可 |
| 改変・再配布 | 許可（著作権表示を保持） |

```
MIT License

Copyright (c) 2026 [Author Name]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

### 1.2 サードパーティライセンス一覧

アプリに同梱されるライブラリのライセンス:

| ライブラリ | ライセンス | 注記 |
|-----------|-----------|------|
| Tauri 2.0 | MIT / Apache-2.0 | |
| TipTap | MIT | |
| React | MIT | |
| CodeMirror 6 | MIT | |
| KaTeX | MIT | |
| Mermaid.js | MIT | |
| remark | MIT | |
| DOMPurify | Mozilla Public License 2.0 / Apache-2.0 | |
| turndown | MIT | |
| encoding-japanese | MIT | |

`about` ダイアログに「オープンソースライセンス」セクションを設け、
全ライセンスを表示する（`npm run generate-licenses` で自動生成）。

---

## 2. プライバシーポリシー・テレメトリ

### 2.1 データ収集の原則

**このアプリは外部サーバーへデータを送信しない**（個人開発・オフライン優先の方針）。

- ユーザーの文書コンテンツは一切収集しない
- 匿名の使用統計も MVP では収集しない
- AI 機能（Phase 7 以降）を有効化した場合のみ外部 API を使用（明示的なオプトイン）

### 2.2 テレメトリオプション（将来検討）

Phase 7 以降でオプトインのクラッシュレポートを検討する場合:

```typescript
// テレメトリは常にオプトイン
interface TelemetrySettings {
  crashReporting: boolean;  // デフォルト: false
  // 使用統計（機能利用頻度など）は収集しない
}
```

初回起動時のオプトインダイアログ（実装した場合）:
```
┌──────────────────────────────────────────────────────┐
│  クラッシュレポートへの参加                           │
├──────────────────────────────────────────────────────┤
│  アプリのクラッシュ情報を匿名で送信することで、       │
│  アプリの安定性向上に協力できます。                   │
│                                                      │
│  送信される情報:                                      │
│  • クラッシュ時のスタックトレース                    │
│  • OS とアプリのバージョン                           │
│                                                      │
│  送信されない情報:                                    │
│  • ファイルの内容・パス                              │
│  • 個人を識別できる情報                              │
│                                                      │
│  設定 → プライバシーからいつでも変更できます。         │
│                                                      │
│        [参加しない]     [参加する]                   │
└──────────────────────────────────────────────────────┘
```

---

## 3. クラッシュレポート設計

### 3.1 クラッシュの種類

| クラッシュ種別 | 検知方法 |
|--------------|---------|
| Rust パニック | `std::panic::set_hook` でキャッチ |
| JavaScript エラー | `window.onerror` / `window.onunhandledrejection` |
| Tauri コマンドエラー | Result 型エラーのロギング |
| レンダラープロセスクラッシュ | WebView の crash イベント |

### 3.2 ローカルクラッシュログ

クラッシュ情報はローカルのログファイルに保存する。

```rust
// src-tauri/src/logging.rs
use log::{error, info};
use log4rs; // または tracing

pub fn setup_logging(app_data_dir: &std::path::Path) {
    let log_path = app_data_dir.join("logs").join("crash.log");
    // ファイルローテーション: 最大 5MB × 3 世代
}
```

```typescript
// src/error-handler.ts
window.onerror = (message, source, lineno, colno, error) => {
  const report = {
    message: String(message),
    stack: error?.stack ?? '',
    timestamp: new Date().toISOString(),
    appVersion: APP_VERSION,
    os: navigator.platform,
  };
  // Tauri コマンドでローカルファイルに書き込み
  invoke('write_crash_log', { report: JSON.stringify(report) });
};

window.onunhandledrejection = (event) => {
  const report = {
    message: `Unhandled Promise Rejection: ${event.reason}`,
    timestamp: new Date().toISOString(),
  };
  invoke('write_crash_log', { report: JSON.stringify(report) });
};
```

### 3.3 クラッシュログの確認 UI

```
設定 → 詳細 → ログ

  クラッシュログ: ~/.config/md-editor/logs/crash.log
  最終クラッシュ: 2026-02-10 14:32:11

  [ログを開く]  [ログをクリア]  [バグ報告に添付]
```

---

## 4. フィードバック UI

### 4.1 フィードバックの経路

| 経路 | 内容 |
|------|------|
| GitHub Issues | バグ報告・機能リクエスト（主要経路） |
| アプリ内フィードバック | GitHub Issues への誘導リンク |

### 4.2 バグ報告ウィザード

```
メニュー → ヘルプ → バグを報告...
```

```
ステップ 1/3: 問題の種類
  ○ クラッシュ・フリーズ
  ○ 表示の乱れ
  ○ ファイル操作の問題
  ● その他

ステップ 2/3: 詳細を記入
  タイトル: [                              ]
  再現手順:
  [ テキストエリア                         ]

  □ クラッシュログを添付する
  □ システム情報を添付する（OS・アプリバージョン）

ステップ 3/3: 送信
  → GitHub Issues のページをブラウザで開く
  （フォームの内容を URL パラメータでプリフィルして渡す）
```

```typescript
// バグ報告を GitHub Issues に飛ばす
async function openBugReport(report: BugReport) {
  const body = formatBugReportBody(report);
  const url = new URL('https://github.com/[owner]/[repo]/issues/new');
  url.searchParams.set('title', report.title);
  url.searchParams.set('body', body);
  url.searchParams.set('labels', 'bug');

  await open(url.toString()); // Tauri plugin-shell
}

function formatBugReportBody(report: BugReport): string {
  return `## 問題の概要
${report.title}

## 再現手順
${report.steps}

## 環境情報
- アプリバージョン: ${APP_VERSION}
- OS: ${report.os}

${report.attachCrashLog ? `## クラッシュログ\n\`\`\`\n${report.crashLog}\n\`\`\`` : ''}
`;
}
```

### 4.3 「何か問題はありますか？」ツールチップ（オプション）

初回起動から 7 日後に一度だけ表示（`hasShownFeedbackPrompt` フラグで制御）:

```
                              ┌──────────────────────────┐
                              │  アプリはいかがですか？   │
                              │  [フィードバックを送る]   │
                              │  [✕ 閉じる]              │
                              └──────────────────────────┘
```

---

## 5. アップデート配布

### 5.1 配布方法

| プラットフォーム | 配布方法 |
|----------------|---------|
| Windows | `.msi` インストーラー / GitHub Releases |
| macOS | `.dmg` / GitHub Releases |
| Linux | `.AppImage` / `.deb` / GitHub Releases |
| iOS | TestFlight（クローズドβ）/ App Store（将来） |
| Android | `.apk` / GitHub Releases（将来は Google Play）|

### 5.2 自動アップデート（Tauri Updater）

```json
// tauri.conf.json
{
  "tauri": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/[owner]/[repo]/releases/latest/download/latest.json"
      ],
      "dialog": true,
      "pubkey": "..."
    }
  }
}
```

アップデート確認フロー:
```
アプリ起動時（1日1回チェック）
  │
  ▼
GitHub Releases API で最新バージョンを確認
  │
  ├─ 最新版 → 何もしない
  │
  └─ 新バージョンあり → トースト通知:
     「バージョン 1.2.0 が利用可能です」[更新する] [後で]
```

### 5.3 アップデート署名検証

Tauri Updater の署名検証を必ず有効化する（`pubkey` 設定）。
秘密鍵は GitHub Secrets に保存し、CI でリリース時に署名する。

```yaml
# .github/workflows/release.yml
- name: Sign and publish release
  env:
    TAURI_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
    TAURI_KEY_PASSWORD: ${{ secrets.TAURI_KEY_PASSWORD }}
  run: npm run tauri build -- --target universal-apple-darwin
```

---

## 関連ドキュメント

- [security-design.md](./security-design.md) — 署名・整合性検証
- [testing-strategy-design.md](./testing-strategy-design.md) — CI/CD パイプライン
- [user-settings-design.md](./user-settings-design.md) — テレメトリ設定の保存
