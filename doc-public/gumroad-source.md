<!--
  Gumroad 商品ページ コンテンツソース
  =====================================
  このファイルが Gumroad 商品説明の唯一の編集元です。

  ## 更新手順
  1. このファイルを編集する
  2. `pnpm gumroad:build` を実行する
  3. 生成された `gumroad-description.html` の内容を
     Gumroad ダッシュボード → 商品編集 → Description の HTML モードに貼り付けて保存

  ## 他ファイルとの同期が必要なセクション
  このファイルのみ更新しても、以下のファイルには自動反映されません。
  手動で合わせてください。

  | セクション     | 同期が必要なファイル・箇所                                    |
  |--------------|-------------------------------------------------------------|
  | FEATURES     | README.md の「主な機能」テーブル                              |
  | FEATURES     | doc-public/index.html の `#features` セクション               |
  | INCLUDES     | doc-public/index.html の `.price-features` リスト             |
  | SYSTEM_REQ   | README.md の「動作環境・サポート」テーブル                     |
  | SYSTEM_REQ   | doc-public/index.html の `#environment` セクション             |
  | FAQ          | doc-public/index.html の `#faq` セクション                    |
  | PRICING      | doc-public/index.html の `#pricing` / hero バッジ             |
  | PRICING      | README.md の「ダウンロード」セクション                         |
-->

# MAIN_TITLE
Markdown を記法なしで書いて、技術記事をそのまま公開できるエディタ

# INTRO
Typora ライクな WYSIWYG 編集 × Zenn / Qiita 向けエクスポート × ローカルファースト。
Markdown を知っているエンジニアが「記法を意識せずに書ける」書き心地を、プラットフォーム公開ワークフローと組み合わせました。ファイルはすべてローカルに。クラウド不要。

# DEMO_GIF
wysiwyg-formatting.gif | WYSIWYG 編集デモ

# PROBLEMS
こんな問題を解決します

- **Typora ユーザー**：書き心地はいいが、Zenn / Qiita に合わせた公開フローが弱い
- **VS Code ユーザー**：プレビューとエディタを行き来するたびに書くリズムが崩れる
- **AI 活用ユーザー**：Claude / ChatGPT に貼るとき毎回手作業で整形している
- **クラウド離れしたいユーザー**：Notion / HackMD のクラウド依存が嫌。ファイルはローカルに持ちたい

# FEATURES
主な機能

- ✅ Typora 式 WYSIWYG（`#` で見出し、`-` でリスト、入力と同時にレンダリング）
- ✅ テーブル（ドラッグ並び替え・列幅リサイズ・セル間 Tab 移動）
- ✅ コードブロック（40+ 言語・シンタックスハイライト）
- ✅ 数式（KaTeX）・Mermaid 図表（フローチャート等）
- ✅ YAML Front Matter GUI 編集（Zenn のタイトル・タグ・emoji 等）
- ✅ Markdown エクスポート（Zenn / Qiita 向け最適化）
- ✅ HTML エクスポート（画像 Base64 埋め込み・スタンドアロン）
- ✅ PDF / Word / EPUB（Pandoc 連携）
- ✅ AI コピー（見出し・言語タグ補正後にクリップボードへコピー）
- ✅ AI テンプレート（BYOK：自分の Claude API キーで動作）
- ✅ Zen / フォーカス / タイプライターモード
- ✅ ポモドーロ / ワードスプリント
- ✅ ワークスペース（フォルダ管理）・外部変更検知（Dropbox / OneDrive 対応）
- ✅ アプリ内自動アップデート

# DEMO_GIF_2
ai-copy.gif | AI コピーデモ

# INCLUDES
このライセンスに含まれるもの

- Windows 版（.msi インストーラー）
- Linux 版（.AppImage）
- 3 デバイスまで利用可
- アプリ内自動アップデート（将来バージョンも含む）

# SYSTEM_REQ
動作環境

- 🪟 Windows 10/11（x86-64）
- 🐧 Linux（x86-64）
- 🍎 macOS：将来対応予定

# PRICING
価格・試用期間

- インストール後 30 日間は無料で全機能を試用できます
- 試用期間終了後は買い切り $24.99（Gumroad）
- 3 デバイスまで・サブスクなし
- 💳 クレジットカード（Visa / Mastercard / AmEx）および PayPal に対応

# FAQ
よくある質問

Q: 試用版はありますか？
A: インストール後 30 日間は無料で全機能を試用できます。試用期間終了後はライセンスキーが必要になります（設定 → ライセンスから入力可能）。

Q: 支払い方法は？
A: クレジットカード（Visa / Mastercard / AmEx）および PayPal に対応しています。

Q: Windows でインストール時に SmartScreen の警告が出ます。
A: 現在 Authenticode 署名がないため警告が表示されます。「詳細情報 → 実行」でインストールできます。正式販売版では署名を整備予定です。

Q: macOS には対応していますか？
A: 現在は Windows・Linux のみ対応です。macOS は将来対応予定です。

Q: 返金はできますか？
A: Gumroad の標準返金ポリシーに準じます。購入後のお問い合わせは Gumroad のメッセージ機能からご連絡ください。

# LINKS
- 詳細ページ・マニュアル: https://hayashixd.github.io/MarkWeave/
- GitHub: https://github.com/hayashixd/MarkWeave
- 開発記事（Zenn）: https://zenn.dev/hayashixd/articles/f00eea197f087c
