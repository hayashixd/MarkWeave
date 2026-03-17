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
3. `pnpm manual:capture` を実行してスクリーンショットを再撮影する
4. `node docs/generate-manual.cjs` を実行して HTML マニュアルを再生成する
5. 差分を確認し、手順と画像が一致していることを確認する

## 3a. UI 全面刷新時 — 一括リフレッシュ

UI が広範囲に変わった場合は **1コマンドで全更新** できる:

```bash
pnpm manual:refresh
```

これにより以下がすべて実行される:

| ステップ | 内容 | 出力先 |
|---------|------|--------|
| 1 | `e2e/manual-capture/` を全実行 | `docs/manual-screenshots/**/*.png` |
| 2 | `e2e/demo-capture/` を全実行（GIF） | `doc-public/demo-gifs/**/*.gif` |
| 3 | `generate-manual.cjs` を実行 | `doc-public/manuals/user-manual-full.html` |
| 4 | `generate-use-cases.cjs` を実行 | `doc-public/use-cases.html` |

個別にスキップしたい場合:

```bash
# スクリーンショットのみ
pnpm manual:capture

# GIF のみ
pnpm manual:capture:demo

# HTML 生成のみ（撮影済み画像を使う）
pnpm manual:generate

# 途中失敗しても全ステップ実行
pnpm manual:refresh --continue-on-error

# GIF 撮影をスキップして高速リフレッシュ
pnpm manual:refresh --skip-gifs
```

## 4. 新機能追加時の必須作業（シナリオ新規作成）

新しいマニュアル項目を追加する場合、**撮影スクリプトの追加だけでは不十分**。
以下の3ファイルをセットで更新すること。

### 4-1. 撮影シナリオを作成する

1. `e2e/manual-capture/{feature-name}.spec.ts` を新規作成する
2. `captureStep` / `captureWithAnnotation` を使って撮影ステップを実装する
3. `pnpm manual:capture` で動作確認する

> `e2e/manual-capture/` 配下の spec は Playwright が自動スキャンするため、
> `pnpm manual:refresh` に**自動で組み込まれる**。

### 4-2. `generate-manual.cjs` に画像パスを登録する（必須）

**`pnpm manual:refresh` を実行しても、`generate-manual.cjs` に登録されていない画像は HTML に埋め込まれない。**

```js
// docs/generate-manual.cjs の imgs オブジェクトに追加する
const imgs = {
  // ... 既存エントリ ...

  // 新機能のスクリーンショット
  myFeatureStep1: loadImage('my-feature/01_step1.png'),
  myFeatureStep2: loadImage('my-feature/02_step2.png'),
  myFeatureOverview: loadImage('my-feature/03_overview.png'),
};
```

### 4-3. HTML テンプレートに画像を配置する（必須）

`generate-manual.cjs` 内の HTML テンプレート文字列の該当セクションに
`<img src="${imgs.myFeatureStep1}">` の形式で挿入する。

### チェックリスト

新機能追加時に以下をすべて完了させること:

- [ ] `e2e/manual-capture/{feature}.spec.ts` を作成した
- [ ] `generate-manual.cjs` の `imgs` に画像パスを追加した
- [ ] `generate-manual.cjs` の HTML テンプレートに `<img>` を配置した
- [ ] `pnpm manual:refresh` を実行して HTML を確認した

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
