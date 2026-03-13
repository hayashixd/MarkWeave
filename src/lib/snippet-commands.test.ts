import { describe, it, expect } from 'vitest';
import { snippetsToCommands } from './snippet-commands';

describe('snippet-commands', () => {
  const mockSnippets = [
    {
      id: 'sn1',
      name: 'Greeting',
      content: 'Hello, World!',
      keywords: 'greet hello',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'sn2',
      name: 'Long Snippet',
      content: 'This is a very long snippet content that exceeds the forty character truncation limit absolutely.',
      keywords: 'long test',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  it('converts snippets to slash command definitions', () => {
    const commands = snippetsToCommands(mockSnippets);
    expect(commands).toHaveLength(2);
  });

  it('prefixes command id with snippet-', () => {
    const commands = snippetsToCommands(mockSnippets);
    expect(commands[0]!.id).toBe('snippet-sn1');
    expect(commands[1]!.id).toBe('snippet-sn2');
  });

  it('sets category to snippet', () => {
    const commands = snippetsToCommands(mockSnippets);
    expect(commands.every((c) => c.category === 'snippet')).toBe(true);
  });

  it('uses snippet name as command name', () => {
    const commands = snippetsToCommands(mockSnippets);
    expect(commands[0]!.name).toBe('Greeting');
  });

  it('truncates long content in description', () => {
    const commands = snippetsToCommands(mockSnippets);
    expect(commands[1]!.description.length).toBeLessThanOrEqual(41); // 40 + '…'
    expect(commands[1]!.description).toContain('…');
  });

  it('does not truncate short content', () => {
    const commands = snippetsToCommands(mockSnippets);
    expect(commands[0]!.description).toBe('Hello, World!');
  });

  it('sets icon to 📌', () => {
    const commands = snippetsToCommands(mockSnippets);
    expect(commands[0]!.icon).toBe('📌');
  });

  it('includes Japanese keyword in keywords', () => {
    const commands = snippetsToCommands(mockSnippets);
    expect(commands[0]!.keywords).toContain('スニペット');
    expect(commands[0]!.keywords).toContain('snippet');
  });

  it('has an action function', () => {
    const commands = snippetsToCommands(mockSnippets);
    expect(typeof commands[0]!.action).toBe('function');
  });

  it('handles empty snippets array', () => {
    const commands = snippetsToCommands([]);
    expect(commands).toEqual([]);
  });
});
