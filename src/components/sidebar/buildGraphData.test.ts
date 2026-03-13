import { describe, it, expect } from 'vitest';
import { buildGraphData } from './buildGraphData';
import type { TabState } from '../../store/tabStore';

function makeTab(overrides: Partial<TabState>): TabState {
  return {
    id: 'tab-1',
    filePath: '/docs/note.md',
    fileName: 'note.md',
    content: '',
    savedContent: '',
    isDirty: false,
    ...overrides,
  };
}

describe('buildGraphData', () => {
  it('creates a node for each tab', () => {
    const tabs = [
      makeTab({ id: 'tab-1', filePath: '/a.md', fileName: 'a.md' }),
      makeTab({ id: 'tab-2', filePath: '/b.md', fileName: 'b.md' }),
    ];
    const { nodes } = buildGraphData(tabs, null);
    expect(nodes).toHaveLength(2);
  });

  it('marks active tab node', () => {
    const tabs = [makeTab({ id: 'tab-1', filePath: '/a.md', fileName: 'a.md' })];
    const { nodes } = buildGraphData(tabs, 'tab-1');
    expect(nodes[0]!.isActive).toBe(true);
  });

  it('extracts wikilinks and creates edges', () => {
    const tabs = [
      makeTab({ id: 'tab-1', filePath: '/a.md', fileName: 'a.md', content: 'See [[b]]' }),
      makeTab({ id: 'tab-2', filePath: '/b.md', fileName: 'b.md', content: '' }),
    ];
    const { edges } = buildGraphData(tabs, null);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.isUnresolved).toBe(false);
  });

  it('creates unresolved nodes for missing links', () => {
    const tabs = [
      makeTab({ id: 'tab-1', filePath: '/a.md', fileName: 'a.md', content: '[[nonexistent]]' }),
    ];
    const { nodes, edges } = buildGraphData(tabs, null);
    expect(nodes.length).toBe(2); // a + unresolved
    expect(edges[0]!.isUnresolved).toBe(true);
  });

  it('handles wikilinks with labels', () => {
    const tabs = [
      makeTab({ id: 'tab-1', filePath: '/a.md', fileName: 'a.md', content: '[[b|Link to B]]' }),
      makeTab({ id: 'tab-2', filePath: '/b.md', fileName: 'b.md', content: '' }),
    ];
    const { edges } = buildGraphData(tabs, null);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.isUnresolved).toBe(false);
  });

  it('deduplicates edges', () => {
    const tabs = [
      makeTab({ id: 'tab-1', filePath: '/a.md', fileName: 'a.md', content: '[[b]] and [[b]]' }),
      makeTab({ id: 'tab-2', filePath: '/b.md', fileName: 'b.md', content: '' }),
    ];
    const { edges } = buildGraphData(tabs, null);
    expect(edges).toHaveLength(1);
  });

  it('skips self-referencing links', () => {
    const tabs = [
      makeTab({ id: 'tab-1', filePath: '/a.md', fileName: 'a.md', content: '[[a]]' }),
    ];
    const { edges } = buildGraphData(tabs, null);
    expect(edges).toHaveLength(0);
  });

  it('updates linkCount for connected nodes', () => {
    const tabs = [
      makeTab({ id: 'tab-1', filePath: '/a.md', fileName: 'a.md', content: '[[b]]' }),
      makeTab({ id: 'tab-2', filePath: '/b.md', fileName: 'b.md', content: '' }),
    ];
    const { nodes } = buildGraphData(tabs, null);
    const nodeA = nodes.find((n) => n.name === 'a')!;
    const nodeB = nodes.find((n) => n.name === 'b')!;
    expect(nodeA.linkCount).toBe(1);
    expect(nodeB.linkCount).toBe(1);
  });

  it('extracts tags from front matter', () => {
    const tabs = [
      makeTab({
        id: 'tab-1',
        filePath: '/a.md',
        fileName: 'a.md',
        content: '---\ntags: [react, typescript]\n---\n# Content',
      }),
    ];
    const { nodes, allTags } = buildGraphData(tabs, null);
    expect(nodes[0]!.tags).toContain('react');
    expect(allTags).toContain('react');
    expect(allTags).toContain('typescript');
  });

  it('extracts title from front matter', () => {
    const tabs = [
      makeTab({
        id: 'tab-1',
        filePath: '/a.md',
        fileName: 'a.md',
        content: '---\ntitle: My Note\n---\n# Content',
      }),
    ];
    const { nodes } = buildGraphData(tabs, null);
    expect(nodes[0]!.title).toBe('My Note');
  });

  it('handles empty tabs array', () => {
    const { nodes, edges, allTags } = buildGraphData([], null);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
    expect(allTags).toHaveLength(0);
  });

  it('uses tab.id as nodeId when filePath is null', () => {
    const tabs = [
      makeTab({ id: 'tab-1', filePath: null, fileName: 'Untitled', content: '' }),
    ];
    const { nodes } = buildGraphData(tabs, null);
    expect(nodes[0]!.id).toBe('tab-1');
  });

  it('allTags are sorted', () => {
    const tabs = [
      makeTab({
        id: 'tab-1',
        filePath: '/a.md',
        fileName: 'a.md',
        content: '---\ntags: [zebra, apple, mango]\n---\n',
      }),
    ];
    const { allTags } = buildGraphData(tabs, null);
    const sorted = [...allTags].sort();
    expect(allTags).toEqual(sorted);
  });
});
