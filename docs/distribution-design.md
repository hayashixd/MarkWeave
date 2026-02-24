# 配布・自動アップデート設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Tauri 2.0
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [概要と設計方針](#1-概要と設計方針)
2. [コード署名設計](#2-コード署名設計)
3. [リリースビルドパイプライン（GitHub Actions）](#3-リリースビルドパイプラインgithub-actions)
4. [配布チャネル設計](#4-配布チャネル設計)
5. [自動アップデート設計（tauri-plugin-updater）](#5-自動アップデート設計tauri-plugin-updater)
6. [アップデート UX 設計](#6-アップデート-ux-設計)
7. [バージョニング戦略](#7-バージョニング戦略)
8. [実装フェーズ](#8-実装フェーズ)

---

## 1. 概要と設計方針

### 1.1 対象プラットフォームと配布形式

| OS | 配布形式 | 署名 | 備考 |
|----|---------|------|------|
| Windows | `.msi`（インストーラ）+ `.exe`（ポータブル）| Authenticode | winget 登録も検討 |
| macOS | `.dmg` + `.app` | Apple Developer ID + Notarization | Gatekeeper 対応必須 |
| Linux | `.AppImage` + `.deb` + `.rpm` | GPG 署名（任意）| |

### 1.2 設計上の制約と選択

| 制約 | 採用方針 |
|------|---------|
| 個人開発のため CI/CD に費用をかけたくない | GitHub Actions の無料枠（public repo 無制限）を使用 |
| macOS 署名は年額 $99（Apple Developer Program）| Phase 1 は署名なしで開始、公開時に加入を検討 |
| Windows EV 証明書は高額（年額 $200〜）| 一般的な OV 証明書か自己署名で開始し、必要に応じて移行 |
| Tauri updater は公開鍵による署名検証が必須 | `tauri signer generate` で鍵ペアを生成・管理 |

---

## 2. コード署名設計

### 2.1 Windows 署名

Tauri 2.0 は NSIS/WiX インストーラに対して Windows Code Signing をサポートする。

```toml
# src-tauri/tauri.conf.json（抜粋）
[bundle.windows]
certificateThumbprint = ""   # 証明書のサムプリント（GitHub Actions secrets で管理）
digestAlgorithm = "sha256"
timestampUrl = "http://timestamp.digicert.com"
```

**Phase 1 の方針（署名なし）:**
Windows の署名なしアプリはインストール時に SmartScreen 警告が表示される。
初期は「詳細情報」→「実行」で回避可能。公開後にユーザーが増えたら証明書を取得する。

**将来の方針（署名あり）:**
```yaml
# GitHub Actions での署名ビルド（将来）
- name: Build with signing
  env:
    WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
    WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
  run: pnpm tauri build
```

### 2.2 macOS 署名と Notarization

macOS Gatekeeper は未署名のアプリを**デフォルトでブロック**する。
GitHub からダウンロードした `.dmg` を開こうとすると「開発元が未確認」のダイアログが出て実行できない。

**Phase 1 の方針（署名なし・個人使用のみ）:**
ターミナルで `xattr -cr /Applications/MyEditor.app` を実行することで署名なしアプリを起動可能。
公開前には必ず Apple Developer Program に加入して署名・Notarization を行う。

**将来の方針（署名 + Notarization）:**
```yaml
# GitHub Actions（将来）
- name: Build and notarize macOS
  env:
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  run: pnpm tauri build
```

### 2.3 Tauri Updater 署名鍵の管理

自動アップデートの改ざん防止のために `tauri-plugin-updater` は更新ファイルの署名を検証する。

```bash
# 鍵ペアの生成（初回のみ）
pnpm tauri signer generate -w ~/.tauri/updater-key.key

# 出力:
# Public key:  dW50cnVzdGVkIGNvbW1lbnQ6...
# Private key: ~/.tauri/updater-key.key に保存
```

| 鍵 | 保管場所 | 備考 |
|----|---------|------|
| 公開鍵 | `tauri.conf.json` の `plugins.updater.pubkey` に直接記述 | リポジトリにコミットしてよい |
| 秘密鍵 | GitHub Actions secrets: `TAURI_SIGNING_PRIVATE_KEY` | 絶対に公開しない |

```json
// src-tauri/tauri.conf.json
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6...",
      "endpoints": [
        "https://github.com/YOUR_USER/YOUR_REPO/releases/latest/download/latest.json"
      ]
    }
  }
}
```

---

## 3. リリースビルドパイプライン（GitHub Actions）

### 3.1 ブランチ・タグ戦略

```
main ブランチ        → 開発中
  └─ git tag v1.0.0  → GitHub Actions が自動でリリースビルド＋GitHub Release 作成
```

### 3.2 GitHub Actions ワークフロー

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-latest'
            args: '--target aarch64-apple-darwin'   # Apple Silicon
          - platform: 'macos-latest'
            args: '--target x86_64-apple-darwin'    # Intel Mac
          - platform: 'ubuntu-22.04'
            args: ''
          - platform: 'windows-latest'
            args: ''

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Install Linux dependencies
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Install frontend dependencies
        run: pnpm install

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'v__VERSION__'
          releaseBody: |
            ## 変更点
            このリリースの変更点は CHANGELOG.md を参照してください。
          releaseDraft: true   # 手動で公開（内容確認のため）
          prerelease: false
          args: ${{ matrix.args }}
```

### 3.3 GitHub Release の成果物

タグ `v1.2.0` をプッシュすると以下が自動生成される：

```
GitHub Release: v1.2.0
├── md-editor_1.2.0_aarch64.dmg          (macOS Apple Silicon)
├── md-editor_1.2.0_x64.dmg             (macOS Intel)
├── md-editor_1.2.0_x64-setup.exe       (Windows インストーラ)
├── md-editor_1.2.0_x64.msi             (Windows MSI)
├── md-editor_1.2.0_amd64.AppImage      (Linux)
├── md-editor_1.2.0_amd64.deb           (Debian/Ubuntu)
└── latest.json                          (updater マニフェスト)
```

`latest.json` は `tauri-plugin-updater` がアップデート確認に使用するマニフェストファイル。

---

## 4. 配布チャネル設計

### 4.1 Phase 1: GitHub Releases（必須）

最初の配布先は GitHub Releases のみ。無料で使え、Tauri Action が自動化してくれる。
ユーザーは Releases ページから手動でダウンロードするか、自動アップデートで受け取る。

### 4.2 Phase 2 以降: パッケージマネージャー登録（任意）

| チャネル | 対象 OS | 難易度 | 署名要件 |
|---------|---------|--------|---------|
| **winget**（Windows Package Manager）| Windows | 低 | 不要（PR でマニフェストを提出）|
| **Homebrew Cask** | macOS | 低 | Notarization 推奨 |
| **Snapcraft** | Linux | 中 | GPG 署名 |
| **AUR**（Arch User Repository）| Linux | 低 | 不要 |

**winget への登録例:**
```yaml
# winget-pkgs リポジトリへの PR
PackageIdentifier: YourName.MdEditor
PackageVersion: 1.0.0
PackageUrl: https://github.com/YOUR_USER/YOUR_REPO
Installers:
  - Architecture: x64
    InstallerUrl: https://github.com/YOUR_USER/YOUR_REPO/releases/download/v1.0.0/md-editor_1.0.0_x64-setup.exe
    InstallerSha256: <SHA256>
```

---

## 5. 自動アップデート設計（tauri-plugin-updater）

### 5.1 アップデートチェックのタイミング

| タイミング | 動作 |
|-----------|------|
| **アプリ起動時**（バックグラウンド）| 常に確認。見つかればトースト通知 |
| **手動確認**（メニュー → ヘルプ → アップデートを確認）| 即時確認してダイアログ表示 |

起動時チェックは UI ブロッキングなしに非同期で行う。

### 5.2 アップデートチェックのロジック（Rust 側）

```rust
// src-tauri/src/updater.rs
use tauri_plugin_updater::UpdaterExt;

pub async fn check_for_updates(app: tauri::AppHandle) {
    let updater = app.updater().unwrap();

    match updater.check().await {
        Ok(Some(update)) => {
            // フロントエンドにアップデートあり通知
            app.emit("update-available", UpdateInfo {
                version: update.version.clone(),
                body: update.body.clone().unwrap_or_default(),
            }).unwrap();
        }
        Ok(None) => {
            // 最新版 → 何もしない（起動時チェックの場合）
        }
        Err(e) => {
            // ネットワークエラーは無視（ログに記録のみ）
            log::warn!("Update check failed: {}", e);
        }
    }
}
```

### 5.3 ダウンロードとインストールのロジック

```rust
// ダウンロード進捗をフロントエンドに送信
update.download_and_install(|downloaded, total| {
    if let Some(total) = total {
        let percent = (downloaded as f64 / total as f64 * 100.0) as u32;
        app.emit("update-progress", percent).unwrap();
    }
}, || {
    // インストール完了 → 再起動を促す
    app.emit("update-installed", ()).unwrap();
}).await?;
```

---

## 6. アップデート UX 設計

### 6.1 アップデート通知（トースト）

```
┌─────────────────────────────────────────────────────────┐
│  🎉 新しいバージョン v1.3.0 が利用可能です              │
│  [後で] [今すぐ更新]                                    │
└─────────────────────────────────────────────────────────┘
```

- 画面右下に表示（エディタの邪魔にならない位置）
- 「後で」を押すと 24 時間再通知しない（`lastDismissed` を plugin-store に保存）
- 「今すぐ更新」を押すとダウンロード＋インストール開始

### 6.2 ダウンロード中の表示

```
┌─────────────────────────────────────────────────────────┐
│  アップデートをダウンロード中...                         │
│  [████████████░░░░░░░░]  60%                           │
│                                     [キャンセル]        │
└─────────────────────────────────────────────────────────┘
```

### 6.3 インストール完了後

```
┌─────────────────────────────────────────────────────────┐
│  アップデートの準備ができました                          │
│  再起動するとインストールが完了します                   │
│  [後で再起動]  [今すぐ再起動]                           │
└─────────────────────────────────────────────────────────┘
```

「今すぐ再起動」を押す前に未保存ファイルの確認を行う（[window-tab-session-design.md](./window-tab-session-design.md) §3 の未保存ガードと連携）。

---

## 7. バージョニング戦略

[Semantic Versioning 2.0.0](https://semver.org/) に従う。

| バージョン形式 | 意味 | 例 |
|-------------|------|-----|
| `MAJOR.MINOR.PATCH` | 標準 SemVer | `1.2.3` |
| `MAJOR` | 破壊的変更（設定スキーマ変更等）| `2.0.0` |
| `MINOR` | 後方互換の機能追加 | `1.3.0` |
| `PATCH` | バグ修正 | `1.2.1` |

### バージョンの管理場所

バージョンは以下の 2 箇所を常に同期させる：

```
package.json              "version": "1.2.0"
src-tauri/Cargo.toml      version = "1.2.0"
src-tauri/tauri.conf.json "version": "1.2.0"
```

同期スクリプト：
```bash
# バージョンを一括更新するスクリプト（package.json の scripts に登録）
"scripts": {
  "version:bump": "node scripts/bump-version.mjs"
}
```

---

## 8. 実装フェーズ

| フェーズ | 実装内容 |
|---------|---------|
| Phase 1（MVP）| GitHub Actions ワークフロー作成、`tauri signer generate` で鍵生成、GitHub Release に手動アップロード |
| Phase 1（後半）| `tauri-plugin-updater` 統合、起動時アップデートチェック、トースト通知 |
| Phase 2 | ダウンロード進捗 UI、再起動フロー |
| Phase 3 以降 | winget・Homebrew 登録（ユーザーが増えたタイミングで）|
| 公開前 | コード署名（macOS Notarization・Windows Authenticode）|

---

## 関連ドキュメント

- [cross-platform-design.md](./cross-platform-design.md) §8 — CI 全体設計
- [window-tab-session-design.md](./window-tab-session-design.md) §3 — 再起動前の未保存確認
- [error-handling-design.md](./error-handling-design.md) — アップデートエラー時のログ・通知
