import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateMarkdownLinksInWorkspace,
  updateWikilinksInWorkspace,
  undoWikilinkUpdate,
} from './link-updater';

// Tauri invoke のモック
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('updateMarkdownLinksInWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list_markdown_files 失敗時は affectedCount=0 を返す', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('not available'));

    const result = await updateMarkdownLinksInWorkspace(
      '/ws/old.md',
      '/ws/new.md',
      '/ws',
      { dryRun: true },
    );

    expect(result.affectedCount).toBe(0);
    expect(result.oldRelative).toBe('old.md');
    expect(result.newRelative).toBe('new.md');
  });

  it('dryRun=true のとき write_file を呼ばない', async () => {
    mockInvoke
      .mockResolvedValueOnce(['/ws/other.md']) // list_markdown_files
      .mockResolvedValueOnce('[link](old.md)'); // read_file

    const result = await updateMarkdownLinksInWorkspace(
      '/ws/old.md',
      '/ws/new.md',
      '/ws',
      { dryRun: true },
    );

    expect(result.affectedCount).toBe(1);
    // write_file は呼ばれない
    const writeCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'write_file');
    expect(writeCalls).toHaveLength(0);
  });

  it('dryRun=false のとき write_file を呼ぶ', async () => {
    mockInvoke
      .mockResolvedValueOnce(['/ws/other.md']) // list_markdown_files
      .mockResolvedValueOnce('[link](old.md)') // read_file
      .mockResolvedValueOnce(undefined); // write_file

    const result = await updateMarkdownLinksInWorkspace(
      '/ws/old.md',
      '/ws/new.md',
      '/ws',
      { dryRun: false },
    );

    expect(result.affectedCount).toBe(1);
    const writeCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'write_file');
    expect(writeCalls).toHaveLength(1);
    expect(writeCalls[0]![1]).toMatchObject({ content: '[link](new.md)' });
  });

  it('移動先ファイル自身はスキップする', async () => {
    mockInvoke
      .mockResolvedValueOnce(['/ws/new.md']) // list_markdown_files (移動先と同じ)
    ;

    const result = await updateMarkdownLinksInWorkspace(
      '/ws/old.md',
      '/ws/new.md',
      '/ws',
      { dryRun: true },
    );

    expect(result.affectedCount).toBe(0);
  });

  it('リンクを含まないファイルはカウントしない', async () => {
    mockInvoke
      .mockResolvedValueOnce(['/ws/other.md']) // list_markdown_files
      .mockResolvedValueOnce('# Hello\n\nNo links here.'); // read_file

    const result = await updateMarkdownLinksInWorkspace(
      '/ws/old.md',
      '/ws/new.md',
      '/ws',
      { dryRun: true },
    );

    expect(result.affectedCount).toBe(0);
  });

  it('アンカー付きリンクも正しく置換する', async () => {
    mockInvoke
      .mockResolvedValueOnce(['/ws/other.md'])
      .mockResolvedValueOnce('[sec](old.md#section)')
      .mockResolvedValueOnce(undefined);

    const result = await updateMarkdownLinksInWorkspace(
      '/ws/old.md',
      '/ws/new.md',
      '/ws',
      { dryRun: false },
    );

    expect(result.affectedCount).toBe(1);
    const writeCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'write_file');
    expect(writeCalls[0]![1]).toMatchObject({ content: '[sec](new.md#section)' });
  });

  it('oldRelative/newRelative はワークスペース相対パスを返す', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const result = await updateMarkdownLinksInWorkspace(
      '/workspace/docs/old.md',
      '/workspace/docs/new.md',
      '/workspace',
      { dryRun: true },
    );

    expect(result.oldRelative).toBe('docs/old.md');
    expect(result.newRelative).toBe('docs/new.md');
  });
});

describe('updateWikilinksInWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('名前が変わらない（ディレクトリ移動のみ）は affectedCount=0', async () => {
    const result = await updateWikilinksInWorkspace(
      '/ws/sub/note.md',
      '/ws/other/note.md',
      '/ws',
      false,
    );

    expect(result.affectedCount).toBe(0);
    expect(result.oldName).toBe('note');
    expect(result.newName).toBe('note');
    // invoke は呼ばれない
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('list_markdown_files 失敗時は affectedCount=0 を返す', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('not available'));

    const result = await updateWikilinksInWorkspace(
      '/ws/old-note.md',
      '/ws/new-note.md',
      '/ws',
      true,
    );

    expect(result.affectedCount).toBe(0);
  });

  it('dryRun=true のとき write_file を呼ばない', async () => {
    mockInvoke
      .mockResolvedValueOnce(['/ws/other.md'])
      .mockResolvedValueOnce('[[old-note]] は重要');

    const result = await updateWikilinksInWorkspace(
      '/ws/old-note.md',
      '/ws/new-note.md',
      '/ws',
      true,
    );

    expect(result.affectedCount).toBe(1);
    const writeCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'write_file');
    expect(writeCalls).toHaveLength(0);
    expect(result.undoData.size).toBe(0);
  });

  it('dryRun=false のとき Wikiリンクを置換して write_file を呼ぶ', async () => {
    mockInvoke
      .mockResolvedValueOnce(['/ws/other.md'])
      .mockResolvedValueOnce('[[old-note]] と [[old-note|表示テキスト]]')
      .mockResolvedValueOnce(undefined);

    const result = await updateWikilinksInWorkspace(
      '/ws/old-note.md',
      '/ws/new-note.md',
      '/ws',
      false,
    );

    expect(result.affectedCount).toBe(1);
    const writeCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'write_file');
    expect(writeCalls).toHaveLength(1);
    const newContent = writeCalls[0]![1].content as string;
    expect(newContent).toContain('[[new-note]]');
    expect(newContent).toContain('[[new-note|表示テキスト]]');
  });

  it('[[name#heading]] 形式のアンカー付きWikiリンクを置換する', async () => {
    mockInvoke
      .mockResolvedValueOnce(['/ws/other.md'])
      .mockResolvedValueOnce('詳細は [[old-note#section1]] を参照')
      .mockResolvedValueOnce(undefined);

    await updateWikilinksInWorkspace('/ws/old-note.md', '/ws/new-note.md', '/ws', false);

    const writeCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'write_file');
    expect(writeCalls[0]![1].content).toContain('[[new-note#section1]]');
  });

  it('dryRun=false のとき undoData に旧内容を保持する', async () => {
    const original = '[[old-note]] の内容';
    mockInvoke
      .mockResolvedValueOnce(['/ws/other.md'])
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(undefined);

    const result = await updateWikilinksInWorkspace(
      '/ws/old-note.md',
      '/ws/new-note.md',
      '/ws',
      false,
    );

    expect(result.undoData.get('/ws/other.md')).toBe(original);
  });
});

describe('undoWikilinkUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('undoData の各ファイルに write_file を呼ぶ', async () => {
    mockInvoke.mockResolvedValue(undefined);

    const undoData = new Map([
      ['/ws/a.md', 'original a'],
      ['/ws/b.md', 'original b'],
    ]);

    const count = await undoWikilinkUpdate(undoData);

    expect(count).toBe(2);
    const writeCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'write_file');
    expect(writeCalls).toHaveLength(2);
  });

  it('write_file 失敗時はカウントしない', async () => {
    mockInvoke.mockRejectedValue(new Error('write failed'));

    const undoData = new Map([['/ws/a.md', 'old']]);
    const count = await undoWikilinkUpdate(undoData);

    expect(count).toBe(0);
  });

  it('空の undoData は 0 を返す', async () => {
    const count = await undoWikilinkUpdate(new Map());
    expect(count).toBe(0);
  });
});
