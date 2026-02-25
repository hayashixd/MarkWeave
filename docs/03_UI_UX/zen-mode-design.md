# 集中モード（Zen Mode）強化 設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-25

---

## 目次

1. [概要と目的](#1-概要と目的)
2. [既存フォーカスモードとの関係](#2-既存フォーカスモードとの関係)
3. [Zen モードの視覚デザイン](#3-zen-モードの視覚デザイン)
4. [環境音（アンビエントサウンド）機能](#4-環境音アンビエントサウンド機能)
5. [タイプライターモードの統合](#5-タイプライターモードの統合)
6. [操作・ショートカット設計](#6-操作ショートカット設計)
7. [Zen モードの設定項目](#7-zen-モードの設定項目)
8. [実装方針](#8-実装方針)

---

## 1. 概要と目的

### 1.1 概要

現在設計にある「フォーカスモード」をさらに発展させ、**フルスクリーン化** + **UI（ツールバー・サイドバー・スクロールバー）の完全非表示** + **環境音（アンビエントサウンド）の再生** を組み合わせた「書くこと」に特化した没入型の執筆モード。

### 1.2 目的・設計思想

- iA Writer・Ulysses・Bear 等の「ライティング特化エディタ」が持つ **集中できる執筆環境** を提供
- 通知・UI の煩雑さを全て排除し、テキストのみに集中できる状態を作る
- 環境音は脳の集中状態を維持するバックグラウンドノイズとして機能する

---

## 2. 既存フォーカスモードとの関係

現在 [roadmap.md](./roadmap.md) Phase 7 および [typora-analysis.md](./typora-analysis.md) §2.3 に言及がある「フォーカスモード・タイプライターモード」との対応:

| モード | 既存設計 | Zen モード（本設計）|
|-------|---------|-------------------|
| フォーカスモード | 現在の段落以外を淡色表示 | フォーカスモードを内包・強化 |
| タイプライターモード | カーソル行を常に中央に固定 | タイプライターモードを内包 |
| **Zen モード** | ─ | フルスクリーン + UI 完全非表示 + 環境音 |

Zen モードはフォーカスモード・タイプライターモードを **内部で有効化するスーパーセット** として位置づける。

---

## 3. Zen モードの視覚デザイン

### 3.1 有効時の画面構成

```
Zen モード有効時（フルスクリーン）:

┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                                                                │
│                   テキストエリアのみ表示                        │
│                                                                │
│         ┌──────────────────────────────────────┐              │
│         │                                      │              │
│         │   書いている内容がここに表示される    │              │
│         │   フォーカスは現在の段落              │              │
│         │                                      │              │
│         └──────────────────────────────────────┘              │
│                                                                │
│                                                                │
│                                    [Esc] で Zen モード終了     │  ← 薄く表示
└────────────────────────────────────────────────────────────────┘
  ↑ ツールバー・タブバー・サイドバー・ステータスバー・スクロールバー = 全て非表示
```

### 3.2 非表示になる UI 要素

| UI 要素 | 通常 | Zen モード |
|---------|------|----------|
| ツールバー | 表示 | 非表示 |
| タブバー | 表示 | 非表示 |
| サイドバー（ファイルツリー等） | 表示/非表示 | 強制非表示 |
| ステータスバー | 表示 | 非表示 |
| スクロールバー | 表示 | 非表示（スクロールは可能）|
| OS のタイトルバー | 表示 | 非表示（Tauri フルスクリーン）|
| メニューバー | 表示 | 非表示（マウス最上部ホバーで一時表示）|

### 3.3 テキストエリアのスタイリング

Zen モード中のエディタ本体のスタイル:

```css
/* Zen モード中のエディタ CSS */
.editor--zen-mode {
  /* 幅の制限（iA Writer 方式） */
  max-width: var(--zen-content-width, 680px);
  margin: 0 auto;

  /* 上下のマージンを大きく取る */
  padding: var(--zen-padding-v, 80px) 0;

  /* フォント設定 */
  font-size: var(--zen-font-size, 18px);
  line-height: var(--zen-line-height, 1.8);

  /* 背景色（ライト/ダークテーマに追従） */
  background: var(--zen-bg-color);
}
```

### 3.4 マウスホバーでの一時 UI 表示

マウスをウィンドウ上端に持っていくと、ツールバーが半透明で一時表示される（3 秒後に自動非表示）。

```
マウス最上部に移動:
┌──────────────────────────────────────────┐ ← 半透明ツールバー（opacity: 0.85）
│ [Bold] [Italic] [Link] ...               │    マウスが離れると消える
└──────────────────────────────────────────┘
│                                          │
│   テキストエリア                         │
```

---

## 4. 環境音（アンビエントサウンド）機能

### 4.1 提供する環境音

| 環境音 | 説明 |
|-------|------|
| **ホワイトノイズ** | 一定周波数のランダムノイズ（集中・遮音効果）|
| **雨音** | 雨が降る自然音 |
| **カフェ** | 軽い話し声・BGM・食器音が混ざった喫茶店の雰囲気 |
| **焚き火** | 木の燃える音・パチパチ音 |
| **タイプライター音** | キーを叩くたびにタイプライター打鍵音（タイプ音フィードバック）|
| **無音** | 環境音なし（デフォルト）|

### 4.2 音量コントロール

- Zen モード中に右下に小さな音量コントロールを表示（半透明、マウスホバーで表示）
- 音量スライダー: 0〜100%
- 環境音の切り替えドロップダウン

```
画面右下（ホバー時に表示）:
┌──────────────────────────┐
│ 🎵 雨音  ─────●─── 60%  │
└──────────────────────────┘
```

### 4.3 タイプライター音の実装

タイプライター音は環境音ではなく**タイプフィードバック音**として独立した設定を持つ。

```typescript
// タイプライター音のトリガー
editor.on('keydown', (event) => {
  if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Enter') {
    playTypewriterSound(event.key);
  }
});

// 音の種類
const TYPEWRITER_SOUNDS = {
  char: 'click.wav',        // 通常のキー打鍵
  space: 'click-space.wav', // スペースキー
  enter: 'return.wav',      // Enter（改行）
  backspace: 'click.wav',   // バックスペース
};
```

### 4.4 音声ファイルの提供方式

- 環境音はアプリバンドルに含める（ライセンスフリー素材を使用）
- 音声形式: WebM(Opus) / OGG を使用（Tauri の WebView で再生）
- ファイルサイズ: 各環境音は 5MB 以内（ループ再生のためのショートクリップ）

---

## 5. タイプライターモードの統合

Zen モードはデフォルトでタイプライターモードを有効にする（設定で解除可能）。

### 5.1 タイプライターモードの動作

[typora-analysis.md](./typora-analysis.md) §2.3 で言及されているタイプライターモード:

- **現在入力中の行を常に画面中央に固定**（スクロールアニメーション付き）
- 過去の行は上にスクロールして見えなくなる
- 将来の行（先読み）も下にスクロールして非表示

```typescript
// タイプライターモードの実装
function useTypewriterScroll(editor: Editor) {
  useEffect(() => {
    const updateScroll = () => {
      const { $from } = editor.state.selection;
      const cursorTop = editor.view.coordsAtPos($from.pos).top;
      const viewportCenter = window.innerHeight / 2;
      const scrollTarget = window.scrollY + cursorTop - viewportCenter;
      window.scrollTo({ top: scrollTarget, behavior: 'smooth' });
    };

    editor.on('selectionUpdate', updateScroll);
    editor.on('update', updateScroll);
    return () => {
      editor.off('selectionUpdate', updateScroll);
      editor.off('update', updateScroll);
    };
  }, [editor]);
}
```

---

## 6. 操作・ショートカット設計

### 6.1 Zen モードの開始・終了

| 操作 | 動作 |
|------|------|
| `Ctrl+Shift+Z` (Windows/Linux) / `Cmd+Shift+Z` (macOS) | Zen モードのトグル |
| `F11` | フルスクリーンのトグル（Zen モードと連動）|
| `Esc` | Zen モード終了（フルスクリーンも解除）|
| メニュー: 表示 → Zen モード | Zen モードのトグル |

> **注記**: `Ctrl+Shift+Z` は通常 Redo のショートカット。Zen モードのトリガーには `Ctrl+Shift+Z` の代わりに専用ショートカットを割り当てる（[keyboard-shortcuts.md](./keyboard-shortcuts.md) §1 と競合しないか要確認）。

### 6.2 Zen モード中に利用可能なショートカット

Zen モード中でもエディタの全ショートカット（Ctrl+B, Ctrl+I 等）は利用可能。追加のショートカット:

| キー | 動作 |
|------|------|
| `Esc` | Zen モード終了 |
| `Ctrl+,` | 設定を開く（Zen モード設定タブ）|
| `Ctrl+Shift+M` | 環境音のミュート/ミュート解除 |
| `Ctrl+↑` / `Ctrl+↓` | 環境音の音量を増減 |

---

## 7. Zen モードの設定項目

[user-settings-design.md](./user-settings-design.md) に追加する設定:

```typescript
interface AppearanceSettings {
  // ... 既存設定
  zenMode: {
    enableTypewriterMode: boolean;      // タイプライターモード（デフォルト: true）
    enableFocusMode: boolean;           // フォーカスモード（現在段落を強調）（デフォルト: true）
    contentWidth: number;               // テキスト幅 px（デフォルト: 680）
    fontSize: number;                   // フォントサイズ px（デフォルト: 18）
    lineHeight: number;                 // 行間（デフォルト: 1.8）
    ambientSound: AmbientSoundType;     // 環境音の種類（デフォルト: 'none'）
    ambientVolume: number;              // 環境音の音量 0-100（デフォルト: 40）
    typewriterSoundEnabled: boolean;    // タイプライター打鍵音（デフォルト: false）
    typewriterSoundVolume: number;      // 打鍵音の音量 0-100（デフォルト: 60）
    showHoverToolbar: boolean;          // ホバーでツールバー表示（デフォルト: true）
    showWordCount: boolean;             // Zen モード中の文字数表示（デフォルト: true）
  };
}

type AmbientSoundType = 'none' | 'white-noise' | 'rain' | 'cafe' | 'fire' | 'typewriter';
```

---

## 8. 実装方針

### 8.1 フルスクリーン実装

Tauri の `Window.setFullscreen()` API を使用する。

```typescript
// src/store/zenModeStore.ts
import { getCurrentWindow } from '@tauri-apps/api/window';

interface ZenModeStore {
  isActive: boolean;
  enter: () => Promise<void>;
  exit: () => Promise<void>;
  toggle: () => Promise<void>;
}

const useZenModeStore = create<ZenModeStore>((set, get) => ({
  isActive: false,

  enter: async () => {
    const win = getCurrentWindow();
    await win.setFullscreen(true);
    set({ isActive: true });
    // CSS クラスを body に追加
    document.body.classList.add('zen-mode');
    // 環境音を開始
    ambientSoundStore.play(zenModeSettings.ambientSound);
  },

  exit: async () => {
    const win = getCurrentWindow();
    await win.setFullscreen(false);
    set({ isActive: false });
    document.body.classList.remove('zen-mode');
    ambientSoundStore.stop();
  },

  toggle: async () => {
    get().isActive ? get().exit() : get().enter();
  },
}));
```

### 8.2 CSS での UI 非表示

```css
/* src/styles/zen-mode.css */
body.zen-mode .toolbar { display: none !important; }
body.zen-mode .tab-bar { display: none !important; }
body.zen-mode .sidebar { display: none !important; }
body.zen-mode .status-bar { display: none !important; }
body.zen-mode ::-webkit-scrollbar { width: 0; height: 0; }

/* テキストエリアの最大幅設定 */
body.zen-mode .editor-container {
  max-width: var(--zen-content-width);
  margin: 0 auto;
  padding: var(--zen-padding-v) 0;
  font-size: var(--zen-font-size);
  line-height: var(--zen-line-height);
}

/* ホバー時のツールバー */
body.zen-mode:has(.toolbar:hover) .toolbar {
  display: flex !important;
  opacity: 0.85;
  animation: fade-out 3s ease-in 0s forwards;
}
```

### 8.3 環境音の再生

Web Audio API を使用してブラウザ内で音声を再生する。

```typescript
// src/core/ambient-sound/player.ts
class AmbientSoundPlayer {
  private audioContext: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;

  async play(type: AmbientSoundType, volume: number) {
    if (type === 'none') { this.stop(); return; }

    this.audioContext = new AudioContext();
    const buffer = await this.loadSound(type);

    this.source = this.audioContext.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = true;

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = volume / 100;

    this.source.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
    this.source.start();
  }

  setVolume(volume: number) {
    if (this.gainNode) {
      this.gainNode.gain.setTargetAtTime(volume / 100, this.audioContext!.currentTime, 0.1);
    }
  }

  stop() {
    this.source?.stop();
    this.audioContext?.close();
    this.source = null;
    this.audioContext = null;
  }
}
```

---

## 関連ドキュメント

- [app-shell-design.md](./app-shell-design.md) §6 — フルスクリーンモード設計（既存）
- [typora-analysis.md](./typora-analysis.md) §2.3 — フォーカスモード・タイプライターモード分析
- [user-settings-design.md](./user-settings-design.md) — ユーザー設定スキーマ
- [keyboard-shortcuts.md](./keyboard-shortcuts.md) — キーボードショートカット設計
- [accessibility-design.md](./accessibility-design.md) — フルスクリーン時のアクセシビリティ
