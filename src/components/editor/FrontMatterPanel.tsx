/**
 * YAML Front Matter 編集パネル
 *
 * editor-ux-design.md §1 に準拠。
 *
 * - 折りたたみ状態: title / date / tags のサマリー表示
 * - 展開状態: <textarea> で生 YAML を直接編集
 * - 空 Front Matter の場合は「追加」ボタンを表示
 *
 * プラットフォームプロファイル:
 * - YAML の自動検出（detectPlatform）に加え、手動で Generic / Zenn / Qiita を選択可能
 * - 選択状態は tabProfileStore に保存（タブ単位・永続化なし）
 * - プラットフォーム切り替え時は YAML を自動変換して補完する
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getYamlSummary } from '../../lib/frontmatter';
import { detectPlatform } from '../../lib/platform-detector';
import type { Platform } from '../../lib/platform-detector';
import { PlatformFrontMatterForm } from './PlatformFrontMatterForm';
import { useTabProfileStore } from '../../store/tabProfileStore';
import {
  parseZennFrontmatter,
  serializeZennFrontmatter,
  ZENN_DEFAULTS,
} from '../../lib/platforms/zenn';
import {
  parseQiitaFrontmatter,
  serializeQiitaFrontmatter,
  QIITA_DEFAULTS,
} from '../../lib/platforms/qiita';

interface FrontMatterPanelProps {
  yaml: string;
  onChange: (newYaml: string) => void;
  /** 本文 Markdown を取得するコールバック（コピー操作・警告表示に使用） */
  getBodyMarkdown?: () => string;
  /** タブID（プロファイルオーバーライドの保存に使用） */
  tabId?: string;
}

const PLACEHOLDER = `title: 記事タイトル
date: ${new Date().toISOString().slice(0, 10)}
tags: [markdown, editor]
draft: false`;

const PLATFORM_LABELS: Record<Platform, string> = {
  generic: '汎用',
  zenn: 'Zenn',
  qiita: 'Qiita',
};

export function FrontMatterPanel({ yaml, onChange, getBodyMarkdown, tabId }: FrontMatterPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [localYaml, setLocalYaml] = useState(yaml);
  const [liveBodyMarkdown, setLiveBodyMarkdown] = useState<string | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasYaml = yaml.trim().length > 0;

  // プラットフォームオーバーライド（tabProfileStore）
  const platformOverride = useTabProfileStore((s) =>
    tabId ? s.overrides[tabId] : undefined,
  );
  const setOverride = useTabProfileStore((s) => s.setOverride);
  const clearOverride = useTabProfileStore((s) => s.clearOverride);

  const autoPlatform = detectPlatform(yaml);
  const effectivePlatform: Platform = platformOverride ?? autoPlatform;

  // 親から yaml が変わった時（タブ切り替え等）にローカル状態を同期
  useEffect(() => {
    setLocalYaml(yaml);
  }, [yaml]);

  // 展開時: テキストエリア自動フォーカス（generic のみ）& 最新本文を取得
  useEffect(() => {
    if (expanded) {
      if (effectivePlatform === 'generic' && textareaRef.current) {
        textareaRef.current.focus();
        adjustHeight(textareaRef.current);
      }
      if (getBodyMarkdown) {
        setLiveBodyMarkdown(getBodyMarkdown());
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /** プラットフォームプロファイルを手動切り替えし、必要に応じて YAML を変換する */
  const handlePlatformChange = useCallback(
    (newPlatform: Platform) => {
      if (!tabId) return;
      if (newPlatform === effectivePlatform) return;

      if (newPlatform === 'generic') {
        clearOverride(tabId);
        return;
      }

      setOverride(tabId, newPlatform);

      if (newPlatform === 'zenn') {
        if (!localYaml.trim()) {
          const newYaml = serializeZennFrontmatter(ZENN_DEFAULTS);
          setLocalYaml(newYaml);
          onChange(newYaml);
        } else if (effectivePlatform === 'qiita') {
          const qiitaFm = parseQiitaFrontmatter(localYaml);
          const newYaml = serializeZennFrontmatter({
            ...ZENN_DEFAULTS,
            title: qiitaFm.title,
            topics: qiitaFm.tags.slice(0, 5),
          });
          setLocalYaml(newYaml);
          onChange(newYaml);
        } else if (effectivePlatform === 'generic') {
          const newYaml = serializeZennFrontmatter(ZENN_DEFAULTS);
          setLocalYaml(newYaml);
          onChange(newYaml);
        }
      } else if (newPlatform === 'qiita') {
        if (!localYaml.trim()) {
          const newYaml = serializeQiitaFrontmatter(QIITA_DEFAULTS);
          setLocalYaml(newYaml);
          onChange(newYaml);
        } else if (effectivePlatform === 'zenn') {
          const zennFm = parseZennFrontmatter(localYaml);
          const newYaml = serializeQiitaFrontmatter({
            ...QIITA_DEFAULTS,
            title: zennFm.title,
            tags: zennFm.topics.slice(0, 5),
          });
          setLocalYaml(newYaml);
          onChange(newYaml);
        } else if (effectivePlatform === 'generic') {
          const newYaml = serializeQiitaFrontmatter(QIITA_DEFAULTS);
          setLocalYaml(newYaml);
          onChange(newYaml);
        }
      }
    },
    [tabId, effectivePlatform, localYaml, clearOverride, setOverride, onChange],
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
        {effectivePlatform !== 'generic' && (
          <span className={`front-matter-panel__platform-badge front-matter-panel__platform-badge--${effectivePlatform}`}>
            {effectivePlatform === 'zenn' ? 'Zenn' : 'Qiita'}
            {platformOverride && <span className="front-matter-panel__platform-manual"> ✎</span>}
          </span>
        )}
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
            onKeyDown={(e) => { if (!e.nativeEvent.isComposing && e.key === 'Enter') handleDelete(e as unknown as React.MouseEvent); }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
              <line x1="2" y1="2" x2="10" y2="10" />
              <line x1="10" y1="2" x2="2" y2="10" />
            </svg>
          </span>
        )}
      </button>

      {/* 展開時: プロファイルセレクター + プラットフォームフォーム or YAML テキストエリア */}
      {expanded && (
        <div className="front-matter-panel__body">
          <div className="front-matter-panel__delimiter">---</div>

          {/* プラットフォームプロファイルセレクター（tabId がある時のみ表示） */}
          {tabId && (
            <div className="front-matter-panel__profile-selector">
              <span className="front-matter-panel__profile-label">プロファイル:</span>
              {(['generic', 'zenn', 'qiita'] as Platform[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePlatformChange(p)}
                  className={`front-matter-panel__profile-btn${effectivePlatform === p ? ' front-matter-panel__profile-btn--active' : ''}`}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          )}

          {effectivePlatform !== 'generic' ? (
            <PlatformFrontMatterForm
              platform={effectivePlatform}
              yaml={localYaml}
              onChange={(newYaml) => {
                setLocalYaml(newYaml);
                onChange(newYaml);
              }}
              bodyMarkdown={liveBodyMarkdown}
              getBodyMarkdown={getBodyMarkdown}
            />
          ) : (
            <textarea
              ref={textareaRef}
              className="front-matter-panel__textarea"
              value={localYaml}
              onChange={handleChange}
              placeholder={PLACEHOLDER}
              spellCheck={false}
              aria-label="YAML Front Matter を編集"
            />
          )}
          <div className="front-matter-panel__delimiter">---</div>
        </div>
      )}
    </div>
  );
}
