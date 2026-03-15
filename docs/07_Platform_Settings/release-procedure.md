# リリース手順書

> 対象: MarkWeave Windows / Linux beta リリース
> CI: GitHub Actions (`release.yml`) — タグ push で自動ビルド・アップロード

---

## 前提条件

- GitHub Secrets に以下が設定されていること:
  - `TAURI_SIGNING_PRIVATE_KEY` — Tauri updater 用署名鍵
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — 上記のパスワード
- `pnpm` / `node` / `rust` はローカル不要（CI が全て処理）

---

## 手順

### 1. バージョンを上げる

```bash
node scripts/bump-version.mjs <新バージョン>
# 例: node scripts/bump-version.mjs 0.9.1
```

このスクリプトは以下を一括更新する:
- `package.json` の `version`
- `src-tauri/tauri.conf.json` の `version`
- `src-tauri/Cargo.toml` の `version`

### 2. CHANGELOG.md を更新する

```
## [0.9.1] - YYYY-MM-DD

### 追加
- ...

### 修正
- ...
```

### 3. 変更をコミットする

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml CHANGELOG.md
git commit -m "chore: bump version to 0.9.1"
```

### 4. タグを打ってプッシュする

```bash
git tag v0.9.1
git push origin main
git push origin v0.9.1
```

### 5. CI を確認する

GitHub Actions の `Release` ワークフローが起動することを確認:
- `ubuntu-22.04`: `.AppImage` / `.deb` を生成
- `windows-latest`: `.msi` / `.exe` を生成

失敗した場合は Actions のログを確認して修正 → コミット → タグを再作成:
```bash
git tag -d v0.9.1          # ローカルタグ削除
git push origin :v0.9.1    # リモートタグ削除
# 修正後:
git tag v0.9.1
git push origin v0.9.1
```

### 6. GitHub Releases を公開する

CI 完了後、GitHub の Releases ページにドラフトが作成される:

1. `https://github.com/<owner>/<repo>/releases` を開く
2. 該当バージョンのドラフトを確認
3. CHANGELOG の内容をリリースノートに貼り付ける
4. 「Publish release」をクリック

---

## macOS について

macOS ビルドは現在 CI から除外している（開発者が Mac 未所持のため動作確認不可）。
Mac 対応は Phase D (D-2) として、Mac 入手後に実施する。

---

## SmartScreen 警告について

現状、Windows 版は Authenticode 署名なし。インストール時に SmartScreen の警告が出る。
正式販売時に対応予定（Phase D / D-3）。beta 版ユーザーには「詳細情報 → 実行」で回避できることを案内する。
