# レビュー: docs/01_Architecture/performance-design.md（2026-03-12）

## 概要

- 設計書セクション数: 11
- 確認済み実装: 10 項目
- 未実装（要注意）: 5 項目
- 保留（feature-list.md 管理済み）: 2 項目

---

## セクション別レビュー結果

### §1 パフォーマンス目標と計測指標

#### 設計要件（抜粋）
- 起動時間・ロード時間・入力レイテンシ等の計測ポイントを実装し、計測可能であること。
- パフォーマンス計測のログ出力を運用できること。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| 起動時間計測（`performance.now()`） | ✅ 準拠 | `src/main.tsx:11-12,34-35` |
| 汎用計測ユーティリティ（同期/非同期） | ✅ 準拠 | `src/utils/perf.ts:13-24,33-39` |
| 計測シナリオ全体（テーブル多用・KaTeX多用など）の自動検証 | ⚠️ 部分準拠 | `src/lib/parser-perf.bench.ts:64-117` |

#### 未実装・不一致の詳細
- **計測シナリオの網羅性**: 実装ベンチはパーサ中心で、設計書のシナリオ表（テーブル多用/数式多用など）をそのまま網羅する形では確認できない。

---

### §2 ファイルサイズ閾値とモード自動切り替え

#### 設計要件（抜粋）
- 3MB 超・ノード数閾値超過時はソースモードへ自動切替すること。
- 閾値超過時にユーザーへ通知すること。
- 強制 WYSIWYG の確認導線を持つこと。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| 3MB 閾値判定とソースモード切替 | ✅ 準拠 | `src/components/editor/TipTapEditor.tsx:95-97,485-494` |
| ノード数閾値判定（3000）とトースト通知 | ✅ 準拠 | `src/components/editor/TipTapEditor.tsx:507-518` |
| 強制 WYSIWYG ボタン/確認ダイアログ | ❌ 未実装 | `src/components/editor/TipTapEditor.tsx:485-518`（該当導線なし） |

#### 未実装・不一致の詳細
- **強制WYSIWYG導線**: 設計書の「[WYSIWYG で開く] ボタン + 確認ダイアログ」は確認できない。

---

### §3 仮想スクロール設計

#### 設計要件（抜粋）
- ビューポート外ノードを仮想化し、装飾で非表示化すること。
- ノード高さキャッシュを持ち、ドキュメント変更時に無効化すること。
- 500ノード以上で有効化し、スクロールイベントをスロットルすること。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| Decoration ベースの仮想化実装 | ✅ 準拠 | `src/extensions/VirtualScrollExtension.ts:57-90,150-167` |
| スクロール更新のスロットル（100ms） | ✅ 準拠 | `src/extensions/VirtualScrollExtension.ts:27-31,92-114,180-186` |
| ノード高さキャッシュと `docChanged` 時 invalidation | ✅ 準拠 | `src/extensions/VirtualScrollExtension.ts:62-64`; `src/extensions/node-height-cache.ts:15-27` |
| 500ノード閾値で有効化 | ✅ 準拠 | `src/extensions/VirtualScrollExtension.ts:128-131`; `src/components/editor/TipTapEditor.tsx:287` |

#### 未実装・不一致の詳細
- なし。

---

### §4 インクリメンタルパース設計

#### 設計要件（抜粋）
- 保存時の全文再シリアライズ負荷を軽減するため、段階的改善を行うこと。
- 将来案として Worker オフロードを持つこと。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| 変更ブロック単位のインクリメンタルシリアライズ | ✅ 準拠 | `src/lib/incremental-serialize.ts:25-61`; `src/components/editor/TipTapEditor.tsx:534-537` |
| Web Worker によるシリアライズ | ❌ 未実装 | `rg "serializer-worker" src src-tauri` で未検出 |

#### 未実装・不一致の詳細
- **Worker移行**: 設計書にある `serializer-worker.ts` 相当の実装は確認できない。

---

### §5 バックグラウンド保存と非同期 I/O

#### 設計要件（抜粋）
- 保存優先度（即時/デバウンス）を分けること。
- 自動保存をデバウンスし、UI ブロックを避けること。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| 自動保存デバウンス（サイズ連動） | ✅ 準拠 | `src/hooks/useAutoSave.ts:56-61,62-91` |
| 即時保存（Ctrl+S）とデバウンス保存の分離 | ✅ 準拠 | `src/hooks/useAutoSave.ts:93-120` |
| `save-manager.ts` / `getAutoSaveDebounce()` 分離設計 | ⚠️ 部分準拠 | `src/hooks/useAutoSave.ts`（同ファイル内実装） |

#### 未実装・不一致の詳細
- **責務分離の形**: 設計書例の `save-manager.ts` + `getAutoSaveDebounce()` 構成は確認できず、機能は `useAutoSave` に集約されている。

---

### §6 全文検索のパフォーマンス

#### 設計要件（抜粋）
- フォルダ横断検索は Rust 側（walkdir + regex）で実行すること。
- 件数上限で早期打ち切りを行うこと。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| Rust 側 `walkdir + regex` 実装 | ✅ 準拠 | `src-tauri/src/commands/search_commands.rs:97-133,140-173` |
| 結果上限で打ち切り | ✅ 準拠 | `src-tauri/src/commands/search_commands.rs:119,174-199` |

#### 未実装・不一致の詳細
- なし。

---

### §7 メモリ管理設計

#### 設計要件（抜粋）
- 画像遅延読み込み（IntersectionObserver）を行うこと。
- 画像キャッシュ削除コマンドを起動時に呼ぶこと。
- タブメモリ管理方針（保持/LRU）を扱うこと。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `purge_image_cache` コマンド実装 | ✅ 準拠 | `src-tauri/src/commands/image_commands.rs:331-385`; `src-tauri/src/lib.rs:92` |
| 起動時 `purge_image_cache` 呼び出し | ❌ 未実装 | `src/app.tsx:1-30`（呼び出しなし） |
| ImageNodeView の遅延読み込み | ❌ 未実装 | `rg "ImageNodeView|IntersectionObserver" src` で該当未検出 |
| LRU タブ/エディタ破棄戦略 | 🔶 保留（管理済み） | `docs/01_Architecture/performance-design.md`（Phase 4 以降明記）; `docs/00_Meta/feature-list.md:875` |

#### 未実装・不一致の詳細
- **起動時キャッシュ削除導線**: バックエンドコマンドはあるが、フロントエンド起動時呼び出しは確認できない。
- **画像遅延読み込み**: 設計例の `IntersectionObserver` ベース NodeView 実装は確認できない。

---

### §8 パフォーマンス計測・プロファイリング方法

#### 設計要件（抜粋）
- 起動・ロード計測をコードで可能にすること。
- ベンチマークを継続運用すること。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| 起動計測の埋め込み | ✅ 準拠 | `src/main.tsx:11,33-35` |
| ベンチマーク（Vitest bench） | ✅ 準拠 | `src/lib/parser-perf.bench.ts:1-117` |
| ログ出力で `logger` を使う設計整合 | ⚠️ 部分準拠 | `src/main.tsx:35`; `src/utils/perf.ts:23,38`（`console.log`） |

#### 未実装・不一致の詳細
- **ログ運用**: プロジェクト規約（logger使用）との整合は未達。計測機能自体は存在する。

---

### §9 CodeMirror 6 ↔ TipTap/ProseMirror 双方向同期設計

#### 設計要件（抜粋）
- WYSIWYG ↔ ソース切替時に相互変換を行うこと。
- ソースモードは CodeMirror を利用すること。
- Split 同期の遅延更新方針を持つこと。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| WYSIWYG ↔ ソース切替時の相互変換 | ✅ 準拠 | `src/components/editor/TipTapEditor.tsx:620-634` |
| ソースモードに CodeMirror 6 を採用 | ✅ 準拠 | `src/components/editor/SourceEditor.tsx:15-34` |
| 専用 `mode-manager.ts` 分離と詳細同期フロー | ⚠️ 部分準拠 | `rg "mode-manager" src` で未検出 |

#### 未実装・不一致の詳細
- **実装配置**: 設計書例の `src/core/mode-manager.ts` ではなく `TipTapEditor.tsx` 内実装。

---

### §10 Phase 1 パフォーマンス優先度と MVP 境界

#### 設計要件（抜粋）
- フェーズごとの実装境界を守ること。
- 将来フェーズ項目を明示管理すること。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| 将来フェーズ項目の保留管理 | 🔶 保留（管理済み） | `docs/00_Meta/feature-list.md:875`（performance-design 全体を 🔶 管理） |

#### 未実装・不一致の詳細
- なし（本セクションは運用方針のため、実装未着手項目は管理済み）。

---

### §11 バックグラウンド非同期処理アーキテクチャ（文書内後半 §9）

#### 設計要件（抜粋）
- Rust 側 `tokio::spawn` + emit ベースの非同期タスク化。
- 重い処理（グラフ計算等）の Worker 分離。
- 将来 Yjs CRDT の Worker 分離方針。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `tokio::spawn` を使った非同期イベント送信実装 | ✅ 準拠 | `src-tauri/src/commands/window_sync.rs:218-223` |
| グラフ計算 Worker (`graph-layout.worker.ts`) | ❌ 未実装 | `rg "graph-layout\.worker" src` で未検出 |
| CRDT Worker (`crdt-sync.worker.ts`) | 🔶 保留（管理済み） | `docs/01_Architecture/performance-design.md`（Phase 6 以降）; `docs/00_Meta/feature-list.md:875` |

#### 未実装・不一致の詳細
- **グラフ計算のWorker分離**: 設計書にある専用 Worker 実装は確認できない。

---

## 総合サマリー

| 判定 | 件数 |
|---|---|
| ✅ 準拠 | 10 |
| ⚠️ 部分準拠 | 4 |
| ❌ 未実装 | 5 |
| 🔶 保留（管理済み） | 2 |

### 主要な未実装・不一致（❌ / ⚠️ のみ列挙）

1. **大規模ファイル時の強制WYSIWYG導線** — ボタン/確認ダイアログ未確認。
2. **シリアライズWorker** — `serializer-worker` 相当が未検出。
3. **画像メモリ管理導線** — 起動時 `purge_image_cache` 呼び出しと `ImageNodeView` 遅延読み込み未確認。
4. **モード同期の実装配置** — `mode-manager` 分離は未確認（機能は存在）。
5. **グラフ計算Worker** — `graph-layout.worker.ts` 未検出。
