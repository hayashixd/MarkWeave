/**
 * PlatformFrontMatterForm
 *
 * Zenn / Qiita 向けの構造化 Front Matter 編集フォーム。
 * FrontMatterPanel から platform が検出された場合に、
 * raw YAML textarea の代わりにこのフォームが表示される。
 *
 * - 'form' モード: 各フィールドをフォームで編集
 * - 'yaml' モード: 生 YAML テキストエリアで直接編集
 *
 * yaml prop が外部から変化した場合（タブ切り替え等）は form state を再同期する。
 * form 起点の onChange では lastSerializedRef を使って再同期ループを防ぐ。
 */

import { useState, useEffect, useCallback, useRef, KeyboardEvent } from 'react';
import type { Platform } from '../../lib/platform-detector';
import {
  parseZennFrontmatter,
  serializeZennFrontmatter,
  type ZennFrontmatter,
} from '../../lib/platforms/zenn';
import {
  parseQiitaFrontmatter,
  serializeQiitaFrontmatter,
  type QiitaFrontmatter,
} from '../../lib/platforms/qiita';
import { lintPlatformBody, type PlatformLintIssue } from '../../lib/platforms/platform-lint';
import {
  buildMarkdownWithFrontMatter,
  convertZennToQiitaMarkdown,
} from '../../lib/platforms/platform-copy';
import { useToastStore } from '../../store/toastStore';

interface PlatformFrontMatterFormProps {
  platform: 'zenn' | 'qiita';
  yaml: string;
  onChange: (newYaml: string) => void;
  /** 本文 Markdown（オプション）。警告表示に使用 */
  bodyMarkdown?: string;
  /** 最新の本文 Markdown を同期取得するコールバック（コピー操作に使用） */
  getBodyMarkdown?: () => string;
}

// ---------------------------------------------------------------------------
// TagInput
// ---------------------------------------------------------------------------

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  maxCount?: number;
  placeholder?: string;
}

function TagInput({ tags, onChange, maxCount, placeholder = '追加...' }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback(
    (raw: string) => {
      const tag = raw.trim();
      if (!tag || tags.includes(tag)) return;
      if (maxCount !== undefined && tags.length >= maxCount) return;
      onChange([...tags, tag]);
      setInputValue('');
    },
    [tags, onChange, maxCount],
  );

  const removeTag = useCallback(
    (index: number) => {
      onChange(tags.filter((_, i) => i !== index));
    },
    [tags, onChange],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag(inputValue);
      } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
        removeTag(tags.length - 1);
      }
    },
    [inputValue, tags, addTag, removeTag],
  );

  const atMax = maxCount !== undefined && tags.length >= maxCount;

  return (
    <div
      className="flex flex-wrap gap-1.5 items-center min-h-[36px] px-2 py-1.5 border border-gray-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(i);
            }}
            className="text-blue-500 hover:text-blue-700 leading-none"
            aria-label={`${tag} を削除`}
          >
            ×
          </button>
        </span>
      ))}
      {!atMax && (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (inputValue.trim()) addTag(inputValue); }}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] text-sm outline-none bg-transparent placeholder-gray-400"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToggleButton group
// ---------------------------------------------------------------------------

interface ToggleGroupProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

function ToggleGroup<T extends string>({ value, options, onChange }: ToggleGroupProps<T>) {
  return (
    <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-sm transition-colors ${
            value === opt.value
              ? 'bg-blue-600 text-white font-medium'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

function Warnings({
  platform,
  bodyMarkdown,
  topicsCount,
}: {
  platform: Platform;
  bodyMarkdown?: string;
  topicsCount?: number;
}) {
  const items: Array<{ severity: PlatformLintIssue['severity']; message: string }> = [];

  if (platform === 'zenn' && topicsCount !== undefined && topicsCount > 5) {
    items.push({ severity: 'warning', message: 'トピックは最大5件です' });
  }

  if (bodyMarkdown !== undefined) {
    // lint エンジンによるプラットフォーム固有チェック
    const lintIssues = lintPlatformBody(bodyMarkdown, platform);
    items.push(...lintIssues);

    // ローカル画像（全プラットフォーム共通）
    if (/!\[.*?\]\(\.\.?\//.test(bodyMarkdown)) {
      const count = (bodyMarkdown.match(/!\[.*?\]\(\.\.?\//g) ?? []).length;
      items.push({
        severity: 'warning',
        message: `ローカル画像が${count}件あります — プラットフォーム上では表示されません`,
      });
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-3 space-y-1">
      {items.map((item, i) => (
        <p
          key={i}
          className={`text-xs flex items-start gap-1 ${
            item.severity === 'error'
              ? 'text-red-700'
              : item.severity === 'info'
                ? 'text-blue-600'
                : 'text-amber-700'
          }`}
        >
          <span aria-hidden="true">
            {item.severity === 'error' ? '✕' : item.severity === 'info' ? 'ℹ' : '⚠'}
          </span>
          {item.message}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CopyButtons
// ---------------------------------------------------------------------------

function CopyButtons({
  platform,
  yaml,
  getBodyMarkdown,
}: {
  platform: 'zenn' | 'qiita';
  yaml: string;
  getBodyMarkdown?: () => string;
}) {
  const showToast = useToastStore((s) => s.show);

  const handleCopy = useCallback(async () => {
    const body = getBodyMarkdown?.() ?? '';
    const md = buildMarkdownWithFrontMatter(yaml, body);
    try {
      await navigator.clipboard.writeText(md);
      showToast('success', 'クリップボードにコピーしました');
    } catch {
      showToast('error', 'コピーに失敗しました');
    }
  }, [yaml, getBodyMarkdown, showToast]);

  const handleConvertAndCopy = useCallback(async () => {
    const body = getBodyMarkdown?.() ?? '';
    const md = convertZennToQiitaMarkdown(yaml, body);
    try {
      await navigator.clipboard.writeText(md);
      showToast('success', 'Qiita 用 Markdown をコピーしました');
    } catch {
      showToast('error', 'コピーに失敗しました');
    }
  }, [yaml, getBodyMarkdown, showToast]);

  return (
    <div className="mt-3 pt-2 border-t border-gray-100 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className="text-xs px-3 py-1 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
        title={`${platform === 'zenn' ? 'Zenn' : 'Qiita'} 用 Markdown をコピー`}
      >
        📋 Markdown をコピー
      </button>
      {platform === 'zenn' && (
        <button
          type="button"
          onClick={handleConvertAndCopy}
          className="text-xs px-3 py-1 rounded border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-colors"
          title="Zenn 固有記法を除去して Qiita 用にコピー"
        >
          ⇄ Qiita 用に変換してコピー
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ZennForm
// ---------------------------------------------------------------------------

function ZennForm({
  yaml,
  onChange,
  bodyMarkdown,
  getBodyMarkdown,
}: {
  yaml: string;
  onChange: (yaml: string) => void;
  bodyMarkdown?: string;
  getBodyMarkdown?: () => string;
}) {
  const initial = parseZennFrontmatter(yaml);
  const [title, setTitle] = useState(initial.title);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [type, setType] = useState<'tech' | 'idea'>(initial.type);
  const [topics, setTopics] = useState<string[]>(initial.topics);
  const [published, setPublished] = useState(initial.published);
  const [publicationName, setPublicationName] = useState(initial.publication_name ?? '');
  const [publishedAt, setPublishedAt] = useState(initial.published_at ?? '');
  const [slide, setSlide] = useState(initial.slide ?? false);
  const [showAdvanced, setShowAdvanced] = useState(
    !!(initial.publication_name || initial.published_at || initial.slide),
  );

  // 外部から yaml が変わった場合（タブ切り替え等）に再同期する
  const lastSerializedRef = useRef<string>(yaml);
  useEffect(() => {
    if (yaml !== lastSerializedRef.current) {
      const fm = parseZennFrontmatter(yaml);
      setTitle(fm.title);
      setEmoji(fm.emoji);
      setType(fm.type);
      setTopics(fm.topics);
      setPublished(fm.published);
      setPublicationName(fm.publication_name ?? '');
      setPublishedAt(fm.published_at ?? '');
      setSlide(fm.slide ?? false);
      setShowAdvanced(!!(fm.publication_name || fm.published_at || fm.slide));
      lastSerializedRef.current = yaml;
    }
  }, [yaml]);

  const emit = useCallback(
    (fm: ZennFrontmatter) => {
      const newYaml = serializeZennFrontmatter(fm);
      lastSerializedRef.current = newYaml;
      onChange(newYaml);
    },
    [onChange],
  );

  const buildFm = useCallback(
    (overrides: Partial<ZennFrontmatter> = {}): ZennFrontmatter => ({
      title,
      emoji,
      type,
      topics,
      published,
      publication_name: publicationName || undefined,
      published_at: publishedAt || undefined,
      slide: slide || undefined,
      ...overrides,
    }),
    [title, emoji, type, topics, published, publicationName, publishedAt, slide],
  );

  return (
    <div className="space-y-3 py-1">
      {/* タイトル */}
      <label className="block">
        <span className="text-xs font-medium text-gray-600 mb-1 block">タイトル</span>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            emit(buildFm({ title: e.target.value }));
          }}
          placeholder="記事タイトル"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </label>

      {/* 絵文字 */}
      <label className="block">
        <span className="text-xs font-medium text-gray-600 mb-1 block">
          絵文字
          <span className="ml-1 text-gray-400 font-normal">（Win+. で絵文字ピッカー）</span>
        </span>
        <input
          type="text"
          value={emoji}
          onChange={(e) => {
            setEmoji(e.target.value);
            emit(buildFm({ emoji: e.target.value }));
          }}
          maxLength={4}
          className="w-14 text-center text-2xl px-1 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </label>

      {/* 種別 */}
      <div>
        <span className="text-xs font-medium text-gray-600 mb-1 block">種別</span>
        <ToggleGroup
          value={type}
          options={[
            { value: 'tech', label: '技術記事' },
            { value: 'idea', label: 'アイデア' },
          ]}
          onChange={(v) => {
            setType(v);
            emit(buildFm({ type: v }));
          }}
        />
      </div>

      {/* トピック */}
      <div>
        <span className="text-xs font-medium text-gray-600 mb-1 block">
          トピック
          <span className="ml-1 text-gray-400 font-normal">（最大5件、Enter で追加）</span>
        </span>
        <TagInput
          tags={topics}
          onChange={(newTopics) => {
            setTopics(newTopics);
            emit(buildFm({ topics: newTopics }));
          }}
          maxCount={5}
          placeholder="typescript, react ..."
        />
      </div>

      {/* 公開設定 */}
      <div>
        <span className="text-xs font-medium text-gray-600 mb-1 block">公開設定</span>
        <ToggleGroup
          value={published ? 'published' : 'draft'}
          options={[
            { value: 'draft', label: '下書き' },
            { value: 'published', label: '公開' },
          ]}
          onChange={(v) => {
            const pub = v === 'published';
            setPublished(pub);
            emit(buildFm({ published: pub }));
          }}
        />
      </div>

      {/* 詳細設定トグル */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
      >
        <span>{showAdvanced ? '▾' : '▸'}</span>
        詳細設定（Publication・予約投稿・スライド）
      </button>

      {/* 詳細設定フィールド */}
      {showAdvanced && (
        <div className="space-y-3 pl-3 border-l-2 border-gray-100">
          {/* Publication 名 */}
          <label className="block">
            <span className="text-xs font-medium text-gray-600 mb-1 block">
              Publication スラッグ
              <span className="ml-1 text-gray-400 font-normal">（オプション）</span>
            </span>
            <input
              type="text"
              value={publicationName}
              onChange={(e) => {
                setPublicationName(e.target.value);
                emit(buildFm({ publication_name: e.target.value || undefined }));
              }}
              placeholder="my-publication"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </label>

          {/* 予約投稿日時 */}
          <label className="block">
            <span className="text-xs font-medium text-gray-600 mb-1 block">
              予約投稿日時
              <span className="ml-1 text-gray-400 font-normal">（published: true の場合のみ有効）</span>
            </span>
            <input
              type="datetime-local"
              value={publishedAt ? publishedAt.slice(0, 16) : ''}
              onChange={(e) => {
                const val = e.target.value ? e.target.value + ':00+09:00' : '';
                setPublishedAt(val);
                emit(buildFm({ published_at: val || undefined }));
              }}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </label>

          {/* スライドモード */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={slide}
              onChange={(e) => {
                setSlide(e.target.checked);
                emit(buildFm({ slide: e.target.checked || undefined }));
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-700">スライドモードで公開</span>
          </label>
        </div>
      )}

      <Warnings platform="zenn" bodyMarkdown={bodyMarkdown} topicsCount={topics.length} />

      {/* コピーボタン群 */}
      <CopyButtons platform="zenn" yaml={yaml} getBodyMarkdown={getBodyMarkdown} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// QiitaForm
// ---------------------------------------------------------------------------

function QiitaForm({
  yaml,
  onChange,
  bodyMarkdown,
  getBodyMarkdown,
}: {
  yaml: string;
  onChange: (yaml: string) => void;
  bodyMarkdown?: string;
  getBodyMarkdown?: () => string;
}) {
  const initial = parseQiitaFrontmatter(yaml);
  const [title, setTitle] = useState(initial.title);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [isPrivate, setIsPrivate] = useState(initial.private);

  const lastSerializedRef = useRef<string>(yaml);
  useEffect(() => {
    if (yaml !== lastSerializedRef.current) {
      const fm = parseQiitaFrontmatter(yaml);
      setTitle(fm.title);
      setTags(fm.tags);
      setIsPrivate(fm.private);
      lastSerializedRef.current = yaml;
    }
  }, [yaml]);

  const emit = useCallback(
    (fm: QiitaFrontmatter) => {
      const newYaml = serializeQiitaFrontmatter(fm);
      lastSerializedRef.current = newYaml;
      onChange(newYaml);
    },
    [onChange],
  );

  return (
    <div className="space-y-3 py-1">
      {/* タイトル */}
      <label className="block">
        <span className="text-xs font-medium text-gray-600 mb-1 block">タイトル</span>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            emit({ title: e.target.value, tags, private: isPrivate });
          }}
          placeholder="記事タイトル"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </label>

      {/* タグ */}
      <div>
        <span className="text-xs font-medium text-gray-600 mb-1 block">
          タグ
          <span className="ml-1 text-gray-400 font-normal">（Enter で追加）</span>
        </span>
        <TagInput
          tags={tags}
          onChange={(newTags) => {
            setTags(newTags);
            emit({ title, tags: newTags, private: isPrivate });
          }}
          placeholder="TypeScript, React ..."
        />
      </div>

      {/* 限定共有 */}
      <div>
        <span className="text-xs font-medium text-gray-600 mb-1 block">限定共有</span>
        <ToggleGroup
          value={isPrivate ? 'on' : 'off'}
          options={[
            { value: 'off', label: 'OFF（公開）' },
            { value: 'on', label: 'ON（限定）' },
          ]}
          onChange={(v) => {
            const priv = v === 'on';
            setIsPrivate(priv);
            emit({ title, tags, private: priv });
          }}
        />
      </div>

      <Warnings platform="qiita" bodyMarkdown={bodyMarkdown} />

      {/* コピーボタン群 */}
      <CopyButtons platform="qiita" yaml={yaml} getBodyMarkdown={getBodyMarkdown} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlatformFrontMatterForm（メインエクスポート）
// ---------------------------------------------------------------------------

export function PlatformFrontMatterForm({
  platform,
  yaml,
  onChange,
  bodyMarkdown,
  getBodyMarkdown,
}: PlatformFrontMatterFormProps) {
  const [editMode, setEditMode] = useState<'form' | 'yaml'>('form');
  const [localYaml, setLocalYaml] = useState(yaml);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // yaml モードで自分の onChange が起点の変更を区別するための ref
  const lastYamlFromSelfRef = useRef<string>(yaml);

  // platform が変わったら（= 別ファイルを開いた等）フォームモードに戻る
  useEffect(() => {
    setEditMode('form');
  }, [platform]);

  // yaml モード中、外部からの yaml 変更（タブ切り替え等）を textarea に反映
  useEffect(() => {
    if (editMode === 'yaml' && yaml !== lastYamlFromSelfRef.current) {
      setLocalYaml(yaml);
      lastYamlFromSelfRef.current = yaml;
    }
  }, [yaml, editMode]);

  const handleSwitchToYaml = useCallback(() => {
    setLocalYaml(yaml);
    lastYamlFromSelfRef.current = yaml;
    setEditMode('yaml');
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 80)}px`;
      }
    }, 0);
  }, [yaml]);

  const handleSwitchToForm = useCallback(() => {
    setEditMode('form');
  }, []);

  const handleYamlChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setLocalYaml(val);
      lastYamlFromSelfRef.current = val;
      // textarea 高さ自動調整
      e.target.style.height = 'auto';
      e.target.style.height = `${Math.max(e.target.scrollHeight, 80)}px`;
      onChange(val);
    },
    [onChange],
  );

  // yaml モード
  if (editMode === 'yaml') {
    return (
      <div>
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={handleSwitchToForm}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            ← フォームに戻る
          </button>
        </div>
        <textarea
          ref={textareaRef}
          value={localYaml}
          onChange={handleYamlChange}
          spellCheck={false}
          className="w-full font-mono text-xs resize-none border-0 outline-none bg-transparent text-gray-700 leading-relaxed"
          aria-label="YAML Front Matter を直接編集"
        />
      </div>
    );
  }

  // フォームモード
  return (
    <div>
      {platform === 'zenn' ? (
        <ZennForm yaml={yaml} onChange={onChange} bodyMarkdown={bodyMarkdown} getBodyMarkdown={getBodyMarkdown} />
      ) : (
        <QiitaForm yaml={yaml} onChange={onChange} bodyMarkdown={bodyMarkdown} getBodyMarkdown={getBodyMarkdown} />
      )}
      <div className="flex justify-end mt-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={handleSwitchToYaml}
          className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
        >
          YAML を直接編集
        </button>
      </div>
    </div>
  );
}
