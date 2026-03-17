/**
 * DemoApp — MarkWeave デモページ全体
 *
 * LP (doc-public/index.html) と同じビジュアル言語を使用。
 * - JA/EN 切り替え: localStorage('mw-lang') を LP と共有
 * - テーマ切り替え: localStorage('mw-demo-theme')
 */
import { useState, useEffect, useCallback } from 'react';
import { DemoEditor } from './DemoEditor';

// ── i18n ─────────────────────────────────────────────────────

type Lang = 'ja' | 'en';

const translations: Record<Lang, Record<string, string>> = {
  ja: {
    'page.title': 'MarkWeave — インタラクティブデモ | WYSIWYG Markdown エディタ',
    'nav.features': '機能',
    'nav.pricing': '価格',
    'nav.usecases': '活用事例',
    'nav.manual': 'マニュアル',
    'nav.demo': 'デモ',
    'nav.buy': '購入する — $24.99',
    'hero.badge': 'ブラウザで試せる インタラクティブデモ',
    'hero.h1': '実際に触って確かめよう',
    'hero.sub': '行頭で / を入力するとコマンドメニューが開きます。コードブロック・テーブル・リストもその場でレンダリングされます。インストール不要。',
    'toolbar.export': 'HTML エクスポート',
    'toolbar.lockedTitle': 'デスクトップ版で利用できます',
    'toolbar.lockedLink': 'ダウンロード版で利用可能',
    'hint.slash': 'コマンドメニュー',
    'hint.heading': '見出しに変換',
    'hint.bold': '太字',
    'hint.list': '箇条書きリスト',
    'features.label': 'Features',
    'features.h2': 'デモでは触れない機能も確認しよう',
    'features.desc': 'デスクトップ版ではエクスポート・ファイル管理・AI・Zen モードなどのフル機能が利用できます。',
    'gif1.title': 'WYSIWYG リアルタイム変換',
    'gif1.desc': '# を入力した瞬間に見出しに変わる。Markdown を知っている人が「記法を見なくて済む」書き心地。',
    'gif2.title': 'シンタックスハイライト付きエクスポート',
    'gif2.desc': 'コードブロックを含む記事をスタンドアロン HTML として出力。画像は Base64 埋め込みでリンク切れゼロ。',
    'gif3.title': 'フォーカスモード / Zen モード',
    'gif3.desc': 'フォーカスモード・タイプライターモード・Zen モードで、ツールの存在を消して書くことだけに集中。',
    'slash.badge': 'このデモで体験',
    'slash.title': 'スラッシュコマンド',
    'slash.desc': '行頭で / を入力するとコマンドメニューが開きます。見出し・リスト・コードブロック・テーブルをキーボードだけで素早く挿入できます。',
    'slash.cta': '↑ 上のエディタで試してみよう',
    'prose.badge': 'デスクトップ版',
    'prose.title': 'Prose Lint（文章スタイル検査）',
    'prose.desc': '冗長な表現・ですます/だ混在・100 文字超の長文を AI 不要でローカル検出。修正候補をその場で提示。Claude API キー不要。',
    'cta.h2': 'まず無料で試して、気に入ったら購入しよう。',
    'cta.sub': 'デスクトップ版ではフル機能が使えます',
    'cta.note': 'エクスポート（HTML/PDF/Word）・ファイル管理・AI コピー・Zen モード・ポモドーロ・Prose Lint など',
    'cta.download': '無料でダウンロード（30日間）',
    'cta.buy': '購入する — $24.99',
    'cta.meta.onetime': '⚡ 買い切り',
    'cta.meta.nosub': '🚫 サブスクなし',
    'cta.meta.devices': '💻 3デバイスまで',
    'cta.meta.local': '🗂 データはローカルに',
    'footer.dev': '開発記事（Zenn）',
    'footer.usecases': '活用事例',
    'footer.manual': 'マニュアル',
    'footer.buy': '購入する',
  },
  en: {
    'page.title': 'MarkWeave — Interactive Demo | WYSIWYG Markdown Editor',
    'nav.features': 'Features',
    'nav.pricing': 'Pricing',
    'nav.usecases': 'Use Cases',
    'nav.manual': 'Manual',
    'nav.demo': 'Demo',
    'nav.buy': 'Try Free',
    'hero.badge': 'Interactive browser demo — no install needed',
    'hero.h1': 'Try it yourself',
    'hero.sub': 'Type / at the start of a line to open the command menu. Code blocks, tables, and lists render inline. No install required.',
    'toolbar.export': 'HTML Export',
    'toolbar.lockedTitle': 'Available in the desktop app',
    'toolbar.lockedLink': 'Available in download',
    'hint.slash': 'command menu',
    'hint.heading': 'becomes a heading',
    'hint.bold': 'bold',
    'hint.list': 'bullet list',
    'features.label': 'Features',
    'features.h2': 'See what the desktop app adds',
    'features.desc': 'The desktop version unlocks export, file management, AI, Zen mode, and more.',
    'gif1.title': 'Real-time WYSIWYG',
    'gif1.desc': 'Type # and it instantly becomes a heading. Write Markdown without seeing the syntax.',
    'gif2.title': 'Export with Syntax Highlighting',
    'gif2.desc': 'Export articles with code blocks as standalone HTML. Images embedded as Base64 — no broken links.',
    'gif3.title': 'Focus Mode / Zen Mode',
    'gif3.desc': 'Focus mode, Typewriter mode, and Zen mode make the app disappear so you can write without distraction.',
    'slash.badge': 'Try in this demo',
    'slash.title': 'Slash Commands',
    'slash.desc': 'Type / at the start of a line to open the command menu. Headings, lists, code blocks, and tables — all inserted by keyboard.',
    'slash.cta': '↑ Try it in the editor above',
    'prose.badge': 'Desktop version',
    'prose.title': 'Prose Lint',
    'prose.desc': 'Auto-detects wordy phrases, mixed writing styles, and sentences over 100 characters. No AI required — runs entirely offline.',
    'cta.h2': 'Try it free. Buy if you love it.',
    'cta.sub': 'The desktop version gives you the full feature set',
    'cta.note': 'Export (HTML/PDF/Word) · File management · AI Copy · Zen Mode · Pomodoro · Prose Lint, and more',
    'cta.download': 'Download Free (30 days)',
    'cta.buy': 'Buy — $24.99',
    'cta.meta.onetime': '⚡ One-time',
    'cta.meta.nosub': '🚫 No subscription',
    'cta.meta.devices': '💻 Up to 3 devices',
    'cta.meta.local': '🗂 Data stays local',
    'footer.dev': 'Dev article (Zenn)',
    'footer.usecases': 'Use Cases',
    'footer.manual': 'Manual',
    'footer.buy': 'Buy',
  },
};

// GIF・LP へのパス（/MarkWeave/demo/ からの相対）
const GIF_BASE = '../demo-gifs';
const LP_BASE = '..';

const DOWNLOAD_URL = 'https://github.com/hayashixd/MarkWeave/releases/latest';
const BUY_URL = 'https://xdhyskh.gumroad.com/l/qwctrq';

// ── コンポーネント ────────────────────────────────────────────

export default function DemoApp() {
  const [lang, setLang] = useState<Lang>('ja');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // 初期化: localStorage から言語とテーマを読み込む
  useEffect(() => {
    const savedLang = localStorage.getItem('mw-lang');
    if (savedLang === 'ja' || savedLang === 'en') setLang(savedLang);
    else if (!navigator.language.startsWith('ja')) setLang('en');

    const savedTheme = localStorage.getItem('mw-demo-theme');
    if (savedTheme === 'light') setTheme('light');
  }, []);

  // テーマを document.documentElement に適用
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mw-demo-theme', theme);
  }, [theme]);

  // ページタイトル更新
  useEffect(() => {
    document.title = t('page.title');
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((key: string) => translations[lang][key] ?? key, [lang]);

  const toggleLang = () => {
    const next: Lang = lang === 'ja' ? 'en' : 'ja';
    setLang(next);
    localStorage.setItem('mw-lang', next);
  };

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <>
      {/* ── Nav ── */}
      <nav className="demo-nav">
        <a href={`${LP_BASE}/`} className="nav-logo">MarkWeave</a>
        <ul className="nav-links">
          <li className="hide-mobile"><a href={`${LP_BASE}/#solutions`}>{t('nav.features')}</a></li>
          <li className="hide-mobile"><a href={`${LP_BASE}/#pricing`}>{t('nav.pricing')}</a></li>
          <li className="hide-mobile"><a href={`${LP_BASE}/use-cases.html`}>{t('nav.usecases')}</a></li>
          <li className="hide-mobile"><a href={`${LP_BASE}/manuals/user-manual.html`}>{t('nav.manual')}</a></li>
          <li><a href="./" className="active">{t('nav.demo')}</a></li>
          <li><a href={DOWNLOAD_URL} className="btn-nav">{t('nav.buy')}</a></li>
          <li>
            <button className="theme-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </li>
          <li>
            <button className="lang-btn" onClick={toggleLang}>
              {lang === 'ja' ? 'EN' : '日本語'}
            </button>
          </li>
        </ul>
      </nav>

      {/* ── Hero ── */}
      <section className="demo-hero">
        <div className="demo-badge">{t('hero.badge')}</div>
        <h1>{t('hero.h1')}</h1>
        <p className="sub">{t('hero.sub')}</p>
      </section>

      {/* ── インタラクティブエディタ ── */}
      <section className="demo-editor-section">
        <DemoEditor lang={lang} t={t} downloadUrl={DOWNLOAD_URL} />
      </section>

      {/* ── フィーチャーハイライト ── */}
      <section className="demo-features-section">
        <div className="features-container">
          <p className="section-label">{t('features.label')}</p>
          <h2>{t('features.h2')}</h2>
          <p className="section-desc">{t('features.desc')}</p>

          {/* GIF カード 3枚 */}
          <div className="gif-grid">
            <div className="gif-card">
              <img src={`${GIF_BASE}/wysiwyg-formatting.gif`} alt={t('gif1.title')} loading="eager" />
              <div className="gif-card-body">
                <div className="gif-card-title">{t('gif1.title')}</div>
                <div className="gif-card-desc">{t('gif1.desc')}</div>
              </div>
            </div>
            <div className="gif-card">
              <img src={`${GIF_BASE}/code-block-export.gif`} alt={t('gif2.title')} loading="eager" />
              <div className="gif-card-body">
                <div className="gif-card-title">{t('gif2.title')}</div>
                <div className="gif-card-desc">{t('gif2.desc')}</div>
              </div>
            </div>
            <div className="gif-card">
              <img src={`${GIF_BASE}/focus-mode.gif`} alt={t('gif3.title')} loading="eager" />
              <div className="gif-card-body">
                <div className="gif-card-title">{t('gif3.title')}</div>
                <div className="gif-card-desc">{t('gif3.desc')}</div>
              </div>
            </div>
          </div>

          {/* ハイライトカード 2枚 */}
          <div className="highlight-row">
            {/* スラッシュコマンド */}
            <div className="highlight-card">
              <div className="highlight-badge">{t('slash.badge')}</div>
              <div className="highlight-title">{t('slash.title')}</div>
              <div className="highlight-desc">{t('slash.desc')}</div>
              <a
                className="highlight-cta-link"
                href="#top"
                onClick={e => {
                  e.preventDefault();
                  document.querySelector('.demo-editor-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {t('slash.cta')}
              </a>
            </div>

            {/* Prose Lint */}
            <div className="highlight-card">
              <div className="highlight-badge">{t('prose.badge')}</div>
              <img
                className="prose-lint-img"
                src={`${GIF_BASE}/prose-lint.gif`}
                alt={t('prose.title')}
              />
              <div className="highlight-title">{t('prose.title')}</div>
              <div className="highlight-desc">{t('prose.desc')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Download CTA ── */}
      <section className="demo-cta-section">
        <h2>{t('cta.h2')}</h2>
        <p className="cta-sub">{t('cta.sub')}</p>
        <p className="cta-note">{t('cta.note')}</p>
        <div className="btn-group">
          <a href={DOWNLOAD_URL} className="btn-primary">{t('cta.download')}</a>
          <a href={BUY_URL} className="btn-secondary">{t('cta.buy')}</a>
        </div>
        <p className="cta-meta">
          <span>{t('cta.meta.onetime')}</span>
          <span>{t('cta.meta.nosub')}</span>
          <span>{t('cta.meta.devices')}</span>
          <span>{t('cta.meta.local')}</span>
        </p>
      </section>

      {/* ── Footer ── */}
      <footer className="demo-footer">
        <div className="footer-links">
          <a href="https://github.com/hayashixd/MarkWeave">GitHub</a>
          <a href="https://zenn.dev/hayashixd/articles/f00eea197f087c">{t('footer.dev')}</a>
          <a href={`${LP_BASE}/use-cases.html`}>{t('footer.usecases')}</a>
          <a href={`${LP_BASE}/manuals/user-manual.html`}>{t('footer.manual')}</a>
          <a href={BUY_URL}>{t('footer.buy')}</a>
        </div>
        <p className="footer-copy">© 2024–2026 MarkWeave · MIT License</p>
      </footer>
    </>
  );
}
