# マニュアル作成・更新ルール

このドキュメントは、マニュアル関連作業時に必ず参照するルールの Single Source of Truth（SoT）です。

## 1. 適用範囲

以下に該当する変更では本ルールを適用すること。

- UI の操作手順に影響する機能追加・変更
- 既存マニュアル（HTML / Markdown / スクリーンショット）の更新
- 公式サイト掲載情報におけるマニュアル案内の追加・更新

## 2. 基本方針

- 実装とマニュアル更新は同一セッションで完了させる
- マニュアル更新の判断は「利用者の操作手順が変わったか」を基準にする
- ルール・手順の重複記載は避け、このファイルを参照する

## 3. 必須作業フロー

1. 変更機能に対応する既存シナリオの有無を確認する
2. シナリオの selector と実際の DOM が一致しているか確認する
3. `npm run manual:capture` を実行してスクリーンショットを再撮影する
4. `node docs/generate-manual.cjs` を実行して HTML マニュアルを再生成する
5. 差分を確認し、手順と画像が一致していることを確認する

## 4. シナリオが存在しない場合

1. `docs/00_Meta/feature-list.md` で対象機能の概要を確認する
2. Playwright で対象 UI の selector を確認する
3. `docs/manual-scenarios/{feature-name}.yaml` を新規作成する
4. 上記「必須作業フロー」を実施する

## 5. 変更対象外（通常はマニュアル更新不要）

- Rust 内部ロジックのみの変更
- テストコードのみの変更
- 見た目に影響しない軽微な内部リファクタリング

## 6. 禁止事項

- マニュアル作業時に本ルールを参照せず独自判断で更新しない
- 画像だけ更新して手順本文を放置しない
- 実装と不整合な操作手順を掲載しない

## 7. 活用事例ページ

| ファイル | 役割 |
|---------|------|
| `doc-public/use-cases.html` | 活用事例ページ（手作り版・既存 GIF 参照） |
| `docs/generate-use-cases.cjs` | スクリーンショット埋め込み版を生成するスクリプト |
| `docs/use-case-screenshots/` | 新規撮影したスクリーンショット / GIF の配置先 |

### 活用事例の画像追加フロー

```
1. docs/use-case-screenshots/{scenario}/ に GIF / PNG を配置
   - s1-frontmatter/front-matter-edit.gif
   - s3-zen/zen-pomodoro.gif
   - s4-workspace/workspace-filetree.gif
   - s4-workspace/external-change.gif

2. node docs/generate-use-cases.cjs を実行
   → doc-public/use-cases.html が画像埋め込み版に更新される
```

## 8. 参照リンク

- マニュアル管理トップ: [README.md](./README.md)
- 既存の生成スクリプト: [../generate-manual.cjs](../generate-manual.cjs)
- 活用事例生成スクリプト: [../generate-use-cases.cjs](../generate-use-cases.cjs)
- 生成マニュアル HTML: [../../doc-public/manuals/user-manual.html](../../doc-public/manuals/user-manual.html)
- 活用事例 HTML: [../../doc-public/use-cases.html](../../doc-public/use-cases.html)
