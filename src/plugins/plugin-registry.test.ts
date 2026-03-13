import { describe, it, expect, beforeEach } from 'vitest';
import { pluginRegistry } from './plugin-registry';
import type { EditorPlugin } from './plugin-api';

function makePlugin(id: string, permissions: string[] = []): EditorPlugin {
  return {
    manifest: {
      id,
      name: `Plugin ${id}`,
      version: '1.0.0',
      description: 'A test plugin',
      permissions: permissions as never[],
      settings: [],
      minApiVersion: '1.0.0',
    },
    activate: () => {},
  };
}

describe('pluginRegistry', () => {
  beforeEach(() => {
    // Cleanup all plugins
    for (const p of pluginRegistry.getAll()) {
      pluginRegistry.unregister(p.manifest.id);
    }
  });

  it('registers a plugin', () => {
    const p = makePlugin('test-1');
    pluginRegistry.register(p);
    expect(pluginRegistry.has('test-1')).toBe(true);
    expect(pluginRegistry.get('test-1')).toBe(p);
  });

  it('unregisters a plugin', () => {
    pluginRegistry.register(makePlugin('test-1'));
    pluginRegistry.unregister('test-1');
    expect(pluginRegistry.has('test-1')).toBe(false);
  });

  it('getAll returns all plugins', () => {
    pluginRegistry.register(makePlugin('a'));
    pluginRegistry.register(makePlugin('b'));
    expect(pluginRegistry.getAll()).toHaveLength(2);
  });

  it('returns undefined for non-existent plugin', () => {
    expect(pluginRegistry.get('nonexistent')).toBeUndefined();
  });

  it('has returns false for non-existent plugin', () => {
    expect(pluginRegistry.has('nonexistent')).toBe(false);
  });

  it('hasPermission returns true for declared permission', () => {
    pluginRegistry.register(makePlugin('test', ['editor:read', 'editor:write']));
    expect(pluginRegistry.hasPermission('test', 'editor:read')).toBe(true);
    expect(pluginRegistry.hasPermission('test', 'editor:write')).toBe(true);
  });

  it('hasPermission returns false for undeclared permission', () => {
    pluginRegistry.register(makePlugin('test', ['editor:read']));
    expect(pluginRegistry.hasPermission('test', 'fs:write')).toBe(false);
  });

  it('hasPermission returns false for non-existent plugin', () => {
    expect(pluginRegistry.hasPermission('nonexistent', 'editor:read')).toBe(false);
  });

  it('overwrites plugin on re-register', () => {
    pluginRegistry.register(makePlugin('test'));
    const p2 = makePlugin('test');
    pluginRegistry.register(p2);
    expect(pluginRegistry.get('test')).toBe(p2);
    expect(pluginRegistry.getAll()).toHaveLength(1);
  });
});
