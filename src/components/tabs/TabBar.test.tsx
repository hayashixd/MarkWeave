import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TabBar } from './TabBar';
import { useTabStore } from '../../store/tabStore';

describe('TabBar accessibility', () => {
  beforeEach(() => {
    useTabStore.setState({
      tabs: [
        {
          id: 'tab-1',
          filePath: '/tmp/one.md',
          fileName: 'one.md',
          isDirty: false,
          content: '',
          savedContent: '',
          encoding: 'UTF-8',
          lineEnding: 'LF',
          fileType: 'markdown',
          isReadOnly: false,
        },
        {
          id: 'tab-2',
          filePath: '/tmp/two.md',
          fileName: 'two.md',
          isDirty: true,
          content: 'draft',
          savedContent: '',
          encoding: 'UTF-8',
          lineEnding: 'LF',
          fileType: 'markdown',
          isReadOnly: false,
        },
      ],
      activeTabId: 'tab-1',
    });
  });

  it('renders tablist semantics', () => {
    render(<TabBar />);

    expect(screen.getByRole('tablist', { name: '開いているファイル' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /one.md/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('moves active tab with arrow key', () => {
    render(<TabBar />);

    const firstTab = screen.getByRole('tab', { name: /one.md/ });
    fireEvent.keyDown(firstTab, { key: 'ArrowRight' });

    expect(useTabStore.getState().activeTabId).toBe('tab-2');
  });

  it('closes active tab with Delete key', () => {
    const onCloseTab = vi.fn();
    render(<TabBar onCloseTab={onCloseTab} />);

    const secondTab = screen.getByRole('tab', { name: /two.md/ });
    fireEvent.keyDown(secondTab, { key: 'Delete' });

    expect(onCloseTab).toHaveBeenCalledWith('tab-2', true);
  });
});
