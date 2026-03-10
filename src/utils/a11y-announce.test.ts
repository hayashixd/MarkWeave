import { describe, it, expect, beforeEach, vi } from 'vitest';
import { announcePolite, announceAssertive } from './a11y-announce';

describe('a11y-announce', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="aria-live-region" aria-live="polite" aria-atomic="true"></div>
      <div id="aria-alert-region" role="alert" aria-live="assertive" aria-atomic="true"></div>
    `;
  });

  it('announcePolite sets text in polite region after rAF', async () => {
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        cb(0);
        return 0;
      });

    announcePolite('ファイルを保存しました');

    const region = document.getElementById('aria-live-region');
    expect(region?.textContent).toBe('ファイルを保存しました');

    rafSpy.mockRestore();
  });

  it('announceAssertive sets text in assertive region after rAF', async () => {
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        cb(0);
        return 0;
      });

    announceAssertive('エラーが発生しました');

    const region = document.getElementById('aria-alert-region');
    expect(region?.textContent).toBe('エラーが発生しました');

    rafSpy.mockRestore();
  });

  it('does nothing when region element is missing', () => {
    document.body.innerHTML = '';
    // Should not throw
    announcePolite('test');
    announceAssertive('test');
  });
});
