#!/usr/bin/env node
/**
 * Gumroad 商品ページ HTML / テキスト ジェネレーター
 *
 * ソース: doc-public/gumroad-source.md
 * 出力:  doc-public/gumroad-description.html
 *        doc-public/gumroad-description.txt
 *
 * 実行: pnpm gumroad:build
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'doc-public', 'gumroad-source.md');
const OUT_HTML = path.join(ROOT, 'doc-public', 'gumroad-description.html');
const OUT_TXT  = path.join(ROOT, 'doc-public', 'gumroad-description.txt');

const GIF_BASE = 'https://hayashixd.github.io/MarkWeave/demo-gifs/';

// ---- パース ----------------------------------------------------------------

/**
 * gumroad-source.md を読み込み、セクションオブジェクトの配列を返す。
 * { type: 'MAIN_TITLE' | 'INTRO' | 'DEMO_GIF' | 'DEMO_GIF_2' | 'PROBLEMS'
 *        | 'FEATURES' | 'INCLUDES' | 'SYSTEM_REQ' | 'PRICING' | 'FAQ' | 'LINKS',
 *   lines: string[] }
 */
function parseSections(source) {
  // HTML コメントを除去
  const cleaned = source.replace(/<!--[\s\S]*?-->/g, '');

  const sections = [];
  let current = null;

  for (const raw of cleaned.split('\n')) {
    const line = raw.trimEnd();
    const sectionMatch = line.match(/^#\s+([A-Z0-9_]+)\s*$/);
    if (sectionMatch) {
      if (current) sections.push(current);
      current = { type: sectionMatch[1], lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

// ---- ユーティリティ ---------------------------------------------------------

/** 先頭・末尾の空行を除去 */
function trim(lines) {
  let start = 0;
  while (start < lines.length && lines[start].trim() === '') start++;
  let end = lines.length - 1;
  while (end >= start && lines[end].trim() === '') end--;
  return lines.slice(start, end + 1);
}

/** Markdown インライン記法 → HTML */
function inlineHtml(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

/** Markdown インライン記法 → プレーンテキスト */
function inlineTxt(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`(.+?)`/g, '$1');
}

/** 箇条書き行のリスト（- で始まる行）を ul/li に変換 */
function parseList(lines) {
  const items = [];
  let paragraph = null;
  for (const line of lines) {
    if (line.startsWith('- ')) {
      if (paragraph !== null) paragraph = null;
      items.push({ type: 'li', text: line.slice(2) });
    } else if (line.trim() === '') {
      // skip blank
    } else {
      items.push({ type: 'heading', text: line });
    }
  }
  return items;
}

// ---- HTML 生成 --------------------------------------------------------------

function sectionToHtml(section) {
  const lines = trim(section.lines);

  switch (section.type) {
    case 'MAIN_TITLE': {
      return `<h2>${inlineHtml(lines.join(' '))}</h2>`;
    }

    case 'INTRO': {
      const html = lines
        .filter(l => l.trim() !== '')
        .map(l => inlineHtml(l))
        .join('<br>\n  ');
      return `<p>\n  ${html}\n</p>`;
    }

    case 'DEMO_GIF':
    case 'DEMO_GIF_2': {
      const [file, alt] = lines[0].split('|').map(s => s.trim());
      const style = 'width:100%; border-radius:8px; margin:1rem 0;';
      return `<img src="${GIF_BASE}${file}" alt="${alt}" style="${style}">`;
    }

    case 'PROBLEMS':
    case 'FEATURES':
    case 'INCLUDES':
    case 'SYSTEM_REQ':
    case 'PRICING': {
      const items = parseList(lines);
      const heading = items.find(i => i.type === 'heading');
      const listItems = items
        .filter(i => i.type === 'li')
        .map(i => `  <li>${inlineHtml(i.text)}</li>`)
        .join('\n');
      return [
        heading ? `<h3>${inlineHtml(heading.text)}</h3>` : '',
        '<ul>',
        listItems,
        '</ul>',
      ].filter(Boolean).join('\n');
    }

    case 'FAQ': {
      const heading = lines.find(l => l.trim() && !l.startsWith('Q:') && !l.startsWith('A:'));
      const faqs = [];
      let q = null;
      for (const line of lines) {
        if (line.startsWith('Q:')) {
          q = line.slice(2).trim();
        } else if (line.startsWith('A:') && q !== null) {
          faqs.push({ q, a: line.slice(2).trim() });
          q = null;
        }
      }
      const faqHtml = faqs
        .map(f => `<p><strong>Q. ${inlineHtml(f.q)}</strong><br>\n${inlineHtml(f.a)}</p>`)
        .join('\n\n');
      return [
        heading ? `<h3>${inlineHtml(heading)}</h3>` : '',
        faqHtml,
      ].filter(Boolean).join('\n\n');
    }

    case 'LINKS': {
      const parts = lines
        .filter(l => l.startsWith('- '))
        .map(l => {
          const text = l.slice(2);
          const m = text.match(/^(.+?):\s*(https?:\/\/\S+)$/);
          if (!m) return null;
          const [, label, url] = m;
          const emoji = label.includes('マニュアル') ? '📖'
            : label.includes('GitHub') ? '💻'
            : label.includes('Zenn') ? '📝'
            : '🔗';
          return `${emoji} <a href="${url}">${label.trim()}</a>`;
        })
        .filter(Boolean);
      return `<p>\n  ${parts.join(' &nbsp;|&nbsp;\n  ')}\n</p>`;
    }

    default:
      return '';
  }
}

function buildHtml(sections) {
  const header = `<!--
  Gumroad 商品説明欄用 HTML スニペット
  使い方: Gumroad ダッシュボード → 商品編集 → Description の HTML モードに貼り付け
  ※ このファイルは自動生成です。直接編集せず doc-public/gumroad-source.md を編集して
     pnpm gumroad:build を実行してください。
-->`;

  const blocks = [];
  const DIVIDERS_AFTER = new Set(['PROBLEMS', 'FEATURES', 'INCLUDES', 'SYSTEM_REQ', 'FAQ']);

  for (const section of sections) {
    const html = sectionToHtml(section);
    if (!html) continue;
    blocks.push(html);
    if (DIVIDERS_AFTER.has(section.type)) {
      blocks.push('<hr>');
    }
  }

  return [header, '', ...blocks, ''].join('\n\n');
}

// ---- テキスト生成 -----------------------------------------------------------

function sectionToTxt(section) {
  const lines = trim(section.lines);

  switch (section.type) {
    case 'MAIN_TITLE':
      return inlineTxt(lines.join(' '));

    case 'INTRO':
      return lines.filter(l => l.trim()).map(l => inlineTxt(l)).join('\n');

    case 'DEMO_GIF':
    case 'DEMO_GIF_2':
      return '';  // テキスト版には画像なし

    case 'PROBLEMS':
    case 'FEATURES':
    case 'INCLUDES':
    case 'SYSTEM_REQ':
    case 'PRICING': {
      const items = parseList(lines);
      const heading = items.find(i => i.type === 'heading');
      const list = items
        .filter(i => i.type === 'li')
        .map(i => `・${inlineTxt(i.text)}`)
        .join('\n');
      return [heading ? inlineTxt(heading.text) : '', list].filter(Boolean).join('\n\n');
    }

    case 'FAQ': {
      const heading = lines.find(l => l.trim() && !l.startsWith('Q:') && !l.startsWith('A:'));
      const faqs = [];
      let q = null;
      for (const line of lines) {
        if (line.startsWith('Q:')) {
          q = line.slice(2).trim();
        } else if (line.startsWith('A:') && q !== null) {
          faqs.push(`Q. ${inlineTxt(q)}\n ${inlineTxt(line.slice(2).trim())}`);
          q = null;
        }
      }
      return [heading ? inlineTxt(heading) : '', ...faqs].filter(Boolean).join('\n\n');
    }

    case 'LINKS': {
      return lines
        .filter(l => l.startsWith('- '))
        .map(l => {
          const text = l.slice(2);
          const m = text.match(/^(.+?):\s*(https?:\/\/\S+)$/);
          if (!m) return null;
          const [, label, url] = m;
          return `${label.trim()}: ${url}`;
        })
        .filter(Boolean)
        .join('\n');
    }

    default:
      return '';
  }
}

function buildTxt(sections) {
  const DIVIDERS_AFTER = new Set(['PROBLEMS', 'FEATURES', 'INCLUDES', 'SYSTEM_REQ', 'FAQ']);
  const blocks = [];

  for (const section of sections) {
    const txt = sectionToTxt(section);
    if (!txt) continue;
    blocks.push(txt);
    if (DIVIDERS_AFTER.has(section.type)) {
      blocks.push('---');
    }
  }

  return blocks.join('\n\n') + '\n';
}

// ---- メイン -----------------------------------------------------------------

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`ソースファイルが見つかりません: ${SOURCE}`);
    process.exit(1);
  }

  const source = fs.readFileSync(SOURCE, 'utf-8');
  const sections = parseSections(source);

  if (sections.length === 0) {
    console.error('セクションが見つかりません。gumroad-source.md の形式を確認してください。');
    process.exit(1);
  }

  const html = buildHtml(sections);
  const txt  = buildTxt(sections);

  fs.writeFileSync(OUT_HTML, html, 'utf-8');
  fs.writeFileSync(OUT_TXT, txt, 'utf-8');

  console.log('✓ gumroad-description.html を生成しました');
  console.log('✓ gumroad-description.txt  を生成しました');
  console.log('');
  console.log('Gumroad への貼り付け手順:');
  console.log('  1. Gumroad ダッシュボード → 商品編集 → Description');
  console.log('  2. gumroad-description.txt の内容をコピー');
  console.log('  3. Gumroad エディタに貼り付け → ツールバーで見出し・リストを手動整形 → 保存');

  // 同期が必要なファイルのリマインダー
  const syncWarnings = [
    'doc-public/index.html  (#features, #pricing, #faq, #environment)',
    'README.md              (主な機能テーブル、動作環境テーブル)',
  ];
  console.log('');
  console.log('以下のファイルは自動更新されません。手動で内容を合わせてください:');
  for (const w of syncWarnings) {
    console.log(`  ⚠  ${w}`);
  }
}

main();
