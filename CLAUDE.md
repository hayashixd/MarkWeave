# Typora-Inspired WYSIWYG Markdown Editor 開発ルール

## 基本アーキテクチャ
- **フロントエンド:** React, Vite, TypeScript, TipTap, Tailwind CSS (または任意のCSS設計)
- **バックエンド:** Tauri 2.0, Rust
- **データ管理:** Zustand (クライアント状態), SQLite (メタデータ), ローカルファイルシステムがSingle Source of Truth

## ⚠️ 実装時の厳格な制約（エッジケース対策）

1. **IME対応（最重要）:**
   - 日本語入力（IME）を前提としています。
   - `onKeyDown` や TipTap のトランザクション処理、特に「スラッシュコマンド」や「Markdown自動変換（InputRules）」において、**必ず `isComposing` (IME入力中) を判定**し、変換中のEnterキーで誤爆しないようにガードを入れてください。

2. **ファイル競合と状態管理:**
   - 「未保存（Dirty）のファイル」が外部プロセス（GitやDropbox等）で変更された場合、**絶対に自動でリロードして上書き破棄しない**こと。必ずユーザーに「エディタの内容を保持するか、ディスクから再読み込みするか」の選択肢を提示する設計にしてください。

3. **巨大ファイルとパフォーマンス:**
   - パフォーマンスバジェット（入力レイテンシ < 16ms）を厳守してください。
   - ファイル保存（Tauri API呼び出し）は必ずデバウンス処理し、UIスレッドをブロックしないこと。

4. **エクスポート機能:**
   - 「スタンドアロンHTML出力」を実装する際、ローカルの画像ファイルはリンク切れを防ぐため、Rust側で読み込んで Base64 (Data URI) にエンコードして `<img>` タグに埋め込んでください。

5. **履歴管理 (Undo/Redo):**
   - YAML Front Matter (CodeMirror) と本文 (TipTap) の Undo/Redo 履歴は、Phase 1では「独立しているもの」として扱い、無理に統合しようとしないでください。