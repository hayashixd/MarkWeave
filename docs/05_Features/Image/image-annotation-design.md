# 画像アノテーション（簡易注釈）設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-25

---

## 目次

1. [概要と目的](#1-概要と目的)
2. [提供するアノテーションツール](#2-提供するアノテーションツール)
3. [UI 設計](#3-ui-設計)
4. [操作フロー](#4-操作フロー)
5. [描画ツールの詳細設計](#5-描画ツールの詳細設計)
6. [画像の保存設計](#6-画像の保存設計)
7. [実装方針](#7-実装方針)
8. [制約事項](#8-制約事項)

---

## 1. 概要と目的

### 1.1 概要

エディタに貼り付けた画像に対して、エディタ内で直接「赤枠」「矢印」「テキスト注釈」「モザイク（ぼかし）」などの注釈を追加できる機能。アノテーション後の画像は元の画像を置き換えて保存される。

### 1.2 目的・設計思想

- マニュアル・ブログ・技術記事でスクリーンショットを多用するユーザーが、**外部画像編集ソフトを開かずにエディタ内で完結**して注釈を追加できる
- Skitch・macOS のマークアップツールなど既存ツールの「軽量さ」を参考に、過剰な機能を追加しない
- モバイルは対象外（デスクトップ専用機能）

---

## 2. 提供するアノテーションツール

| ツール | アイコン | 説明 |
|-------|---------|------|
| **矩形（赤枠）** | □ | 強調したい領域を囲む矩形を描画 |
| **楕円** | ○ | 円形・楕円の強調枠を描画 |
| **矢印** | → | 指し示す矢印を描画 |
| **フリーハンド線** | ✏ | 自由な曲線を描画 |
| **テキスト** | T | 任意のテキストラベルを追加 |
| **モザイク（ぼかし）** | ▓ | 個人情報など隠したい領域をぼかす |
| **ステップ番号** | ❶ | 丸囲み数字（手順説明用） |
| **消しゴム** | ⌫ | 追加したアノテーションを削除 |

---

## 3. UI 設計

### 3.1 アノテーションモードの起動

```
画像をダブルクリック → アノテーションモードに入る

┌───────────────────────────────────────────────────────┐
│ [□] [○] [→] [✏] [T] [▓] [❶] [⌫]  ─  ●  [色] [Undo]│  ← アノテーションツールバー
├───────────────────────────────────────────────────────┤
│                                                       │
│     ┌──────────────────────────────────────────┐      │
│     │                                          │      │
│     │          アノテーション対象の画像          │      │
│     │                                          │      │
│     └──────────────────────────────────────────┘      │
│                                                       │
│                [完了]  [キャンセル]                    │
└───────────────────────────────────────────────────────┘
```

### 3.2 アノテーションツールバー

| 要素 | 詳細 |
|------|------|
| ツールボタン | 各ツールをクリックで選択（アクティブなツールはハイライト） |
| 線幅スライダー | `─` → `━` で細い〜太い線幅を選択（1px〜8px） |
| カラーピッカー | 描画色を選択（プリセット: 赤・青・黄・黒・白 + カスタム）|
| Undo ボタン | 最後の操作を取り消す（Ctrl+Z も有効） |
| 完了ボタン | アノテーションを画像に合成して保存 |
| キャンセルボタン | アノテーションを破棄して元の画像に戻る |

### 3.3 カラープリセット

```
[●赤] [●青] [●黄] [●緑] [●黒] [●白]  [カスタム...]
```

デフォルト選択色: **赤**（最も頻繁に使われるアノテーション色）

---

## 4. 操作フロー

### 4.1 アノテーション追加フロー

```
1. エディタ内の画像をダブルクリック
2. アノテーションモード開始（画像がキャンバスとしてオーバーレイ表示）
3. ツールバーでツールと色を選択
4. 画像上でドラッグして描画
5. 必要に応じて繰り返し
6. [完了] をクリック
7. アノテーション済み画像が元画像ファイルに上書き保存される
8. Markdown の img タグは変更なし（ファイルパスが同じため）
```

### 4.2 アノテーション後の再編集

- アノテーション済み画像を再度ダブルクリックすると、アノテーションモードに入れる
- ただし、前回の描画は**ラスタライズされており**、個別の取り消しはできない
  - 元画像を維持する「非破壊モード」は [§8 制約事項](#8-制約事項) 参照

---

## 5. 描画ツールの詳細設計

### 5.1 矩形ツール

```
操作: ドラッグで矩形を描画
オプション: 塗りつぶしなし（枠のみ）/ 半透明塗りつぶし（opacity: 0.3）
ショートカット: R
```

### 5.2 矢印ツール

```
操作: ドラッグで矢印を描画（始点 → 終点）
矢印形状: 終点に塗りつぶし三角形の矢印頭
ショートカット: A
```

### 5.3 テキストツール

```
操作: クリックでテキスト入力フィールドを配置
フォント: 16px Bold（固定）
テキスト入力後: Enter または外部クリックで確定
ショートカット: T
```

### 5.4 モザイク（ぼかし）ツール

```
操作: ドラッグした矩形範囲にピクセルモザイクを適用
モザイクサイズ: 10px × 10px ブロック（設定変更可）
ショートカット: B（Blur）
実装: Canvas の drawImage + ダウンスケール + アップスケール
```

### 5.5 ステップ番号ツール

```
操作: クリックで番号付き丸印を配置（❶, ❷, ❸...と自動インクリメント）
サイズ: 28px 直径、数字は白文字
クリックごとに番号が1増加（最大99まで）
ショートカット: N（Number）
```

---

## 6. 画像の保存設計

### 6.1 保存フォーマット

- 入力画像の形式に合わせて保存:
  - `.png` → `canvas.toBlob('image/png')`
  - `.jpg` / `.jpeg` → `canvas.toBlob('image/jpeg', 0.95)`
  - `.webp` → `canvas.toBlob('image/webp', 0.9)`
- SVG や GIF は PNG に変換して保存（変換警告を表示）

### 6.2 元画像のバックアップ

アノテーション保存前に元画像を `{filename}_original.{ext}` としてバックアップする。

```
flow:
  1. 元ファイル: screenshot.png
  2. バックアップ: screenshot_original.png  （自動作成）
  3. アノテーション後: screenshot.png に上書き

注意: バックアップは設定でオフ可能（デフォルト: オン）
```

### 6.3 保存処理

```typescript
// src/core/image-annotation/save.ts
async function saveAnnotatedImage(
  originalPath: string,
  canvas: HTMLCanvasElement,
): Promise<void> {
  const ext = originalPath.split('.').pop()!.toLowerCase();
  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob(b => resolve(b!), mimeType, 0.95)
  );
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Tauri ファイル書き込み
  await invoke('write_file_bytes', { path: originalPath, bytes: Array.from(bytes) });
}
```

---

## 7. 実装方針

### 7.1 HTML Canvas を用いた実装

アノテーション機能は **HTML Canvas API** を使用してブラウザ側（フロントエンド）で完結させる。外部ライブラリへの依存を最小化し、Tauri のサンドボックス内で安全に動作させる。

```typescript
// src/components/ImageAnnotator/index.tsx
// Canvas の compositing を使用して重ね描き
const TOOL_HANDLERS: Record<AnnotationTool, DrawHandler> = {
  rect: drawRect,
  ellipse: drawEllipse,
  arrow: drawArrow,
  freehand: drawFreehand,
  text: drawText,
  mosaic: drawMosaic,
  stepNumber: drawStepNumber,
};
```

### 7.2 Undo の実装

各描画操作前に Canvas の状態を `ctx.getImageData()` でスナップショット保存し、Undo 時に復元する。

```typescript
const MAX_UNDO_STEPS = 20;
const undoStack: ImageData[] = [];

function saveUndoState(ctx: CanvasRenderingContext2D) {
  const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  undoStack.push(snapshot);
  if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift();
}

function undo(ctx: CanvasRenderingContext2D) {
  const snapshot = undoStack.pop();
  if (snapshot) ctx.putImageData(snapshot, 0, 0);
}
```

### 7.3 TipTap NodeView との統合

```typescript
// src/renderer/wysiwyg/node-views/image-view.tsx
// 既存の ImageNodeView に onDoubleClick を追加
function ImageNodeView({ node }: NodeViewProps) {
  const [isAnnotating, setIsAnnotating] = useState(false);

  return (
    <NodeViewWrapper>
      <img
        src={node.attrs.src}
        onDoubleClick={() => setIsAnnotating(true)}
        style={...}
      />
      {isAnnotating && (
        <ImageAnnotatorOverlay
          imageSrc={node.attrs.src}
          imagePath={node.attrs.localPath}
          onSave={() => setIsAnnotating(false)}
          onCancel={() => setIsAnnotating(false)}
        />
      )}
    </NodeViewWrapper>
  );
}
```

---

## 8. 制約事項

| 制約 | 詳細 |
|------|------|
| デスクトップ専用 | モバイルではポインタ操作の精度が低いため無効 |
| ラスタライズ方式 | アノテーションは画像に合成されるため、保存後は個別編集不可 |
| 外部 URL 画像は非対応 | `https://...` の画像には適用不可（ローカル保存画像のみ）|
| アニメーション GIF | 最初のフレームのみ PNG としてアノテーション・保存 |
| 非破壊編集は将来対応 | アノテーションレイヤーを JSON で保存・再編集する機能は Phase 9 以降で検討 |

---

## 関連ドキュメント

- [image-storage-design.md](./image-storage-design.md) — 画像管理・ファイルパス設計
- [image-operations-design.md](./image-operations-design.md) — 画像リサイズ・最適化設計
- [editor-ux-design.md](./editor-ux-design.md) §6 — 画像インラインリサイズ UI
- [security-design.md](./security-design.md) — Canvas のセキュリティ（taint 対策）
