#!/usr/bin/env node
// 活用事例ページ生成スクリプト
// スクリーンショット / GIF を base64 埋め込みして doc-public/use-cases.html を上書き生成する。
// 画像が存在しない場合はプレースホルダーテキストにフォールバックする。
//
// 使い方:
//   node docs/generate-use-cases.cjs
//
// スクリーンショット / GIF の配置先（capture スクリプトが出力するパス）:
//   docs/use-case-screenshots/s1-frontmatter/   … Scenario 1 の追加画像
//   docs/use-case-screenshots/s3-zen/           … Scenario 3 の追加画像
//   docs/use-case-screenshots/s4-workspace/     … Scenario 4 の追加画像
//
// デモ GIF（既存・LP でも使用）は doc-public/demo-gifs/ にある。
// このスクリプトは demo-gifs/ の GIF もすべて base64 に変換して埋め込む。
'use strict';

const fs   = require('fs');
const path = require('path');

const screenshotBase = path.join(__dirname, 'use-case-screenshots');
const demoGifBase    = path.join(__dirname, '..', 'doc-public', 'demo-gifs');
const outputPath     = path.join(__dirname, '..', 'doc-public', 'use-cases.html');

// ──────────────────────────────────────────────────────────
// ヘルパー: ファイルを base64 Data URI に変換
// ──────────────────────────────────────────────────────────
function toDataUri(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const ext  = path.extname(filePath).toLowerCase();
  const mime = ext === '.gif' ? 'image/gif'
             : ext === '.png' ? 'image/png'
             : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
             : 'image/png';
  const data = fs.readFileSync(filePath);
  return `data:${mime};base64,${data.toString('base64')}`;
}

// ──────────────────────────────────────────────────────────
// 画像読み込み
// ──────────────────────────────────────────────────────────
/** デモ GIF（demo-gifs/ 以下） */
function demoGif(name) {
  // .gif / .png どちらでも探す
  for (const ext of ['.gif', '.png']) {
    const p = path.join(demoGifBase, name + ext);
    const uri = toDataUri(p);
    if (uri) return uri;
  }
  return null;
}

/** ユースケーススクリーンショット（use-case-screenshots/{dir}/{file}） */
function ucImg(dir, name) {
  for (const ext of ['.gif', '.png', '.jpg']) {
    const p = path.join(screenshotBase, dir, name + ext);
    const uri = toDataUri(p);
    if (uri) return uri;
  }
  return null;
}

// ──────────────────────────────────────────────────────────
// <figure> HTML を生成するヘルパー
// ──────────────────────────────────────────────────────────
function fig(src, alt, captionKey) {
  if (src) {
    return `<figure>
          <img src="${src}" alt="${alt}" loading="lazy">
          <figcaption data-i18n="${captionKey}"></figcaption>
        </figure>`;
  }
  // プレースホルダー
  return `<div class="img-placeholder">
          <div class="placeholder-icon">🖼</div>
          <p>${alt}<br><small>npm run capture:use-cases で撮影後に再生成</small></p>
        </div>`;
}

// ──────────────────────────────────────────────────────────
// 画像を全部読み込む
// ──────────────────────────────────────────────────────────
const imgs = {
  // ─ Scenario 1 ─
  wysiwyg:      demoGif('wysiwyg-formatting'),
  frontMatter:  ucImg('s1-frontmatter', 'front-matter-edit'),
  // ─ Scenario 2 ─
  codeExport:   demoGif('code-block-export'),
  aiCopy:       demoGif('ai-copy'),
  // ─ Scenario 3 ─
  focusMode:    demoGif('focus-mode'),
  zenPomodoro:  ucImg('s3-zen', 'zen-pomodoro'),
  // ─ Scenario 4 ─
  workspace:    ucImg('s4-workspace', 'workspace-filetree'),
  extChange:    ucImg('s4-workspace', 'external-change'),
};

// ──────────────────────────────────────────────────────────
// HTML テンプレート
// ──────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>活用事例 — MarkWeave</title>
  <meta name="description" content="MarkWeave の実際の使い方。Zenn/Qiita 記事執筆・AI レビュー・集中執筆・既存ファイル管理など、シナリオ別ワークフローを紹介します。">
  <link rel="canonical" href="https://hayashixd.github.io/MarkWeave/use-cases.html">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0f172a; --bg-card: #1e293b; --border: #334155;
      --text: #f1f5f9; --text-muted: #94a3b8; --text-dim: #64748b;
      --accent: #818cf8; --accent-dark: #4f46e5; --success: #34d399;
    }
    html { scroll-behavior: smooth; }
    body {
      background: var(--bg); color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Yu Gothic UI', sans-serif;
      line-height: 1.7; font-size: 16px;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      font-family: 'Consolas', monospace;
      background: rgba(129,140,248,0.12); color: var(--accent);
      padding: 0.1em 0.4em; border-radius: 4px; font-size: 0.875em;
    }
    nav {
      position: sticky; top: 0; z-index: 100;
      background: rgba(15,23,42,0.92); backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border);
      padding: 0 1.5rem; height: 56px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .nav-logo { font-size: 1.05rem; font-weight: 700; letter-spacing: -0.02em; color: var(--text); text-decoration: none; }
    .nav-links { display: flex; gap: 1.25rem; align-items: center; list-style: none; }
    .nav-links a { color: var(--text-muted); text-decoration: none; font-size: 0.875rem; transition: color 0.15s; }
    .nav-links a:hover { color: var(--text); }
    .btn-nav {
      background: var(--accent); color: #0f172a !important;
      font-weight: 700; padding: 0.4rem 1.1rem; border-radius: 6px;
      font-size: 0.85rem !important; white-space: nowrap;
    }
    .btn-nav:hover { background: #a5b4fc !important; }
    .lang-btn {
      background: none; border: 1px solid var(--border); color: var(--text-muted);
      cursor: pointer; font-size: 0.78rem; font-family: inherit;
      padding: 0.28rem 0.65rem; border-radius: 5px; white-space: nowrap;
    }
    .lang-btn:hover { color: var(--text); border-color: var(--text-muted); }
    @media (max-width: 540px) { .hide-mobile { display: none; } }
    section { padding: 5rem 1.5rem; }
    .container { max-width: 880px; margin: 0 auto; }
    .section-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--accent); margin-bottom: 0.6rem; }
    #hero {
      padding: 5rem 1.5rem 4.5rem;
      background: radial-gradient(ellipse at 25% -15%, rgba(79,70,229,0.2) 0%, transparent 55%);
      border-bottom: 1px solid var(--border);
    }
    #hero .container { max-width: 680px; }
    #hero h1 { font-size: clamp(2rem,5vw,3rem); font-weight: 800; letter-spacing: -0.04em; line-height: 1.1; margin-bottom: 0.75rem; }
    #hero p { color: var(--text-muted); font-size: 1.05rem; margin-bottom: 2rem; line-height: 1.65; }
    .scenario-jumps { display: flex; flex-wrap: wrap; gap: 0.6rem; }
    .scenario-jump {
      display: inline-flex; align-items: center; gap: 0.4rem;
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text-muted); text-decoration: none;
      font-size: 0.82rem; padding: 0.4rem 0.9rem; border-radius: 6px;
      transition: border-color 0.15s, color 0.15s;
    }
    .scenario-jump:hover { border-color: var(--accent); color: var(--accent); text-decoration: none; }
    .scenario-num { font-size: 0.7rem; font-weight: 700; color: var(--accent); }
    .scenario { padding: 5rem 1.5rem; border-bottom: 1px solid var(--border); }
    .scenario:nth-child(even) { background: var(--bg-card); }
    .scenario-inner {
      max-width: 880px; margin: 0 auto;
      display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center;
    }
    .scenario-inner.reverse .scenario-media { order: -1; }
    @media (max-width: 700px) {
      .scenario-inner { grid-template-columns: 1fr; gap: 2.5rem; }
      .scenario-inner.reverse .scenario-media { order: 0; }
    }
    .scenario-num-badge { display: inline-block; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--accent); margin-bottom: 0.5rem; }
    .scenario-text h2 { font-size: 1.35rem; font-weight: 700; letter-spacing: -0.03em; line-height: 1.35; margin-bottom: 0.85rem; }
    .before-card { background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem; font-size: 0.875rem; color: var(--text-muted); }
    .before-card .label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #fca5a5; margin-bottom: 0.3rem; }
    .after-card { background: rgba(52,211,153,0.06); border: 1px solid rgba(52,211,153,0.2); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.25rem; font-size: 0.875rem; color: var(--text-muted); }
    .after-card .label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--success); margin-bottom: 0.3rem; }
    .workflow { list-style: none; padding: 0; counter-reset: step; margin-bottom: 1.25rem; }
    .workflow li { counter-increment: step; display: flex; gap: 0.75rem; margin-bottom: 0.65rem; align-items: flex-start; font-size: 0.875rem; color: var(--text-muted); }
    .workflow li::before {
      content: counter(step);
      background: rgba(129,140,248,0.15); color: var(--accent);
      border: 1px solid rgba(129,140,248,0.3); border-radius: 50%;
      min-width: 22px; height: 22px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.72rem; margin-top: 2px;
    }
    .feature-pills { display: flex; flex-wrap: wrap; gap: 0.45rem; }
    .pill { font-size: 0.72rem; background: rgba(129,140,248,0.1); color: var(--accent); border: 1px solid rgba(129,140,248,0.25); padding: 0.2rem 0.65rem; border-radius: 20px; white-space: nowrap; }
    .scenario-media figure { border-radius: 12px; overflow: hidden; border: 1px solid var(--border); box-shadow: 0 16px 48px rgba(0,0,0,0.35); }
    .scenario-media img { display: block; width: 100%; }
    .scenario-media figcaption { background: var(--bg-card); color: var(--text-dim); font-size: 0.78rem; padding: 0.5rem 0.85rem; border-top: 1px solid var(--border); }
    .media-stack { display: flex; flex-direction: column; gap: 1rem; }
    .media-stack figure { border-radius: 10px; overflow: hidden; border: 1px solid var(--border); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
    .img-placeholder { background: var(--bg-card); border: 1px dashed var(--border); border-radius: 10px; padding: 2.5rem 1.5rem; text-align: center; color: var(--text-dim); font-size: 0.82rem; }
    .img-placeholder .placeholder-icon { font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.4; }
    .img-placeholder p { color: var(--text-dim); font-size: 0.82rem; margin: 0; }
    #cta { padding: 6rem 1.5rem; text-align: center; background: linear-gradient(135deg, rgba(79,70,229,0.15) 0%, rgba(129,140,248,0.05) 100%); border-top: 1px solid rgba(129,140,248,0.2); }
    #cta h2 { font-size: clamp(1.5rem,3vw,2.25rem); font-weight: 800; letter-spacing: -0.04em; margin-bottom: 0.75rem; }
    #cta .sub { color: var(--text-muted); margin-bottom: 2rem; font-size: 0.95rem; }
    .btn-group { display: flex; gap: 0.875rem; flex-wrap: wrap; justify-content: center; }
    .btn-primary { display: inline-block; background: var(--accent); color: #0f172a; font-weight: 700; padding: 0.85rem 2rem; border-radius: 8px; text-decoration: none; font-size: 1rem; transition: background 0.15s; }
    .btn-primary:hover { background: #a5b4fc; }
    .btn-secondary { display: inline-block; color: var(--text-muted); border: 1px solid var(--border); padding: 0.85rem 2rem; border-radius: 8px; text-decoration: none; font-size: 1rem; transition: border-color 0.15s, color 0.15s; }
    .btn-secondary:hover { border-color: var(--text-muted); color: var(--text); }
    .cta-meta { margin-top: 1rem; font-size: 0.78rem; color: var(--text-dim); }
    footer { border-top: 1px solid var(--border); padding: 1.75rem 1.5rem; text-align: center; }
    .footer-links { display: flex; justify-content: center; flex-wrap: wrap; margin-bottom: 0.75rem; }
    .footer-links a { color: var(--text-muted); text-decoration: none; font-size: 0.83rem; padding: 0.25rem 0.75rem; transition: color 0.15s; }
    .footer-links a:hover { color: var(--text); }
    .footer-copy { font-size: 0.75rem; color: var(--text-dim); }
  </style>
</head>
<body>

<nav>
  <a href="index.html" class="nav-logo">MarkWeave</a>
  <ul class="nav-links">
    <li class="hide-mobile"><a href="index.html#solutions" data-i18n="nav.features">機能</a></li>
    <li class="hide-mobile"><a href="index.html#pricing" data-i18n="nav.pricing">価格</a></li>
    <li class="hide-mobile"><a href="manuals/user-manual.html" data-i18n="nav.manual">マニュアル</a></li>
    <li><a href="https://github.com/hayashixd/MarkWeave/releases/latest" class="btn-nav" data-i18n="nav.download">無料で試す</a></li>
    <li><button id="lang-toggle" class="lang-btn" onclick="toggleLang()">EN</button></li>
  </ul>
</nav>

<section id="hero">
  <div class="container">
    <p class="section-label" data-i18n="hero.label">Use Cases</p>
    <h1 data-i18n="hero.h1">実際の使い方</h1>
    <p data-i18n="hero.desc">「自分のワークフローに合うか？」を確認するためのシナリオ別ガイド。MarkWeave がどんな場面で、どう役立つかを具体的な手順で紹介します。</p>
    <div class="scenario-jumps">
      <a href="#scenario-1" class="scenario-jump"><span class="scenario-num">01</span> <span data-i18n="hero.jump1">Zenn / Qiita 記事執筆</span></a>
      <a href="#scenario-2" class="scenario-jump"><span class="scenario-num">02</span> <span data-i18n="hero.jump2">コードスニペット + AI レビュー</span></a>
      <a href="#scenario-3" class="scenario-jump"><span class="scenario-num">03</span> <span data-i18n="hero.jump3">集中して長文を書く</span></a>
      <a href="#scenario-4" class="scenario-jump"><span class="scenario-num">04</span> <span data-i18n="hero.jump4">既存 .md ファイルを引き継ぐ</span></a>
    </div>
  </div>
</section>

<!-- ── Scenario 1 ── -->
<div class="scenario" id="scenario-1">
  <div class="scenario-inner">
    <div class="scenario-text">
      <p class="scenario-num-badge" data-i18n="s1.badge">Scenario 01 — Zenn / Qiita</p>
      <h2 data-i18n="s1.h2">Zenn / Qiita に週1本記事を書く</h2>
      <div class="before-card"><p class="label">Before</p><p data-i18n="s1.before"></p></div>
      <div class="after-card"><p class="label">After</p><p data-i18n="s1.after"></p></div>
      <ol class="workflow">
        <li data-i18n="s1.step1"></li>
        <li data-i18n="s1.step2"></li>
        <li data-i18n="s1.step3"></li>
        <li data-i18n="s1.step4"></li>
        <li data-i18n="s1.step5"></li>
      </ol>
      <div class="feature-pills">
        <span class="pill" data-i18n="s1.pill1"></span>
        <span class="pill" data-i18n="s1.pill2"></span>
        <span class="pill" data-i18n="s1.pill3"></span>
        <span class="pill" data-i18n="s1.pill4"></span>
      </div>
    </div>
    <div class="scenario-media">
      <div class="media-stack">
        ${fig(imgs.wysiwyg,     'WYSIWYG 編集デモ',          's1.cap1')}
        ${fig(imgs.frontMatter, 'YAML Front Matter GUI編集', 's1.cap2')}
      </div>
    </div>
  </div>
</div>

<!-- ── Scenario 2 ── -->
<div class="scenario" id="scenario-2">
  <div class="scenario-inner reverse">
    <div class="scenario-text">
      <p class="scenario-num-badge" data-i18n="s2.badge">Scenario 02 — AI Copy</p>
      <h2 data-i18n="s2.h2">コードスニペット入り記事を AI にレビューしてもらう</h2>
      <div class="before-card"><p class="label">Before</p><p data-i18n="s2.before"></p></div>
      <div class="after-card"><p class="label">After</p><p data-i18n="s2.after"></p></div>
      <ol class="workflow">
        <li data-i18n="s2.step1"></li>
        <li data-i18n="s2.step2"></li>
        <li data-i18n="s2.step3"></li>
        <li data-i18n="s2.step4"></li>
        <li data-i18n="s2.step5"></li>
      </ol>
      <div class="feature-pills">
        <span class="pill" data-i18n="s2.pill1"></span>
        <span class="pill" data-i18n="s2.pill2"></span>
        <span class="pill" data-i18n="s2.pill3"></span>
        <span class="pill" data-i18n="s2.pill4"></span>
      </div>
    </div>
    <div class="scenario-media">
      <div class="media-stack">
        ${fig(imgs.codeExport, 'コードブロック HTML 書き出しデモ', 's2.cap1')}
        ${fig(imgs.aiCopy,     'AI コピーデモ',                    's2.cap2')}
      </div>
    </div>
  </div>
</div>

<!-- ── Scenario 3 ── -->
<div class="scenario" id="scenario-3">
  <div class="scenario-inner">
    <div class="scenario-text">
      <p class="scenario-num-badge" data-i18n="s3.badge">Scenario 03 — Focus Writing</p>
      <h2 data-i18n="s3.h2">集中して長文を書く</h2>
      <div class="before-card"><p class="label">Before</p><p data-i18n="s3.before"></p></div>
      <div class="after-card"><p class="label">After</p><p data-i18n="s3.after"></p></div>
      <ol class="workflow">
        <li data-i18n="s3.step1"></li>
        <li data-i18n="s3.step2"></li>
        <li data-i18n="s3.step3"></li>
        <li data-i18n="s3.step4"></li>
        <li data-i18n="s3.step5"></li>
      </ol>
      <div class="feature-pills">
        <span class="pill" data-i18n="s3.pill1"></span>
        <span class="pill" data-i18n="s3.pill2"></span>
        <span class="pill" data-i18n="s3.pill3"></span>
        <span class="pill" data-i18n="s3.pill4"></span>
        <span class="pill" data-i18n="s3.pill5"></span>
      </div>
    </div>
    <div class="scenario-media">
      <div class="media-stack">
        ${fig(imgs.focusMode,  'フォーカスモードデモ',         's3.cap1')}
        ${fig(imgs.zenPomodoro,'Zen モード + ポモドーロ',      's3.cap2')}
      </div>
    </div>
  </div>
</div>

<!-- ── Scenario 4 ── -->
<div class="scenario" id="scenario-4">
  <div class="scenario-inner reverse">
    <div class="scenario-text">
      <p class="scenario-num-badge" data-i18n="s4.badge">Scenario 04 — Workspace</p>
      <h2 data-i18n="s4.h2">既存の .md ファイルを引き継いで管理する</h2>
      <div class="before-card"><p class="label">Before</p><p data-i18n="s4.before"></p></div>
      <div class="after-card"><p class="label">After</p><p data-i18n="s4.after"></p></div>
      <ol class="workflow">
        <li data-i18n="s4.step1"></li>
        <li data-i18n="s4.step2"></li>
        <li data-i18n="s4.step3"></li>
        <li data-i18n="s4.step4"></li>
        <li data-i18n="s4.step5"></li>
      </ol>
      <div class="feature-pills">
        <span class="pill" data-i18n="s4.pill1"></span>
        <span class="pill" data-i18n="s4.pill2"></span>
        <span class="pill" data-i18n="s4.pill3"></span>
        <span class="pill" data-i18n="s4.pill4"></span>
        <span class="pill" data-i18n="s4.pill5"></span>
      </div>
    </div>
    <div class="scenario-media">
      <div class="media-stack">
        ${fig(imgs.workspace,  'ワークスペース ファイルツリー',   's4.cap1')}
        ${fig(imgs.extChange,  '外部変更検知ダイアログ',          's4.cap2')}
      </div>
    </div>
  </div>
</div>

<section id="cta">
  <div class="container">
    <h2 data-i18n="cta.h2">まず 30 日間、無料で試してみよう。</h2>
    <p class="sub" data-i18n="cta.sub">インストール後すぐに全機能が使えます。サインアップ不要。</p>
    <div class="btn-group">
      <a href="https://github.com/hayashixd/MarkWeave/releases/latest" class="btn-primary" data-i18n="cta.download">無料でダウンロード（30日間）</a>
      <a href="manuals/user-manual.html" class="btn-secondary" data-i18n="cta.manual">マニュアルを読む</a>
    </div>
    <p class="cta-meta" data-i18n="cta.meta">⚡ 買い切り $24.99 · サブスクなし · Windows / Linux 対応</p>
  </div>
</section>

<footer>
  <div class="footer-links">
    <a href="index.html">Home</a>
    <a href="https://github.com/hayashixd/MarkWeave">GitHub</a>
    <a href="manuals/user-manual.html" data-i18n="footer.manual">マニュアル</a>
    <a href="https://xdhyskh.gumroad.com/l/qwctrq" data-i18n="footer.buy">購入する</a>
  </div>
  <p class="footer-copy">© 2024–2026 MarkWeave · MIT License</p>
</footer>

<script>
  const translations = {
    ja: {
      'page.title': '活用事例 — MarkWeave',
      'nav.features': '機能', 'nav.pricing': '価格', 'nav.manual': 'マニュアル', 'nav.download': '無料で試す',
      'hero.label': 'Use Cases', 'hero.h1': '実際の使い方',
      'hero.desc': '「自分のワークフローに合うか？」を確認するためのシナリオ別ガイド。MarkWeave がどんな場面で、どう役立つかを具体的な手順で紹介します。',
      'hero.jump1': 'Zenn / Qiita 記事執筆', 'hero.jump2': 'コードスニペット + AI レビュー',
      'hero.jump3': '集中して長文を書く', 'hero.jump4': '既存 .md ファイルを引き継ぐ',
      's1.badge': 'Scenario 01 — Zenn / Qiita', 's1.h2': 'Zenn / Qiita に週1本記事を書く',
      's1.before': 'VS Code のプレビューとエディタを行き来するたびに書くリズムが崩れる。Markdown の記法が邪魔に感じる。',
      's1.after': '1ウィンドウで書きながらレンダリング確認。コードブロックも数式も即座に表示。YAML メタデータの GUI 編集で Front Matter を記法なしで管理。',
      's1.step1': 'Ctrl+N で新規ファイルを作成',
      's1.step2': '先頭の --- ブロックでタイトル・タグ・emoji を GUI 入力',
      's1.step3': '# で見出し、- でリスト。記法を入力すると即レンダリング',
      's1.step4': '「ファイル → エクスポート → Markdown」でZenn/Qiita向けに最適化して書き出し',
      's1.step5': '書き出した .md を Zenn / Qiita のエディタにそのまま貼り付けて公開',
      's1.pill1': 'WYSIWYG 編集', 's1.pill2': 'YAML Front Matter GUI', 's1.pill3': 'Markdown エクスポート', 's1.pill4': 'コードブロック',
      's1.cap1': '記法を入力した瞬間にレンダリングされる', 's1.cap2': 'Front Matter を記法なしで GUI 編集',
      's2.badge': 'Scenario 02 — AI Copy', 's2.h2': 'コードスニペット入り記事を AI にレビューしてもらう',
      's2.before': 'Claude / ChatGPT に記事を貼るたびに手作業で整形。見出しのレベルがズレたり、コードブロックの言語タグが抜けていたり。',
      's2.after': '「AI コピー」ボタン1クリックで見出し補正・言語タグ付け・余分な空行削除を自動処理。クリップボードをそのまま貼り付けるだけ。',
      's2.step1': 'コードブロックに言語名を指定して記事を書く（シンタックスハイライトがリアルタイムで確認できる）',
      's2.step2': '記事を書き終えたらツールバーの「AI コピー」ボタンをクリック',
      's2.step3': '整形済みのMarkdownがクリップボードにコピーされる',
      's2.step4': 'Claude / ChatGPT に貼り付けてレビューや改善を依頼',
      's2.step5': 'フィードバックを受けてエディタに戻り修正 → 再度エクスポート',
      's2.pill1': 'AI コピー', 's2.pill2': 'コードブロック（40+ 言語）', 's2.pill3': 'シンタックスハイライト', 's2.pill4': 'HTML エクスポート',
      's2.cap1': 'シンタックスハイライト付きでそのまま HTML 出力', 's2.cap2': '1クリックでAI入力向けに自動整形してコピー',
      's3.badge': 'Scenario 03 — Focus Writing', 's3.h2': '集中して長文を書く',
      's3.before': 'ツールバーやサイドバーが気になって集中できない。30分書いてどこまで進んだかわからなくなる。',
      's3.after': 'Zen モードでUIを完全非表示、タイプライターモードで視点を画面中央に固定。ポモドーロで25分ごとに区切り、文字数・読了時間をリアルタイムで把握。',
      's3.step1': '「表示 → Zen モード」（F11）でサイドバー・ツールバーを非表示に',
      's3.step2': '「表示 → タイプライターモード」でカーソル行を画面中央に固定',
      's3.step3': '「ツール → ポモドーロ」で25分タイマーをスタート',
      's3.step4': '集中して書く。ステータスバーの文字数・読了時間が進捗の目安に',
      's3.step5': '25分経ったら休憩。ワードスプリントで目標文字数チャレンジも可能',
      's3.pill1': 'Zen モード', 's3.pill2': 'フォーカスモード', 's3.pill3': 'タイプライターモード', 's3.pill4': 'ポモドーロタイマー', 's3.pill5': '文書統計',
      's3.cap1': 'フォーカスモード・タイプライターモードで書くことだけに集中', 's3.cap2': 'Zen モード + ポモドーロタイマー',
      's4.badge': 'Scenario 04 — Workspace', 's4.h2': '既存の .md ファイルを引き継いで管理する',
      's4.before': 'クラウドエディタに取り込むとフォーマットが崩れる。Dropbox で管理しているファイルが勝手に上書きされることがある。',
      's4.after': '既存の .md ファイルをそのまま開いてWYSIWYGで編集。フォルダをワークスペースとして開けば記事一覧をサイドバーで管理。外部変更は自動上書きせずに通知。',
      's4.step1': '「ファイル → フォルダを開く」で記事フォルダをワークスペースとして開く',
      's4.step2': 'サイドバーのファイルツリーから編集したい記事をクリック',
      's4.step3': '既存の Markdown がそのまま WYSIWYG で表示される',
      's4.step4': 'Ctrl+P（クイックオープン）でフォルダ内を検索して素早く開く',
      's4.step5': 'Dropbox / OneDrive で同期中のファイルが外部変更された場合は通知が届き、上書きするかを選択できる',
      's4.pill1': 'ワークスペース', 's4.pill2': 'ファイルツリー', 's4.pill3': 'クイックオープン', 's4.pill4': '外部変更検知', 's4.pill5': 'ローカルファースト',
      's4.cap1': 'フォルダをワークスペースとして開いてファイルツリー管理', 's4.cap2': '外部変更を検知。自動上書きせず選択肢を提示',
      'cta.h2': 'まず 30 日間、無料で試してみよう。', 'cta.sub': 'インストール後すぐに全機能が使えます。サインアップ不要。',
      'cta.download': '無料でダウンロード（30日間）', 'cta.manual': 'マニュアルを読む',
      'cta.meta': '⚡ 買い切り $24.99 · サブスクなし · Windows / Linux 対応',
      'footer.manual': 'マニュアル', 'footer.buy': '購入する',
    },
    en: {
      'page.title': 'Use Cases — MarkWeave',
      'nav.features': 'Features', 'nav.pricing': 'Pricing', 'nav.manual': 'Manual', 'nav.download': 'Try Free',
      'hero.label': 'Use Cases', 'hero.h1': 'How People Use MarkWeave',
      'hero.desc': 'Wondering if it fits your workflow? Here are four concrete scenarios showing how MarkWeave helps — with step-by-step walkthroughs.',
      'hero.jump1': 'Zenn / Qiita articles', 'hero.jump2': 'Code snippets + AI review',
      'hero.jump3': 'Long-form focus writing', 'hero.jump4': 'Inheriting existing .md files',
      's1.badge': 'Scenario 01 — Zenn / Qiita', 's1.h2': 'Writing a weekly article for Zenn or Qiita',
      's1.before': "Constantly switching between VS Code's editor and preview breaks the writing flow. Markdown syntax feels like noise.",
      's1.after': 'Write and see rendered output in one window. Code blocks, math, and diagrams render instantly inline. Manage YAML Front Matter without touching syntax.',
      's1.step1': 'Create a new file with Ctrl+N',
      's1.step2': 'Fill in title, tags, and emoji via the GUI Front Matter panel at the top',
      's1.step3': 'Type # for headings, - for lists — syntax renders as you type',
      's1.step4': 'Export via File → Export → Markdown, optimized for Zenn / Qiita',
      's1.step5': 'Paste the exported .md directly into Zenn or Qiita and publish',
      's1.pill1': 'WYSIWYG editing', 's1.pill2': 'YAML Front Matter GUI', 's1.pill3': 'Markdown export', 's1.pill4': 'Code blocks',
      's1.cap1': 'Syntax renders the instant you type it', 's1.cap2': 'Edit Front Matter via GUI — no syntax needed',
      's2.badge': 'Scenario 02 — AI Copy', 's2.h2': 'Getting AI to review a code-heavy article',
      's2.before': 'Every time you paste an article into Claude or ChatGPT, you have to manually fix broken heading levels and missing language tags on code blocks.',
      's2.after': 'One click on [AI Copy] auto-fixes heading levels, adds language tags to code blocks, and strips extra blank lines — then copies to clipboard. Just paste.',
      's2.step1': 'Write your article with language-tagged code blocks (syntax highlighting shows live)',
      's2.step2': 'When done, click the [AI Copy] button in the toolbar',
      's2.step3': 'Formatted Markdown is copied to your clipboard',
      's2.step4': 'Paste directly into Claude or ChatGPT and ask for review or improvements',
      's2.step5': 'Apply feedback in the editor, then re-export',
      's2.pill1': 'AI Copy', 's2.pill2': 'Code blocks (40+ languages)', 's2.pill3': 'Syntax highlighting', 's2.pill4': 'HTML export',
      's2.cap1': 'Export articles with syntax highlighting to standalone HTML', 's2.cap2': 'One click auto-formats for AI input and copies to clipboard',
      's3.badge': 'Scenario 03 — Focus Writing', 's3.h2': 'Writing long-form content without distractions',
      's3.before': 'Toolbars and sidebars break concentration. After 30 minutes of writing you lose track of progress.',
      's3.after': 'Zen mode hides all UI. Typewriter mode locks the cursor to screen center. Pomodoro breaks writing into 25-minute sessions. Live word count tracks progress.',
      's3.step1': 'Open View → Zen Mode (F11) to hide sidebars and toolbars',
      's3.step2': 'Open View → Typewriter Mode to keep the cursor centered on screen',
      's3.step3': 'Start a 25-minute timer with Tools → Pomodoro',
      's3.step4': "Write. Use the status bar's word count and reading time as progress markers",
      's3.step5': 'Take a 5-minute break. Use Word Sprint for a timed word-count challenge',
      's3.pill1': 'Zen mode', 's3.pill2': 'Focus mode', 's3.pill3': 'Typewriter mode', 's3.pill4': 'Pomodoro timer', 's3.pill5': 'Document stats',
      's3.cap1': 'Focus and Typewriter modes eliminate distractions', 's3.cap2': 'Zen mode + Pomodoro timer',
      's4.badge': 'Scenario 04 — Workspace', 's4.h2': 'Taking over existing .md files and managing them',
      's4.before': 'Cloud editors mangle formatting when you import existing .md files. Files synced with Dropbox occasionally get silently overwritten.',
      's4.after': 'Open any .md file directly and edit in WYSIWYG mode. Open a folder as a workspace and browse all articles in the sidebar. External changes trigger a notification — no silent overwrites.',
      's4.step1': 'Open File → Open Folder to load your articles folder as a workspace',
      's4.step2': 'Click the article you want to edit from the sidebar file tree',
      's4.step3': 'Your existing Markdown opens and renders in WYSIWYG immediately',
      's4.step4': 'Use Ctrl+P (Quick Open) to search and jump to any file in the folder',
      's4.step5': 'If Dropbox or OneDrive modifies the file externally, a notification appears — choose whether to keep your edits or reload from disk',
      's4.pill1': 'Workspace', 's4.pill2': 'File tree', 's4.pill3': 'Quick open', 's4.pill4': 'External change detection', 's4.pill5': 'Local-first',
      's4.cap1': 'Open a folder as a workspace and browse files in the sidebar', 's4.cap2': 'External changes trigger a notification — no silent overwrites',
      'cta.h2': 'Try it free for 30 days.', 'cta.sub': 'Full access immediately after install. No sign-up needed.',
      'cta.download': 'Download Free (30 days)', 'cta.manual': 'Read the Manual',
      'cta.meta': '⚡ One-time $24.99 · No subscription · Windows / Linux',
      'footer.manual': 'Manual', 'footer.buy': 'Buy',
    }
  };
  function detectInitialLang() {
    const saved = localStorage.getItem('mw-lang');
    if (saved === 'ja' || saved === 'en') return saved;
    return navigator.language && navigator.language.startsWith('ja') ? 'ja' : 'en';
  }
  function applyLang(lang) {
    const t = translations[lang];
    document.documentElement.lang = lang;
    document.title = t['page.title'];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (t[key] !== undefined) el.textContent = t[key];
    });
    const btn = document.getElementById('lang-toggle');
    if (btn) btn.textContent = lang === 'ja' ? 'EN' : '日本語';
    localStorage.setItem('mw-lang', lang);
  }
  function toggleLang() {
    const current = localStorage.getItem('mw-lang') || detectInitialLang();
    applyLang(current === 'ja' ? 'en' : 'ja');
  }
  applyLang(detectInitialLang());
</script>
</body>
</html>`;

// 出力
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(outputPath, html, 'utf8');
const stats = fs.statSync(outputPath);

const missing = Object.entries(imgs).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.log('⚠ 未撮影のスクリーンショット（プレースホルダー表示）:', missing.join(', '));
  console.log('  → npm run capture:use-cases を実行して撮影後に再生成してください');
}
console.log('Generated:', outputPath);
console.log('File size:', Math.round(stats.size / 1024), 'KB');
