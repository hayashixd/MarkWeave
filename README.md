# doc-public

公式サイトで公開する情報を管理するフォルダです。

## ファイル構成

```
doc-public/
  index.html                  # LP（ランディングページ）JA/EN 切替対応
  use-cases.html              # 活用事例ページ JA/EN 切替対応
  official-site-content.md   # 公式サイト掲載用のプロダクト情報
  manuals/
    user-manual.md            # ユーザーガイド 日本語（初見ユーザー向けコア機能）
    user-manual.en.md         # ユーザーガイド 英語版
    advanced.md               # 上級機能ガイド 日本語
    advanced.en.md            # 上級機能ガイド 英語版
    user-manual.html          # LP リンク先マニュアル（手作り・JA/EN 切替）
    user-manual-full.html     # 全機能リファレンス（generate-manual.cjs が生成、スクショ埋込）
  demo-gifs/                  # デモ用アニメーション GIF（LP・マニュアル・活用事例で共用）
    use-cases/                # 活用事例ページ専用 GIF（generate-use-cases.cjs が読み込む）
```

## ページ生成スクリプト

| スクリプト | 出力先 | 用途 |
|-----------|-------|------|
| `docs/generate-manual.cjs` | `manuals/user-manual-full.html` | スクリーンショット付き全機能リファレンス |
| `docs/generate-use-cases.cjs` | `use-cases.html` | GIF/スクリーンショット埋め込み版活用事例 |

新規 GIF を追加して埋め込み版を生成する場合は以下を実行:
```bash
node docs/generate-use-cases.cjs
```

## マニュアルの方針

| ファイル | 対象 | 内容 |
|---------|------|------|
| `user-manual.md` | 初見ユーザー | WYSIWYG 編集・コードブロック・テーブル・YAML Front Matter・エクスポート |
| `advanced.md` | 上級者 | Zen モード・AI機能・ワークスペース・全ショートカット |

初めて使うユーザーは `user-manual.md` だけ読めば Zenn・Qiita への投稿ワークフローを完結できます。

## HTML マニュアルの再生成

`user-manual.md` を更新した後は、`docs/manual/manual-authoring-rules.md` の手順に従って
`node docs/generate-manual.cjs` を実行して HTML を再生成してください。
