/**
 * Git ガター差分インジケーター
 *
 * git-integration-design.md §5.1 に準拠:
 * - エディタの左端に差分インジケーターを表示
 * - 追加行: 緑バー (+)
 * - 変更行: オレンジバー (~)
 * - 削除行: 赤マーカー (-)
 *
 * unified diff を解析して行番号ごとのマーカーを生成する。
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGitStore } from '../../store/gitStore';
import { useSettingsStore } from '../../store/settingsStore';

export type DiffLineType = 'added' | 'modified' | 'deleted';

export interface DiffLineMarker {
  line: number;
  type: DiffLineType;
}

/**
 * unified diff テキストからマーカーを生成する。
 * @param diff unified diff 形式のテキスト
 * @returns 行番号ベースの差分マーカー配列
 */
export function parseDiffMarkers(diff: string): DiffLineMarker[] {
  if (!diff.trim()) return [];

  const markers: DiffLineMarker[] = [];
  const lines = diff.split('\n');

  // unified diff のハンク (@@ -a,b +c,d @@) を追跡
  let currentLine = 0;
  const hunkHeaderRe = /^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/;

  for (const line of lines) {
    const hunkMatch = line.match(hunkHeaderRe);
    if (hunkMatch) {
      currentLine = parseInt(hunkMatch[1]!, 10);
      continue;
    }

    if (line.startsWith('+')) {
      markers.push({ line: currentLine, type: 'added' });
      currentLine++;
    } else if (line.startsWith('-')) {
      // 削除行はマーカーのみ（行番号は進めない）
      markers.push({ line: currentLine, type: 'deleted' });
    } else if (line.startsWith(' ')) {
      currentLine++;
    }
  }

  // 同じ行に追加と削除がある場合は "modified" にマージ
  const lineMap = new Map<number, DiffLineType>();
  for (const m of markers) {
    const existing = lineMap.get(m.line);
    if (existing) {
      // 追加 + 削除 = 変更
      if ((existing === 'added' && m.type === 'deleted') || (existing === 'deleted' && m.type === 'added')) {
        lineMap.set(m.line, 'modified');
      }
    } else {
      lineMap.set(m.line, m.type);
    }
  }

  return Array.from(lineMap.entries()).map(([line, type]) => ({ line, type }));
}

interface GitGutterIndicatorProps {
  /** リポジトリルートパス */
  repoPath: string | null;
  /** 現在のファイルパス */
  filePath: string | null;
  /** エディタの行の高さ（px） */
  lineHeight?: number;
  /** エディタコンテナの ref（スクロール同期用） */
  editorContainerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * エディタ左端に差分インジケーターバーを表示するコンポーネント。
 * 設計書 §5.1 のマーカー表示を実装。
 */
export function GitGutterIndicator({
  repoPath,
  filePath,
  lineHeight = 24,
  editorContainerRef,
}: GitGutterIndicatorProps) {
  const showGutter = useSettingsStore((s) => s.settings.git.showGutterIndicators);
  const isGitRepo = useGitStore((s) => s.isGitRepo);
  const getDiff = useGitStore((s) => s.getDiff);

  const [markers, setMarkers] = useState<DiffLineMarker[]>([]);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // diff を取得してマーカーを生成
  useEffect(() => {
    if (!showGutter || !isGitRepo || !repoPath || !filePath) {
      setMarkers([]);
      return;
    }

    let cancelled = false;

    // ワークスペースからの相対パスに変換
    const relPath = filePath.startsWith(repoPath)
      ? filePath.slice(repoPath.length).replace(/^[/\\]/, '')
      : filePath;

    getDiff(repoPath, relPath, false)
      .then((diff) => {
        if (!cancelled) {
          setMarkers(parseDiffMarkers(diff));
        }
      })
      .catch(() => {
        if (!cancelled) setMarkers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [showGutter, isGitRepo, repoPath, filePath, getDiff]);

  // エディタコンテナのスクロールを同期
  useEffect(() => {
    const el = editorContainerRef?.current;
    if (!el) return;
    const handler = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [editorContainerRef]);

  const colorMap: Record<DiffLineType, string> = useMemo(
    () => ({
      added: 'bg-green-400',
      modified: 'bg-orange-400',
      deleted: 'bg-red-400',
    }),
    [],
  );

  if (!showGutter || !isGitRepo || markers.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="git-gutter-indicator absolute left-0 top-0 w-1 pointer-events-none"
      style={{ height: '100%' }}
      aria-hidden="true"
    >
      {markers.map((m) => {
        const top = (m.line - 1) * lineHeight - scrollTop;
        const height = m.type === 'deleted' ? 3 : lineHeight;
        return (
          <div
            key={`${m.line}-${m.type}`}
            className={`absolute left-0 w-1 ${colorMap[m.type]} rounded-sm`}
            style={{ top: `${top}px`, height: `${height}px` }}
            title={
              m.type === 'added'
                ? `行 ${m.line}: 追加`
                : m.type === 'modified'
                  ? `行 ${m.line}: 変更`
                  : `行 ${m.line}: 削除`
            }
          />
        );
      })}
    </div>
  );
}
