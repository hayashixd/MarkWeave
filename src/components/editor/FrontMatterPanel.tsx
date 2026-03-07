/**
 * YAML Front Matter 編集パネル
 *
 * editor-ux-design.md §1 に準拠。
 *
 * - 折りたたみ状態: title / date / tags のサマリー表示
 * - 展開状態: <textarea> で生 YAML を直接編集
 * - 空 Front Matter の場合は「追加」ボタンを表示
 *
 * ペルソナ対応:
 * - テクニカルライター/開発者: ドキュメントメタデータ（title, date, author）管理
 * - 一般ライター/ブロガー: ブログ記事の title / tags / draft 設定
 * - 知識管理者: ノートのメタデータ（tags, aliases 等）管理
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getYamlSummary } from '../../lib/frontmatter';

interface FrontMatterPanelProps {
  yaml: string;
  onChange: (newYaml: string) => void;
}

const PLACEHOLDER = `title: 記事タイトル
date: ${new Date().toISOString().slice(0, 10)}
tags: [markdown, editor]
draft: false`;

export function FrontMatterPanel({ yaml, onChange }: FrontMatterPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [localYaml, setLocalYaml] = useState(yaml);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasYaml = yaml.trim().length > 0;

  // 親から yaml が変わった時（タブ切り替え等）にローカル状態を同期
  useEffect(() => {
    setLocalYaml(yaml);
  }, [yaml]);

  // 展開時にテキストエリアを自動フォーカス・高さ調整
  useEffect(() => {
    if (expanded && textareaRef.current) {
      textareaRef.current.focus();
      adjustHeight(textareaRef.current);
    }
  }, [expanded]);

  const adjustHeight = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 80)}px`;
  };

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setLocalYaml(val);
      adjustHeight(e.target);
      onChange(val);
    },
    [onChange],
  );

  const handleAddFrontMatter = useCallback(() => {
    const defaultYaml = PLACEHOLDER;
    setLocalYaml(defaultYaml);
    onChange(defaultYaml);
    setExpanded(true);
  }, [onChange]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm('フロントマターを削除しますか？')) return;
      setLocalYaml('');
      onChange('');
      setExpanded(false);
    },
    [onChange],
  );

  // Front Matter がない場合: 薄い「追加」ボタン
  if (!hasYaml && !expanded) {
    return (
      <div className="front-matter-panel front-matter-panel--empty">
        <button
          type="button"
          className="front-matter-panel__add-btn"
          onClick={handleAddFrontMatter}
          title="YAML Front Matter を追加"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
            <line x1="6" y1="1" x2="6" y2="11" />
            <line x1="1" y1="6" x2="11" y2="6" />
          </svg>
          Front Matter を追加
        </button>
      </div>
    );
  }

  const summary = getYamlSummary(localYaml);

  return (
    <div className={`front-matter-panel${expanded ? ' front-matter-panel--expanded' : ''}`}>
      {/* ヘッダー行（クリックで折りたたみトグル） */}
      <button
        type="button"
        className="front-matter-panel__header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="front-matter-panel__icon">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
            <path d="M2 1h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm0 1v9h9V2H2zm1.5 2h6v1h-6V4zm0 2.5h4v1h-4v-1z" opacity="0.8"/>
          </svg>
        </span>
        <span className="front-matter-panel__label">Front Matter</span>
        {!expanded && (
          <span className="front-matter-panel__summary">{summary}</span>
        )}
        <span className="front-matter-panel__chevron" aria-hidden="true">
          {expanded ? '∧' : '∨'}
        </span>

        {/* 削除ボタン（展開時のみ） */}
        {expanded && (
          <span
            className="front-matter-panel__delete"
            onClick={handleDelete}
            title="フロントマターを削除"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') handleDelete(e as unknown as React.MouseEvent); }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
              <line x1="2" y1="2" x2="10" y2="10" />
              <line x1="10" y1="2" x2="2" y2="10" />
            </svg>
          </span>
        )}
      </button>

      {/* 展開時: YAML テキストエリア */}
      {expanded && (
        <div className="front-matter-panel__body">
          <div className="front-matter-panel__delimiter">---</div>
          <textarea
            ref={textareaRef}
            className="front-matter-panel__textarea"
            value={localYaml}
            onChange={handleChange}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            aria-label="YAML Front Matter を編集"
          />
          <div className="front-matter-panel__delimiter">---</div>
        </div>
      )}
    </div>
  );
}
