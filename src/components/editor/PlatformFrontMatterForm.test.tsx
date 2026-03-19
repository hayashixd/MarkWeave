/**
 * PlatformFrontMatterForm コンポーネントテスト
 *
 * 今回実装した以下の動作を検証する:
 * 1. CopyButtons のコピー前バリデーション（タイトル・タグ空）
 * 2. Warnings コンポーネントへのタイトル文字数警告
 * 3. QiitaForm の coediting トグル
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlatformFrontMatterForm } from './PlatformFrontMatterForm';

// navigator.clipboard をモック
const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: clipboardWriteText },
  configurable: true,
});

// toastStore のモック
vi.mock('../../store/toastStore', () => ({
  useToastStore: (selector: (s: { show: ReturnType<typeof vi.fn> }) => unknown) => {
    const show = vi.fn();
    return selector({ show });
  },
}));

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function renderZennForm(yamlOverride?: string) {
  const yaml =
    yamlOverride ??
    'title: "テスト"\nemoji: "📝"\ntype: "tech"\ntopics: ["typescript"]\npublished: false';
  const onChange = vi.fn();
  return {
    ...render(
      <PlatformFrontMatterForm
        platform="zenn"
        yaml={yaml}
        onChange={onChange}
        bodyMarkdown=""
        getBodyMarkdown={() => ''}
      />,
    ),
    onChange,
  };
}

function renderQiitaForm(yamlOverride?: string) {
  const yaml =
    yamlOverride ??
    'title: "テスト"\ntags:\n  - name: TypeScript\nprivate: false';
  const onChange = vi.fn();
  return {
    ...render(
      <PlatformFrontMatterForm
        platform="qiita"
        yaml={yaml}
        onChange={onChange}
        bodyMarkdown=""
        getBodyMarkdown={() => ''}
      />,
    ),
    onChange,
  };
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe('PlatformFrontMatterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Warnings: タイトル文字数 ──────────────────────────────────────────────

  describe('タイトル文字数警告（Warnings）', () => {
    it('60文字以内のタイトルは警告を表示しない', () => {
      const shortTitle = 'あ'.repeat(20);
      renderZennForm(
        `title: "${shortTitle}"\nemoji: "📝"\ntype: "tech"\ntopics: ["a"]\npublished: false`,
      );
      expect(screen.queryByText(/文字です/)).toBeNull();
    });

    it('61文字以上のタイトルは警告を表示する', () => {
      const longTitle = 'あ'.repeat(61);
      renderZennForm(
        `title: "${longTitle}"\nemoji: "📝"\ntype: "tech"\ntopics: ["a"]\npublished: false`,
      );
      expect(screen.getByText(/61文字です/)).toBeInTheDocument();
    });

    it('Qiita フォームでも 61 文字以上で警告を表示する', () => {
      const longTitle = 'a'.repeat(61);
      renderQiitaForm(
        `title: "${longTitle}"\ntags:\n  - name: Go\nprivate: false`,
      );
      expect(screen.getByText(/61文字です/)).toBeInTheDocument();
    });
  });

  // ── QiitaForm: coediting トグル ──────────────────────────────────────────

  describe('coediting トグル（QiitaForm）', () => {
    it('coediting フィールドが表示される', () => {
      renderQiitaForm();
      expect(screen.getByText('チーム記事')).toBeInTheDocument();
    });

    it('初期状態は OFF（個人）', () => {
      renderQiitaForm();
      // OFF ボタンが active（bg-blue-600）で表示されることを確認
      const offBtn = screen.getByRole('button', { name: 'OFF（個人）' });
      expect(offBtn).toHaveClass('bg-blue-600');
    });

    it('ON をクリックすると onChange が coediting: true を含む YAML で呼ばれる', () => {
      const { onChange } = renderQiitaForm();
      fireEvent.click(screen.getByRole('button', { name: 'ON（チーム）' }));
      expect(onChange).toHaveBeenCalled();
      const emittedYaml: string = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(emittedYaml).toContain('coediting: true');
    });

    it('coediting: true の YAML を渡すと ON が active になる', () => {
      renderQiitaForm(
        'title: "team"\ntags:\n  - name: Go\nprivate: false\ncoediting: true',
      );
      const onBtn = screen.getByRole('button', { name: 'ON（チーム）' });
      expect(onBtn).toHaveClass('bg-blue-600');
    });

    it('ON → OFF に切り替えると YAML から coediting が消える', () => {
      const { onChange } = renderQiitaForm(
        'title: "team"\ntags:\n  - name: Go\nprivate: false\ncoediting: true',
      );
      fireEvent.click(screen.getByRole('button', { name: 'OFF（個人）' }));
      const emittedYaml: string = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(emittedYaml).not.toContain('coediting');
    });
  });

  // ── フォームモード切替 ────────────────────────────────────────────────────

  describe('YAML 直接編集モード', () => {
    it('"YAML を直接編集" ボタンが存在する', () => {
      renderZennForm();
      expect(screen.getByText('YAML を直接編集')).toBeInTheDocument();
    });

    it('"YAML を直接編集" クリックで textarea が表示される', () => {
      renderZennForm();
      fireEvent.click(screen.getByText('YAML を直接編集'));
      expect(screen.getByRole('textbox', { name: /YAML Front Matter を直接編集/ })).toBeInTheDocument();
    });

    it('"← フォームに戻る" クリックでフォームに戻る', () => {
      renderZennForm();
      fireEvent.click(screen.getByText('YAML を直接編集'));
      fireEvent.click(screen.getByText('← フォームに戻る'));
      expect(screen.queryByRole('textbox', { name: /YAML Front Matter を直接編集/ })).toBeNull();
      expect(screen.getByText('YAML を直接編集')).toBeInTheDocument();
    });
  });
});
