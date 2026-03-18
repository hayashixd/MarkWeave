import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiEditDiffPreview } from './AiEditDiffPreview';
import type { DiffSegment } from '../../ai/edit/types';

describe('AiEditDiffPreview', () => {
  it('空配列のとき何もレンダリングしない', () => {
    const { container } = render(<AiEditDiffPreview segments={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('removed セグメントに bg-red-100 と line-through クラスが付く', () => {
    const segments: DiffSegment[] = [{ type: 'removed', text: '削除テキスト' }];
    render(<AiEditDiffPreview segments={segments} />);

    const span = screen.getByText('削除テキスト');
    expect(span).toHaveClass('bg-red-100');
    expect(span).toHaveClass('line-through');
  });

  it('added セグメントに bg-green-100 クラスが付く', () => {
    const segments: DiffSegment[] = [{ type: 'added', text: '追加テキスト' }];
    render(<AiEditDiffPreview segments={segments} />);

    const span = screen.getByText('追加テキスト');
    expect(span).toHaveClass('bg-green-100');
    expect(span).not.toHaveClass('line-through');
  });

  it('unchanged セグメントに text-gray-700 クラスが付く', () => {
    const segments: DiffSegment[] = [{ type: 'unchanged', text: '変更なし' }];
    render(<AiEditDiffPreview segments={segments} />);

    const span = screen.getByText('変更なし');
    expect(span).toHaveClass('text-gray-700');
  });

  it('複数セグメントが順番どおりレンダリングされる', () => {
    const segments: DiffSegment[] = [
      { type: 'unchanged', text: '共通部分' },
      { type: 'removed', text: '旧テキスト' },
      { type: 'added', text: '新テキスト' },
    ];
    render(<AiEditDiffPreview segments={segments} />);

    expect(screen.getByText('共通部分')).toBeInTheDocument();
    expect(screen.getByText('旧テキスト')).toBeInTheDocument();
    expect(screen.getByText('新テキスト')).toBeInTheDocument();
  });

  it('"変更プレビュー:" というラベルが表示される', () => {
    const segments: DiffSegment[] = [{ type: 'unchanged', text: 'text' }];
    render(<AiEditDiffPreview segments={segments} />);
    expect(screen.getByText('変更プレビュー:')).toBeInTheDocument();
  });

  it('added セグメントに text-green-800 クラスが付く', () => {
    const segments: DiffSegment[] = [{ type: 'added', text: '追加' }];
    render(<AiEditDiffPreview segments={segments} />);
    expect(screen.getByText('追加')).toHaveClass('text-green-800');
  });

  it('removed セグメントに text-red-800 クラスが付く', () => {
    const segments: DiffSegment[] = [{ type: 'removed', text: '削除' }];
    render(<AiEditDiffPreview segments={segments} />);
    expect(screen.getByText('削除')).toHaveClass('text-red-800');
  });
});
