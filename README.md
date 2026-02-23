# Markdown / HTML Editor - Typora ライク WYSIWYG エディタ

## プロジェクトの目的

このプロジェクトは、マークダウンファイルおよびHTMLファイルを **直感的に編集・変換できる WYSIWYG エディタ** の開発を目指しています。

操作感の目標として [Typora](https://typora.io/) を参考にしており、マークダウンの記法を意識させることなく、書いた内容がリアルタイムにレンダリングされ、視覚的に確認しながら編集できる体験を提供します。

さらに、**Markdown ↔ HTML のシームレスな変換**と、**HTMLファイルの直感的なWYSIWYG編集**を同一エディタ上で実現します。

### 解決したい課題

- 従来のマークダウンエディタは「ソースコードを書く感覚」が強く、非エンジニアには敷居が高い
- プレビュー/編集の二画面分割は画面スペースを消費し、直感的でない
- テーブル編集がコードベースで煩雑（ExcelのようなUI操作ができない）
- Markdown から HTML へのエクスポートが別ツール頼みになりがち
- HTMLファイルを直接編集する場合、専用の重量級ツールが必要

### 目指す価値

| 価値 | 説明 |
|------|------|
| **シームレス編集** | マークダウン記法とレンダリングを意識させないリアルタイムWYSIWYG |
| **直感的テーブル操作** | Excelライクな行・列追加/削除/並び替え |
| **MD ↔ HTML 変換** | マークダウンとHTMLをワンクリックで相互変換 |
| **HTML WYSIWYG** | HTMLファイルもMarkdownと同じ感覚で直感的に編集 |
| **低学習コスト** | マークダウンやHTMLを知らなくてもドキュメントが書ける |
| **ポータブル** | 出力はピュアなMarkdown / HTML（ベンダーロックインなし） |
| **高速動作** | 大きなファイルでも軽快に動作 |

---

## 主要機能

### Markdown 編集（WYSIWYG）

- フォーカス時にソース記法を表示、非フォーカス時にレンダリング表示
- 見出し・段落・リスト・引用・テーブル・コードブロック・数式・図表
- 入力ルール（`# ` を入力すると自動的に見出しへ変換）
- Excelライクなテーブル編集（行・列のDnD、リサイズ、セル配置）

### HTML 編集（WYSIWYG）

- HTMLファイルを同じ直感的なインターフェースで編集
- WYSIWYGモード / ソースコードモード / スプリットモード
- 文字色・背景色・フォントサイズ等のリッチなスタイル編集
- divブロックによるレイアウト構成
- `<head>` メタデータの GUI 編集

### 変換・エクスポート

| 変換方向 | 内容 |
|---------|------|
| Markdown → HTML エクスポート | スタイル付きスタンドアロンHTMLファイルを生成 |
| Markdown → HTML（編集用） | HTMLエディタモードで続けて編集可能 |
| HTML → Markdown 変換 | HTMLコンテンツをMarkdownに変換（ロス警告つき） |
| → PDF エクスポート | 印刷品質のPDF出力（将来対応） |

---

## プロジェクト構成

```
.
├── README.md                      # このファイル（プロジェクト概要）
├── docs/
│   ├── typora-analysis.md         # Typora機能分析レポート
│   ├── html-editor-analysis.md    # HTML編集機能 設計分析
│   ├── system-design.md           # システム設計ドキュメント
│   └── roadmap.md                 # 開発ロードマップ
└── src/
    ├── core/                      # エディタコアロジック（MD/HTML共通）
    │   ├── parser/                # MD・HTMLパーサ
    │   ├── converter/             # MD↔HTML変換パイプライン
    │   └── commands/              # 編集コマンド
    ├── renderer/                  # レンダリングエンジン
    │   ├── wysiwyg/               # WYSIWYG レンダラ
    │   └── html/                  # HTML専用レンダラ
    ├── components/                # UIコンポーネント（React）
    ├── file/                      # ファイル管理・エクスポート
    ├── plugins/                   # プラグインシステム
    ├── themes/                    # テーマ（エディタ・エクスポート用）
    └── utils/                     # ユーティリティ
```

---

## 参考資料

- [Typora公式サイト](https://typora.io/)
- [docs/typora-analysis.md](./docs/typora-analysis.md) - Typora詳細機能分析
- [docs/html-editor-analysis.md](./docs/html-editor-analysis.md) - HTML編集機能設計
- [docs/system-design.md](./docs/system-design.md) - システム設計
- [docs/roadmap.md](./docs/roadmap.md) - 開発ロードマップ

---

## ライセンス

TBD
