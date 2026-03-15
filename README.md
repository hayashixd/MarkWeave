# doc-public

公式サイトで公開する情報を管理するフォルダです。

## ファイル構成

```
doc-public/
  official-site-content.md   # 公式サイト掲載用のプロダクト情報
  manuals/
    user-manual.md            # ユーザーガイド（初見ユーザー向けコア機能）
    advanced.md               # 上級機能ガイド（Zen モード・AI・ワークスペースなど）
    user-manual.html          # 生成済み HTML マニュアル
  demo-gifs/                  # デモ用アニメーション GIF
```

## マニュアルの方針

| ファイル | 対象 | 内容 |
|---------|------|------|
| `user-manual.md` | 初見ユーザー | WYSIWYG 編集・コードブロック・テーブル・YAML Front Matter・エクスポート |
| `advanced.md` | 上級者 | Zen モード・AI（BYOK）・ワークスペース・全ショートカット |

初めて使うユーザーは `user-manual.md` だけ読めば Zenn・Qiita への投稿ワークフローを完結できます。

## HTML マニュアルの再生成

`user-manual.md` を更新した後は、`docs/manual/manual-authoring-rules.md` の手順に従って
`node docs/generate-manual.cjs` を実行して HTML を再生成してください。
