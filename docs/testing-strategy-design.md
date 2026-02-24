# テスト戦略設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [テスト全体方針](#1-テスト全体方針)
2. [UI コンポーネントテスト](#2-ui-コンポーネントテスト)
3. [E2E テストシナリオ](#3-e2e-テストシナリオ)
4. [パフォーマンスリグレッションテスト](#4-パフォーマンスリグレッションテスト)
5. [セキュリティテスト](#5-セキュリティテスト)

---

## 1. テスト全体方針

### 1.1 テストピラミッド

```
        ┌───────┐
        │  E2E  │  少数・重要シナリオのみ（Tauri WebDriver）
        ├───────┤
        │統合テスト│  TipTap エディタ + ファイル操作の結合テスト
        ├───────┤
        │ユニット│  純粋関数・変換ロジック・ユーティリティ
        └───────┘
```

| テスト種別 | フレームワーク | 実行環境 |
|-----------|--------------|---------|
| ユニットテスト | Vitest | Node.js (jsdom) |
| コンポーネントテスト | Vitest + @testing-library/react | jsdom |
| 統合テスト | Vitest | jsdom + Tauri モック |
| E2E テスト | WebdriverIO + tauri-driver | 実 Tauri アプリ |
| パフォーマンス | Lighthouse CI / カスタムベンチマーク | 実ブラウザ |

### 1.2 カバレッジ目標

| モジュール | カバレッジ目標 |
|-----------|-------------|
| `src/utils/` (純粋関数) | 90%+ |
| `src/file/` (ファイル操作) | 80%+ |
| `src/components/` (UI) | 60%+ |
| `src-tauri/` (Rust) | 70%+ (`cargo test`) |

### 1.3 CI/CD パイプライン

```yaml
# .github/workflows/test.yml（抜粋）
jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:unit -- --coverage

  component-test:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:component

  e2e-test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - run: npm run build
      - run: npm run test:e2e
```

---

## 2. UI コンポーネントテスト

### 2.1 テスト対象コンポーネント

| コンポーネント | テスト観点 |
|--------------|-----------|
| `Editor` | Markdown/HTML 表示切り替え、フォーカス管理 |
| `TabBar` | タブ追加・削除・切り替え、未保存インジケータ |
| `FileTree` | フォルダ展開・縮小、ファイル選択・作成 |
| `StatusBar` | 文字数・言語・エンコーディング表示 |
| `SearchPanel` | 検索・置換 UI、ハイライト |
| `SettingsModal` | 各設定項目の入力と保存 |

### 2.2 Editor コンポーネントテスト例

```typescript
// src/components/__tests__/Editor.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '../Editor';
import { createEditor } from '../../test-utils/editor';

describe('Editor コンポーネント', () => {
  it('Markdown テキストを正しくレンダリングする', () => {
    const editor = createEditor({ content: '# Hello World' });
    render(<Editor editor={editor} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello World');
  });

  it('ボールド記法 Ctrl+B が機能する', async () => {
    const user = userEvent.setup();
    const editor = createEditor({ content: 'Hello' });
    render(<Editor editor={editor} />);

    // テキストを選択
    await user.click(screen.getByText('Hello'));
    await user.keyboard('{Control>}a{/Control}');
    // ボールドを適用
    await user.keyboard('{Control>}b{/Control}');

    expect(editor.isActive('bold')).toBe(true);
  });

  it('未保存の状態でタブタイトルに * が付く', () => {
    render(<TabBar tabs={[{ title: 'note.md', isDirty: true }]} />);
    expect(screen.getByText('* note.md')).toBeInTheDocument();
  });
});
```

### 2.3 TipTap モックユーティリティ

```typescript
// src/test-utils/editor.ts
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { markdownToTiptap } from '../markdown/converter';

export function createEditor(options: {
  content?: string;
  html?: string;
}): Editor {
  return new Editor({
    extensions: [StarterKit],
    content: options.html ?? (options.content
      ? markdownToTiptap(options.content)
      : ''),
  });
}
```

---

## 3. E2E テストシナリオ

### 3.1 Tauri WebDriver セットアップ

```typescript
// tests/e2e/setup.ts
import { Builder, WebDriver } from 'webdriverio';
import { spawn, ChildProcess } from 'child_process';

let driver: WebDriver;
let tauriDriver: ChildProcess;

before(async () => {
  // tauri-driver を起動
  tauriDriver = spawn('tauri-driver', [], { stdio: 'inherit' });

  driver = await new Builder()
    .usingServer('http://localhost:4444')
    .withCapabilities({
      'tauri:options': {
        application: './target/release/md-editor',
      },
    })
    .build();
});

after(async () => {
  await driver.deleteSession();
  tauriDriver.kill();
});
```

### 3.2 重要 E2E シナリオ

#### シナリオ 1: ファイルの作成・編集・保存

```typescript
it('新規ファイルを作成して保存できる', async () => {
  // Ctrl+N で新規ファイルを作成
  await driver.keys(['Control', 'n']);
  const tab = await driver.$('.tab-title');
  expect(await tab.getText()).toContain('Untitled-1');

  // テキストを入力
  const editor = await driver.$('.ProseMirror');
  await editor.click();
  await driver.keys(['# Hello World', 'Enter', 'This is a test.']);

  // Ctrl+S で保存
  await driver.keys(['Control', 's']);

  // ファイル保存ダイアログの処理（OS ネイティブなのでスキップ）
  // ...
});
```

#### シナリオ 2: Markdown → HTML 切り替え

```typescript
it('WYSIWYG と Source モードを切り替えられる', async () => {
  // Source モードに切り替え
  const modeButton = await driver.$('[data-mode="source"]');
  await modeButton.click();

  const codeEditor = await driver.$('.cm-editor');
  expect(await codeEditor.isDisplayed()).toBe(true);

  // WYSIWYG に戻す
  const wysiwygButton = await driver.$('[data-mode="wysiwyg"]');
  await wysiwygButton.click();

  const proseMirror = await driver.$('.ProseMirror');
  expect(await proseMirror.isDisplayed()).toBe(true);
});
```

#### シナリオ 3: 検索・置換

```typescript
it('テキストを検索して置換できる', async () => {
  await driver.keys(['Control', 'h']); // 置換パネルを開く

  const searchInput = await driver.$('[data-testid="search-input"]');
  await searchInput.setValue('Hello');

  const replaceInput = await driver.$('[data-testid="replace-input"]');
  await replaceInput.setValue('World');

  const replaceAllBtn = await driver.$('[data-testid="replace-all"]');
  await replaceAllBtn.click();

  // 置換結果を確認
  const toastMsg = await driver.$('.toast-message');
  expect(await toastMsg.getText()).toMatch(/2 件を置換/);
});
```

#### シナリオ 4: ファイルツリーからファイルを開く

```typescript
it('ファイルツリーのダブルクリックでファイルを開ける', async () => {
  const fileItem = await driver.$('[data-testid="file-tree-item"][data-filename="README.md"]');
  await fileItem.doubleClick();

  const tab = await driver.$('.tab-title.active');
  expect(await tab.getText()).toContain('README.md');
});
```

---

## 4. パフォーマンスリグレッションテスト

### 4.1 測定項目

| 指標 | 説明 | 目標値 |
|------|------|--------|
| 起動時間 | アプリ起動 → エディタ表示まで | < 2秒 |
| ファイルオープン時間 | 1MB の .md ファイルを開くまで | < 500ms |
| 入力レイテンシ | キー入力 → 画面反映 | < 16ms (60fps) |
| 検索応答時間 | 10万行ファイルでの全文検索 | < 1秒 |
| メモリ使用量 | 10ファイルを同時に開いた状態 | < 300MB |

### 4.2 Vitest ベンチマーク

```typescript
// src/utils/__benchmarks__/markdown-conversion.bench.ts
import { bench, describe } from 'vitest';
import { markdownToTiptap, tiptapToMarkdown } from '../markdown/converter';
import { readFileSync } from 'fs';

const largeMd = readFileSync('./fixtures/large-document.md', 'utf-8');

describe('Markdown 変換パフォーマンス', () => {
  bench('1MB Markdown → TipTap JSON 変換', () => {
    markdownToTiptap(largeMd);
  });

  bench('TipTap JSON → Markdown 変換', () => {
    const json = markdownToTiptap(largeMd);
    tiptapToMarkdown(json);
  });
});
```

### 4.3 CI でのパフォーマンス監視

```yaml
# .github/workflows/perf.yml
- name: Run benchmarks
  run: npm run bench -- --reporter=json > bench-results.json

- name: Compare with baseline
  uses: CodSpeed-HQ/action@v2  # または自前の比較スクリプト
  with:
    token: ${{ secrets.CODSPEED_TOKEN }}
```

**しきい値超過時の動作:** PR に警告コメントを追加（マージはブロックしない）

---

## 5. セキュリティテスト

### 5.1 XSS テスト

```typescript
// src/security/__tests__/xss.test.ts
import { sanitizeHtml } from '../sanitizer';

describe('XSS サニタイズ', () => {
  const xssPayloads = [
    '<script>alert("xss")</script>',
    '<img src="x" onerror="alert(1)">',
    '<a href="javascript:alert(1)">click</a>',
    '"><script>alert(document.cookie)</script>',
    '<svg onload="alert(1)">',
  ];

  xssPayloads.forEach(payload => {
    it(`XSS ペイロードを無害化する: ${payload.slice(0, 40)}`, () => {
      const sanitized = sanitizeHtml(payload);
      expect(sanitized).not.toMatch(/on\w+=/i);
      expect(sanitized).not.toMatch(/<script/i);
      expect(sanitized).not.toMatch(/javascript:/i);
    });
  });
});
```

### 5.2 パストラバーサルテスト

```typescript
// src/file/__tests__/path-security.test.ts
describe('パストラバーサル防止', () => {
  it('ワークスペース外のパスへのアクセスを拒否する', async () => {
    const workspace = '/home/user/documents';
    const maliciousPaths = [
      '../../../etc/passwd',
      '/etc/passwd',
      '..\\..\\Windows\\System32',
    ];

    for (const path of maliciousPaths) {
      await expect(
        readFileWithinWorkspace(path, workspace)
      ).rejects.toThrow('ワークスペース外のパスへのアクセスは許可されていません');
    }
  });
});
```

### 5.3 コンテンツセキュリティポリシー（CSP）テスト

```typescript
// Tauri CSP ヘッダーの検証
it('CSP が適切に設定されている', async () => {
  // tauri.conf.json の CSP 設定を確認
  const config = require('../src-tauri/tauri.conf.json');
  const csp = config.tauri.security.csp;

  expect(csp).toContain("default-src 'self'");
  expect(csp).not.toContain("'unsafe-eval'");
  expect(csp).toContain("script-src 'self'");
});
```

### 5.4 依存関係の脆弱性スキャン

```yaml
# .github/workflows/security.yml
- name: npm audit
  run: npm audit --audit-level=high

- name: cargo audit
  run: cargo audit

- name: Snyk test
  uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

---

## 関連ドキュメント

- [security-design.md](./security-design.md) — XSS 対策・CSP 設定
- [community-design.md](./community-design.md) — バグ報告・クラッシュレポート
