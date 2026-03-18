/**
 * AiEditDiffPreview.tsx
 *
 * AI 編集結果のインライン diff プレビュー（ai-edit-design.md §9 準拠）。
 * 元テキストに取り消し線（赤背景）、新テキストにハイライト（緑背景）を表示。
 */

import React from 'react';
import type { DiffSegment } from '../../ai/edit/types';

interface AiEditDiffPreviewProps {
  segments: DiffSegment[];
}

export const AiEditDiffPreview: React.FC<AiEditDiffPreviewProps> = ({
  segments,
}) => {
  if (segments.length === 0) return null;

  return (
    <div className="px-3 py-2 border-t border-gray-100 max-h-60 overflow-y-auto">
      <div className="text-xs text-gray-500 mb-1">変更プレビュー:</div>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {segments.map((seg, i) => {
          switch (seg.type) {
            case 'removed':
              return (
                <span
                  key={i}
                  className="bg-red-100 text-red-800 line-through"
                >
                  {seg.text}
                </span>
              );
            case 'added':
              return (
                <span
                  key={i}
                  className="bg-green-100 text-green-800"
                >
                  {seg.text}
                </span>
              );
            case 'unchanged':
              return (
                <span key={i} className="text-gray-700">
                  {seg.text}
                </span>
              );
          }
        })}
      </div>
    </div>
  );
};

export default AiEditDiffPreview;
