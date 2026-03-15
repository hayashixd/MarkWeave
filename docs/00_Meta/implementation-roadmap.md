# MarkWeave 実装ロードマップ

> 更新日: 2026-03-15
> 方針の根拠: CLAUDE.md § プロダクト戦略 / § 実行ロードマップ

「Webで文章を書いて公開する人のための、ローカルファーストWYSIWYGエディタ」というポジションに向けて、何を・どの順番でやるかを具体的に示すドキュメント。

**原則: 機能を増やす前に、届けられる状態にする。届けた後に反応を見て次を決める。**

---

## フェーズ概要

| フェーズ | 内容 | 状態 |
|--------|------|------|
| **A** | 出荷準備（UIとCI） | ✅ 完了 |
| **B** | 市場検証（beta公開・発信） | 🔴 未着手 |
| **C** | 差別化機能（Bで反応が出てから） | ⏳ 保留 |
| **D** | 収益化準備（販売直前） | ⏳ 保留 |

---

## Phase A: 出荷準備

**目標:** Windows + Linux の beta 版をユーザーに届けられる状態にする。

---

### A-1: macOS を CI ビルドから除外

**なぜ今すぐやるか:** 現在の `release.yml` は macOS ビルドを含んでいる。開発者が Mac を持っていないため動作確認不可能で、macOS ビルドが CI で失敗するとリリース全体がブロックされる。

**変更ファイル:**
```
.github/workflows/release.yml
```

**具体的な変更内容:**

```yaml
# 変更前 (matrix):
include:
  - platform: 'macos-latest'
    args: '--target aarch64-apple-darwin'
  - platform: 'macos-latest'
    args: '--target x86_64-apple-darwin'
  - platform: 'ubuntu-22.04'
    args: ''
  - platform: 'windows-latest'
    args: ''

# 変更後 (matrix):
include:
  - platform: 'ubuntu-22.04'
    args: ''
  - platform: 'windows-latest'
    args: ''
```

また、Rust target の macOS 向け設定も削除する:

```yaml
# 変更前:
targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

# 変更後:
targets: ''  # または行ごと削除
```

**完了条件:**
- `git tag v0.9.0-beta && git push origin v0.9.0-beta` を実行して CI が通る
- GitHub Releases に Windows (.msi) と Linux (.AppImage, .deb) のアセットが自動アップロードされる

---

### A-2: デフォルト UI の整理（サイドバー）

**なぜ今すぐやるか:** 現在のサイドバーには Git / バックリンク / タグ / グラフ / AI 診断タブが常時表示されている。初見のユーザーが「何のツールかわからない」と感じる原因。

**変更ファイル:**
```
src/components/sidebar/Sidebar.tsx
src/settings/types.ts
src/settings/defaults.ts
```

**具体的な変更内容:**

`src/settings/types.ts` に設定項目を追加:
```typescript
// AppSettings に追加
sidebar: {
  showAdvancedTabs: boolean;  // Git / バックリンク / タグ / グラフを表示するか
};
```

`src/settings/defaults.ts` でデフォルトを false に:
```typescript
sidebar: {
  showAdvancedTabs: false,  // デフォルトはシンプル表示
},
```

`src/components/sidebar/Sidebar.tsx` で条件分岐:
```tsx
// showAdvancedTabs が false の場合はタブ自体を非表示にする
// 表示するタブ（常時）: outline, files
// 非表示（showAdvancedTabs: true の場合のみ表示）: ai, backlinks, tags, graph, git
```

設定ダイアログ (`src/components/preferences/tabs/AppearanceTab.tsx` 等) に切り替えオプションを追加。

**完了条件:**
- 初回起動時にサイドバーは「アウトライン」「ファイル」の2タブのみ表示
- 設定 → 詳細設定 → 「高度なサイドバータブを表示」をオンにすると Git・グラフ等が現れる
- デフォルト状態でアプリを開いたとき「何をするツールか」が5秒で伝わる

---

### A-3: 英語 UI の翻訳完成

**なぜ今すぐやるか:** グローバル展開のブロッカー。現在英語ロケールファイルが存在するが内容が薄い可能性がある。

**調査から始める:**

```bash
# 日本語ロケールと英語ロケールのキー数を比較
node -e "
  const ja = require('./src/locales/ja/settings.json');
  const en = require('./src/locales/en/settings.json');
  const jaKeys = JSON.stringify(ja).match(/\":/g)?.length;
  const enKeys = JSON.stringify(en).match(/\":/g)?.length;
  console.log('ja:', jaKeys, 'en:', enKeys);
"
```

**変更ファイル:**
```
src/locales/en/common.json
src/locales/en/editor.json
src/locales/en/errors.json
src/locales/en/menu.json
src/locales/en/settings.json
```

**完了条件:**
- アプリを英語モードで起動したとき、日本語文字列が一切表示されない
- 設定ダイアログの全項目が英語で表示される
- メニューバーが英語で表示される

---

### A-4: リリース手順の文書化

**なぜやるか:** 次回リリース時に手順を調べ直さなくて済むようにする。

**作成ファイル:**
```
docs/07_Platform_Settings/release-procedure.md
```

**内容:**
1. バージョンを上げる: `node scripts/bump-version.mjs 0.9.1`
2. 変更点を CHANGELOG.md に記載する
3. タグを打ってプッシュ: `git tag v0.9.1 && git push origin v0.9.1`
4. CI が通るのを確認する（GitHub Actions）
5. GitHub Releases のドラフトを確認・公開する

**完了条件:**
- 手順書を見ながら実際にリリースオペレーションを1度実施できた

---

## Phase B: 市場検証

**目標:** 実際のユーザーに届けて、何が刺さるかを確認する。コードを書く前に言葉でテストする。

---

### B-1: Zenn 記事の執筆・公開

**なぜやるか:** MarkWeave の存在を知ってもらう最初の一手。技術的な経緯を正直に書く記事は、Zenn の技術ブログ層に刺さりやすい。

**記事の構成案:**
```
タイトル: 「Typora 代替の WYSIWYG Markdown エディタを個人で作った話」

内容:
1. なぜ作ったか（既存ツールの不満点）
2. 技術スタック（Tauri + TipTap + Rust の選定理由）
3. 苦労した実装（IME 対応・仮想スクロール・MD↔HTML変換）
4. 現在の状態とダウンロードリンク
5. フィードバックのお願い
```

**公開のタイミング:** Phase A の A-1 〜 A-3 が完了してから。ダウンロードできない状態で記事を出しても意味がない。

**完了条件:**
- Zenn に記事が公開されている
- GitHub Releases のリンクが記事内にある
- 記事への反応（いいね・コメント・DL 数）を1週間観測する

---

### B-2: README へのスクリーンショット追加

**なぜやるか:** 現在 README にスクリーンショットがない。テキストだけでは書き心地が伝わらない。

**作成するアセット:**
```
docs/screenshots/
  editor-main.png       # 書いている状態のスクリーンショット
  export-dialog.png     # エクスポートダイアログ
  theme-dark.png        # ダークテーマ
  editor-wysiwyg.gif    # Markdown記法を入力→WYSIWYGに変換される様子（GIF）
```

**GIF の撮影内容:**
- `# ` と入力 → H1 見出しに変換される
- ` ``` ` と入力 → コードブロックに変換される
- `**text**` と入力 → 太字に変換される

**ツール:** Kap (macOS) / ScreenToGif (Windows) / Peek (Linux)

**完了条件:**
- README のトップに GIF が表示されている
- 「何をするツールか」がスクリーンショットを見るだけでわかる

---

### B-3: フィードバック収集の仕組みを整える

**必要最低限の仕組み:**

1. **GitHub Discussions の有効化**
   - リポジトリの Settings → Features → Discussions をオン
   - カテゴリ: Bug Reports / Feature Requests / General

2. **README にフィードバック先を明記**
   ```markdown
   ## フィードバック・バグ報告
   - バグ: [GitHub Issues](...)
   - 質問・要望: [GitHub Discussions](...)
   ```

**完了条件:**
- GitHub Discussions が使える状態になっている
- README にフィードバック先のリンクがある

---

## Phase C: 差別化機能

**前提条件:** Phase B の反応を見て、継続する価値があると判断できた場合のみ着手する。反応がなければ訴求か機能のどちらがズレているかを先に分析する。

---

### C-1: Zenn / Qiita 向け Markdown エクスポート最適化

**背景:** Zenn は独自の Markdown 拡張記法を持つ。現在の汎用 Markdown 出力ではそのまま使えない。

**Zenn 固有の記法:**
```markdown
:::message
メッセージブロック
:::

:::message alert
警告ブロック
:::

```mermaid
フローチャート
```
```

**変更ファイル:**
```
src/lib/tiptap-to-markdown.ts   # Zenn向けシリアライザの追加
src/components/Export/          # エクスポートダイアログにプラットフォーム選択を追加
```

**エクスポートダイアログに追加するオプション:**
```
Markdown の出力形式:
  ○ 汎用 Markdown (GFM)
  ○ Zenn 向け
  ○ Qiita 向け
```

**完了条件:**
- Zenn 向けエクスポートで生成した Markdown を Zenn の記事エディタに貼り付けてプレビューが崩れない
- callout ブロック（`:::message`）が正しく変換される

---

### C-2: プラットフォーム別 HTML エクスポートテンプレート

**背景:** 現在の HTML エクスポートは汎用テンプレートのみ。note.mu やメールマガジンに貼ると CSS クラスが残って崩れることがある。

**追加するテンプレート:**

| テンプレート名 | 対象 | 特徴 |
|-------------|------|------|
| `clean` | note.mu / Hatena Blog | CSS クラスなし、インライン style のみ |
| `email` | メールマガジン（Mailchimp 等） | juice による完全インライン CSS、table レイアウト不使用 |
| `ghost` | Ghost | Ghost Card 形式に準拠 |

**変更ファイル:**
```
src/components/Export/ExportDialog.tsx     # テンプレート選択 UI の追加
src/file/export/html-templates/            # テンプレートファイルの追加
  clean.html
  email.html
  ghost.html
```

**完了条件:**
- `clean` テンプレートで出力した HTML を note.mu の「HTMLを貼り付け」機能で貼り付けて正しく表示される
- `email` テンプレートで出力した HTML をメーラーで表示してレイアウトが崩れない

---

### C-3: Ghost Admin API 連携

**背景:** Ghost ユーザーへの展開（v1.5）の核心機能。「書いてそのまま Ghost に送れる」が実現する。

**仕様:**
- Ghost URL と Admin API キーを設定ダイアログに保存
- メニュー → ファイル → Ghost にドラフトとして送信
- YAML Front Matter の `title`, `tags`, `slug` を Ghost のフィールドにマッピング
- 本文は HTML エクスポートして送信
- 画像は現時点ではローカル参照のまま（Ghost Storageへの自動アップロードはv2以降）

**変更ファイル:**
```
src/settings/types.ts                    # ghost.url, ghost.adminApiKey を追加
src/components/preferences/tabs/         # Ghost設定タブの追加
src/ipc/ghost.ts                         # Ghost Admin API クライアント
src-tauri/src/menu/native_menu.rs        # 「Ghost にドラフト送信」メニュー項目
src/hooks/useMenuListener.ts             # メニューイベントハンドラ
```

**完了条件:**
- 設定で Ghost URL と API キーを入力できる
- メニューから実行すると Ghost の下書きとして記事が作成される
- 成功・失敗がトースト通知で表示される

---

## Phase D: 収益化準備

**前提条件:** Phase B・C を経て、継続的にユーザーが増えていると確認できた場合のみ着手する。

---

### D-1: ライセンス管理

**方針:** 自前のライセンスサーバーは運用コストが発生するため使わない。外部サービスを利用する。

**候補:**
| サービス | 手数料 | 特徴 |
|---------|--------|------|
| Gumroad | 10% | 最もシンプル。セットアップが5分 |
| LemonSqueezy | 5% + $0.50 | VAT 処理が自動。EU 対応が楽 |
| Paddle | 5-10% | Merchant of Record。税務を全委託できる |

**推奨: LemonSqueezy**（EU の VAT 問題を自動処理してくれる。個人開発に適している）

**ライセンス検証の実装方針:**
- ライセンスキー検証は起動時に LemonSqueezy の API に問い合わせる
- オフライン環境では最後に検証した日時から30日間は使用可能（キャッシュ）
- 試用期間: 起動回数 or 日数ベース（検討中）

**完了条件:**
- LemonSqueezy で商品ページが作成されている
- アプリにライセンスキー入力画面がある
- 未購入ユーザーに試用期間終了後に購入を促す画面が表示される

---

### D-2: macOS 対応

**前提条件:** 開発者が Mac を入手した後。または CI のみで対応する場合は Apple Developer Program ($99/年) への加入が必要。

**必要な作業:**
1. Apple Developer Program への加入
2. CI に `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` シークレットを追加
3. `release.yml` に macOS のビルドマトリクスを再追加
4. `tauri.conf.json` の `bundle.macOS` 設定を確認
5. macOS の実機で動作確認

**完了条件:**
- macOS で署名済み .dmg が生成され、Gatekeeper の警告なしにインストールできる

---

### D-3: Windows Authenticode 署名

**背景:** 現在の Windows 版は署名なしのため SmartScreen 警告が出る。正式販売時には解消したい。

**費用:**
- DigiCert / Sectigo の コードサイニング証明書: $200〜$400/年
- EV 証明書（SmartScreen 即時解消）: $400〜/年

**CI での設定:**
```yaml
# release.yml に追加
env:
  WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
  WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
```

**完了条件:**
- Windows で MarkWeave.msi をダブルクリックしたとき SmartScreen 警告が出ない

---

## やらないこと（Won't do）

以下は検討の余地なく対象外。

| 機能 | 理由 |
|------|------|
| クラウド同期の自前実装 | 運用コスト発生 |
| リアルタイム共同編集 | サーバーインフラが必要 |
| 画像アノテーション機能の拡充 | 本筋と無関係 |
| PKM グラフビューの改善 | コンテンツ公開と無関係 |
| Git パネルの改善 | v1 ターゲットに不要 |
| AI サービスの自前提供 | API コストが発生 |
| Electron への移行 | Tauri の優位性を捨てる理由がない |

---

## 現在のタスク状況

```
Phase A:
  [x] A-1: macOS を CI から除外
  [x] A-2: デフォルト UI 整理（サイドバー）
  [x] A-3: 英語 UI 翻訳完成
  [x] A-4: リリース手順の文書化

Phase B:
  [ ] B-1: Zenn 記事の執筆・公開
  [ ] B-2: README へのスクリーンショット追加
  [ ] B-3: フィードバック収集の仕組み整備

Phase C（保留）:
  [ ] C-1: Zenn / Qiita 向け Markdown エクスポート最適化
  [ ] C-2: プラットフォーム別 HTML テンプレート
  [ ] C-3: Ghost Admin API 連携

Phase D（保留）:
  [ ] D-1: ライセンス管理（LemonSqueezy）
  [ ] D-2: macOS 対応
  [ ] D-3: Windows Authenticode 署名
```
