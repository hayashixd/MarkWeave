#!/usr/bin/env node
// マークダウンファイルの編集マニュアル HTML生成スクリプト
const fs = require('fs');
const path = require('path');

const screenshotBase = path.join(__dirname, 'manual-screenshots');
const outputPath = path.join(__dirname, 'manual-markdown-editing.html');

function loadImage(relPath) {
  const fullPath = path.join(screenshotBase, relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn('Image not found:', fullPath);
    return null;
  }
  const data = fs.readFileSync(fullPath);
  return 'data:image/png;base64,' + data.toString('base64');
}

// Load all images
const imgs = {
  // headings
  h1: loadImage('headings/01_h1-result.png'),
  h2: loadImage('headings/02_h2-result.png'),
  h3: loadImage('headings/03_h3-result.png'),
  blockDropdown: loadImage('headings/04_block-type-dropdown.png'),
  headingsOverview: loadImage('headings/05_headings-overview.png'),
  // text-formatting
  toolbarOverview: loadImage('text-formatting/01_toolbar-overview.png'),
  italic: loadImage('text-formatting/02_italic-result.png'),
  strikethrough: loadImage('text-formatting/03_strikethrough-result.png'),
  inlineCode: loadImage('text-formatting/04_inline-code-result.png'),
  formattingOverview: loadImage('text-formatting/05_formatting-overview.png'),
  // lists
  bulletList: loadImage('lists/01_bullet-list.png'),
  orderedList: loadImage('lists/02_ordered-list.png'),
  taskList: loadImage('lists/03_task-list.png'),
  listToolbar: loadImage('lists/04_list-toolbar-buttons.png'),
  // source-mode
  wysiwygMode: loadImage('source-mode/01_wysiwyg-mode.png'),
  sourceButton: loadImage('source-mode/02_source-button.png'),
  sourceModeActive: loadImage('source-mode/03_source-mode-active.png'),
  sourceMarkdown: loadImage('source-mode/04_source-markdown-visible.png'),
  backToWysiwyg: loadImage('source-mode/05_back-to-wysiwyg.png'),
  // bold-text
  boldResult: loadImage('bold-text/05_result-bold.png'),
};

function imgTag(src, alt, caption) {
  if (!src) return `<p class="img-missing">[画像: ${alt}]</p>`;
  let html = `<figure><img src="${src}" alt="${alt}" loading="lazy">`;
  if (caption) html += `<figcaption>${caption}</figcaption>`;
  html += `</figure>`;
  return html;
}

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>マークダウンファイルの編集 - ユーザーマニュアル</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", sans-serif;
    background: #f8f9fa;
    color: #212529;
    line-height: 1.7;
  }
  header {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    color: #fff;
    padding: 48px 32px 40px;
    text-align: center;
  }
  header h1 { font-size: 2.2rem; font-weight: 700; margin-bottom: 8px; }
  header p { opacity: 0.8; font-size: 1rem; }
  .toc {
    background: #fff;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 24px 32px;
    max-width: 860px;
    margin: 32px auto 0;
  }
  .toc h2 { font-size: 1rem; font-weight: 700; margin-bottom: 12px; color: #495057; text-transform: uppercase; letter-spacing: 0.05em; }
  .toc ol { padding-left: 20px; }
  .toc li { margin-bottom: 6px; }
  .toc a { color: #0d6efd; text-decoration: none; }
  .toc a:hover { text-decoration: underline; }
  main { max-width: 860px; margin: 0 auto; padding: 32px 16px 64px; }
  section {
    background: #fff;
    border-radius: 12px;
    border: 1px solid #dee2e6;
    padding: 36px 40px;
    margin-bottom: 32px;
  }
  section h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a1a2e;
    border-bottom: 3px solid #0d6efd;
    padding-bottom: 10px;
    margin-bottom: 24px;
  }
  section h3 {
    font-size: 1.1rem;
    font-weight: 600;
    color: #343a40;
    margin: 28px 0 12px;
  }
  p { margin-bottom: 12px; }
  figure {
    margin: 20px 0;
    text-align: center;
  }
  figure img {
    max-width: 100%;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  }
  figcaption {
    margin-top: 8px;
    font-size: 0.85rem;
    color: #6c757d;
    font-style: italic;
  }
  .img-missing {
    background: #f8d7da;
    border: 1px solid #f5c2c7;
    border-radius: 6px;
    padding: 12px;
    color: #842029;
    font-size: 0.9rem;
  }
  .steps {
    counter-reset: step;
    list-style: none;
    padding: 0;
  }
  .steps li {
    counter-increment: step;
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
    align-items: flex-start;
  }
  .steps li::before {
    content: counter(step);
    background: #0d6efd;
    color: #fff;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.85rem;
    flex-shrink: 0;
    margin-top: 2px;
  }
  kbd {
    display: inline-block;
    background: #f8f9fa;
    border: 1px solid #adb5bd;
    border-bottom: 3px solid #6c757d;
    border-radius: 4px;
    padding: 2px 8px;
    font-family: monospace;
    font-size: 0.85em;
  }
  code {
    background: #f1f3f5;
    border-radius: 4px;
    padding: 2px 6px;
    font-family: "Courier New", monospace;
    font-size: 0.9em;
    color: #d63384;
  }
  .tip {
    background: #cff4fc;
    border-left: 4px solid #0dcaf0;
    border-radius: 0 6px 6px 0;
    padding: 12px 16px;
    margin: 16px 0;
    font-size: 0.95rem;
  }
  .tip strong { color: #055160; }
  .shortcut-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 16px;
  }
  .shortcut-table th {
    background: #e9ecef;
    padding: 10px 16px;
    text-align: left;
    font-weight: 600;
    font-size: 0.9rem;
    border-bottom: 2px solid #dee2e6;
  }
  .shortcut-table td {
    padding: 10px 16px;
    border-bottom: 1px solid #f1f3f5;
    font-size: 0.9rem;
  }
  .shortcut-table tr:hover td { background: #f8f9fa; }
  footer {
    text-align: center;
    padding: 24px;
    color: #6c757d;
    font-size: 0.85rem;
  }
</style>
</head>
<body>

<header>
  <h1>マークダウンファイルの編集</h1>
  <p>Typora風 WYSIWYG Markdownエディタ ユーザーマニュアル</p>
</header>

<div class="toc">
  <h2>目次</h2>
  <ol>
    <li><a href="#overview">エディタ概要</a></li>
    <li><a href="#headings">見出しの入力</a></li>
    <li><a href="#bold">太字</a></li>
    <li><a href="#text-formatting">テキスト書式設定</a></li>
    <li><a href="#lists">リストの作成</a></li>
    <li><a href="#source-mode">ソースモード切替</a></li>
    <li><a href="#shortcuts">キーボードショートカット一覧</a></li>
  </ol>
</div>

<main>

  <!-- 1. エディタ概要 -->
  <section id="overview">
    <h2>1. エディタ概要</h2>
    <p>
      このエディタはTypora風のWYSIWYG（What You See Is What You Get）Markdownエディタです。
      Markdownの記法をそのまま入力すると、リアルタイムで書式が適用されます。
    </p>
    <p>
      画面上部には書式設定のためのツールバーが表示されます。
      ツールバーのボタンをクリックするか、キーボードショートカットで書式を適用できます。
    </p>
    ${imgTag(imgs.toolbarOverview, 'ツールバー概要', '書式ツールバー — よく使う書式ボタンが並んでいます')}
  </section>

  <!-- 2. 見出しの入力 -->
  <section id="headings">
    <h2>2. 見出しの入力</h2>
    <p>Markdownの見出し記法（<code>#</code>）を入力すると、自動的に見出しに変換されます。</p>

    <h3>H1 見出し（大見出し）</h3>
    <p>行頭に <code># </code>（半角シャープとスペース）を入力します。</p>
    <ol class="steps">
      <li>エディタをクリックしてカーソルを置きます</li>
      <li><code># </code> と入力します（シャープ記号の後にスペース）</li>
      <li>見出しのテキストを入力します</li>
    </ol>
    ${imgTag(imgs.h1, 'H1見出しの結果', 'H1 見出し — 最大の文字サイズで表示されます')}

    <h3>H2 見出し（中見出し）</h3>
    <p>行頭に <code>## </code> を入力します。</p>
    ${imgTag(imgs.h2, 'H2見出しの結果', 'H2 見出し')}

    <h3>H3 見出し（小見出し）</h3>
    <p>行頭に <code>### </code> を入力します。</p>
    ${imgTag(imgs.h3, 'H3見出しの結果', 'H3 見出し')}

    <h3>ブロックタイプドロップダウン</h3>
    <p>ツールバーのドロップダウンメニューから見出しレベルを選択することもできます。</p>
    ${imgTag(imgs.blockDropdown, 'ブロックタイプドロップダウン', 'ドロップダウンから見出しレベルを選択できます')}

    <h3>全見出しの確認</h3>
    ${imgTag(imgs.headingsOverview, '見出し一覧', 'H1〜H3の見出しが一覧で確認できます')}

    <div class="tip">
      <strong>ヒント:</strong> H1〜H6まで対応しています。<code>######</code>（シャープ6個）でH6になります。
    </div>
  </section>

  <!-- 3. 太字 -->
  <section id="bold">
    <h2>3. 太字</h2>
    <p>テキストを太字にするには2つの方法があります。</p>

    <h3>方法1: キーボードショートカット</h3>
    <ol class="steps">
      <li>太字にしたいテキストを選択します</li>
      <li><kbd>Ctrl</kbd> + <kbd>B</kbd> を押します</li>
    </ol>

    <h3>方法2: Markdown記法</h3>
    <p><code>**テキスト**</code>（アスタリスク2個で囲む）と入力すると自動変換されます。</p>

    ${imgTag(imgs.boldResult, '太字の結果', '太字テキスト — **text** の記法で自動変換されます')}
  </section>

  <!-- 4. テキスト書式設定 -->
  <section id="text-formatting">
    <h2>4. テキスト書式設定</h2>

    <h3>斜体（イタリック）</h3>
    <p>テキストを斜体にするには:</p>
    <ol class="steps">
      <li>斜体にしたいテキストを選択します</li>
      <li><kbd>Ctrl</kbd> + <kbd>I</kbd> を押すか、<code>*テキスト*</code> と入力します</li>
    </ol>
    ${imgTag(imgs.italic, '斜体の結果', '斜体テキスト (Ctrl+I または *text*)')}

    <h3>取り消し線</h3>
    <p>テキストに取り消し線を引くには <code>~~テキスト~~</code> と入力します。</p>
    ${imgTag(imgs.strikethrough, '取り消し線の結果', '取り消し線 (~~text~~)')}

    <h3>インラインコード</h3>
    <p>コードをインラインで表示するには バッククォート（<code>&#96;</code>）で囲みます。</p>
    <p>例: <code>&#96;const x = 42&#96;</code></p>
    ${imgTag(imgs.inlineCode, 'インラインコードの結果', 'インラインコード (`code`)')}

    <h3>書式設定の全体確認</h3>
    ${imgTag(imgs.formattingOverview, '書式設定概要', '各種書式が適用されたエディタの表示')}

    <div class="tip">
      <strong>ヒント:</strong> 複数の書式を組み合わせることもできます。例: <code>**_太字斜体_**</code>
    </div>
  </section>

  <!-- 5. リストの作成 -->
  <section id="lists">
    <h2>5. リストの作成</h2>

    <h3>箇条書きリスト</h3>
    <p>行頭に <code>- </code>（ハイフンとスペース）を入力すると箇条書きリストになります。</p>
    <ol class="steps">
      <li><code>- </code> と入力します</li>
      <li>項目のテキストを入力します</li>
      <li><kbd>Enter</kbd> で次の項目に進みます</li>
      <li>リストを終了するには <kbd>Enter</kbd> を2回押します</li>
    </ol>
    ${imgTag(imgs.bulletList, '箇条書きリスト', '箇条書きリスト (- で始まる行)')}

    <h3>番号付きリスト</h3>
    <p>行頭に <code>1. </code>（数字、ピリオド、スペース）を入力します。以降の番号は自動で付きます。</p>
    ${imgTag(imgs.orderedList, '番号付きリスト', '番号付きリスト (1. で始まる行)')}

    <h3>タスクリスト</h3>
    <p>チェックボックス付きのタスクリストを作成できます。</p>
    <ul style="list-style: disc; padding-left: 20px; margin-bottom: 12px;">
      <li><code>- [ ] </code>: 未完了のタスク</li>
      <li><code>- [x] </code>: 完了済みのタスク</li>
    </ul>
    ${imgTag(imgs.taskList, 'タスクリスト', 'タスクリスト — チェックボックスをクリックで完了/未完了を切り替えられます')}

    <h3>ツールバーのリストボタン</h3>
    <p>ツールバーのリストボタンからもリストを作成できます。</p>
    ${imgTag(imgs.listToolbar, 'リストボタン', 'ツールバーのリストボタン')}
  </section>

  <!-- 6. ソースモード切替 -->
  <section id="source-mode">
    <h2>6. ソースモード切替</h2>
    <p>
      WYSIWYGモードとソースモード（Markdown生テキスト編集モード）を切り替えることができます。
      ソースモードではMarkdownの生テキストを直接編集できます。
    </p>

    <h3>WYSIWYGモードで編集</h3>
    ${imgTag(imgs.wysiwygMode, 'WYSIWYGモード', 'WYSIWYGモード — 書式が適用された状態で表示')}

    <h3>ソースモードへの切替</h3>
    <p>ツールバーの「ソースモード」ボタンをクリックするか、<kbd>Ctrl</kbd> + <kbd>/</kbd> を押します。</p>
    ${imgTag(imgs.sourceButton, 'ソースモードボタン', 'ツールバーのソースモードボタン (Ctrl+/)')}

    <h3>ソースモードで編集</h3>
    <p>ソースモードではMarkdownの生テキストが表示され、直接編集できます。</p>
    ${imgTag(imgs.sourceModeActive, 'ソースモード', 'ソースモード — Markdownの生テキストが表示されます')}
    ${imgTag(imgs.sourceMarkdown, 'Markdownソース', 'Markdownソースコードの表示')}

    <h3>WYSIWYGモードに戻る</h3>
    <p>再度 <kbd>Ctrl</kbd> + <kbd>/</kbd> を押すか、ソースモードボタンをクリックします。</p>
    ${imgTag(imgs.backToWysiwyg, 'WYSIWYGモードに戻る', 'WYSIWYGモードに戻った状態')}

    <div class="tip">
      <strong>ヒント:</strong> 大きなファイルや複雑なMarkdown構造を直接編集したい場合にソースモードが便利です。
    </div>
  </section>

  <!-- 7. キーボードショートカット一覧 -->
  <section id="shortcuts">
    <h2>7. キーボードショートカット一覧</h2>
    <table class="shortcut-table">
      <thead>
        <tr>
          <th>操作</th>
          <th>ショートカット</th>
          <th>Markdown記法</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>太字</td>
          <td><kbd>Ctrl</kbd> + <kbd>B</kbd></td>
          <td><code>**text**</code></td>
        </tr>
        <tr>
          <td>斜体</td>
          <td><kbd>Ctrl</kbd> + <kbd>I</kbd></td>
          <td><code>*text*</code></td>
        </tr>
        <tr>
          <td>取り消し線</td>
          <td>—</td>
          <td><code>~~text~~</code></td>
        </tr>
        <tr>
          <td>インラインコード</td>
          <td>—</td>
          <td><code>&#96;code&#96;</code></td>
        </tr>
        <tr>
          <td>H1 見出し</td>
          <td>—</td>
          <td><code># </code>（行頭）</td>
        </tr>
        <tr>
          <td>H2 見出し</td>
          <td>—</td>
          <td><code>## </code>（行頭）</td>
        </tr>
        <tr>
          <td>H3 見出し</td>
          <td>—</td>
          <td><code>### </code>（行頭）</td>
        </tr>
        <tr>
          <td>箇条書きリスト</td>
          <td>—</td>
          <td><code>- </code>（行頭）</td>
        </tr>
        <tr>
          <td>番号付きリスト</td>
          <td>—</td>
          <td><code>1. </code>（行頭）</td>
        </tr>
        <tr>
          <td>タスクリスト</td>
          <td>—</td>
          <td><code>- [ ] </code>（行頭）</td>
        </tr>
        <tr>
          <td>ソースモード切替</td>
          <td><kbd>Ctrl</kbd> + <kbd>/</kbd></td>
          <td>—</td>
        </tr>
        <tr>
          <td>元に戻す</td>
          <td><kbd>Ctrl</kbd> + <kbd>Z</kbd></td>
          <td>—</td>
        </tr>
        <tr>
          <td>やり直し</td>
          <td><kbd>Ctrl</kbd> + <kbd>Y</kbd></td>
          <td>—</td>
        </tr>
        <tr>
          <td>全選択</td>
          <td><kbd>Ctrl</kbd> + <kbd>A</kbd></td>
          <td>—</td>
        </tr>
        <tr>
          <td>保存</td>
          <td><kbd>Ctrl</kbd> + <kbd>S</kbd></td>
          <td>—</td>
        </tr>
      </tbody>
    </table>
  </section>

</main>

<footer>
  <p>Typora-Inspired WYSIWYG Markdown Editor &mdash; ユーザーマニュアル &mdash; 自動生成</p>
</footer>

</body>
</html>`;

fs.writeFileSync(outputPath, html, 'utf8');
const stats = fs.statSync(outputPath);
console.log('Generated:', outputPath);
console.log('File size:', Math.round(stats.size / 1024), 'KB');
