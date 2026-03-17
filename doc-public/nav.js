/**
 * nav.js — MarkWeave 共有ナビゲーション
 *
 * 使い方（各 HTML ページの <head> 内に追加）:
 *   ルート階層 (index.html など):  <script src="nav.js"      data-root=""></script>
 *   1階層下   (manuals/*.html):   <script src="../nav.js"   data-root="../"></script>
 *
 * このスクリプトは以下を担当する:
 *   - <nav id="site-nav"> へのナビ HTML の注入
 *   - 日英の言語切り替え (window.mwToggleLang)
 *   - 言語変更を各ページに通知するカスタムイベント (mw-lang-change)
 */
(function () {
  'use strict';

  // data-root 属性からルートパスを取得（スクリプト実行時に確定させる）
  var root = (document.currentScript && document.currentScript.dataset.root) || '';

  var i18n = {
    ja: {
      features:  '機能',
      pricing:   '価格',
      usecases:  '活用事例',
      manual:    'マニュアル',
      demo:      'デモ',
      download:  '無料で試す',
    },
    en: {
      features:  'Features',
      pricing:   'Pricing',
      usecases:  'Use Cases',
      manual:    'Manual',
      demo:      'Demo',
      download:  'Try Free',
    },
  };

  function getLang() {
    var saved = localStorage.getItem('mw-lang');
    if (saved === 'ja' || saved === 'en') return saved;
    return ((navigator.language || '')).startsWith('ja') ? 'ja' : 'en';
  }

  function render(lang) {
    var nav = document.getElementById('site-nav');
    if (!nav) return;
    var t = i18n[lang];
    var btn = lang === 'ja' ? 'EN' : '日本語';
    nav.innerHTML =
      '<a href="' + root + 'index.html" class="nav-logo">MarkWeave</a>' +
      '<ul class="nav-links">' +
        '<li class="hide-mobile"><a href="' + root + 'index.html#solutions">'  + t.features  + '</a></li>' +
        '<li class="hide-mobile"><a href="' + root + 'index.html#pricing">'    + t.pricing   + '</a></li>' +
        '<li class="hide-mobile"><a href="' + root + 'use-cases.html">'        + t.usecases  + '</a></li>' +
        '<li class="hide-mobile"><a href="' + root + 'manuals/user-manual.html">' + t.manual + '</a></li>' +
        '<li class="hide-mobile"><a href="' + root + 'demo/">'                 + t.demo      + '</a></li>' +
        '<li><a href="https://github.com/hayashixd/MarkWeave/releases/latest" class="btn-nav">' + t.download + '</a></li>' +
        '<li><button class="lang-btn" onclick="mwToggleLang()">' + btn + '</button></li>' +
      '</ul>';
  }

  /** ページのコンテンツ i18n と協調するためのトグル関数 */
  window.mwToggleLang = function () {
    var next = getLang() === 'ja' ? 'en' : 'ja';
    localStorage.setItem('mw-lang', next);
    render(next);
    document.dispatchEvent(new CustomEvent('mw-lang-change', { detail: next }));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { render(getLang()); });
  } else {
    render(getLang());
  }
}());
