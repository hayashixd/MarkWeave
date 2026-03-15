import { describe, it, expect, beforeEach } from 'vitest';
import { usePaneStore } from './paneStore';

describe('paneStore', () => {
  beforeEach(() => {
    usePaneStore.setState({
      layout: { type: 'single', splitRatio: 0.5 },
      panes: [{ id: 'pane-1', tabs: [], activeTabId: null }],
      activePaneId: 'pane-1',
      scrollSyncEnabled: true,
    });
  });

  // =========================================================================
  // splitPane
  // =========================================================================
  describe('splitPane', () => {
    it('splits horizontally', () => {
      usePaneStore.getState().splitPane('horizontal');
      const state = usePaneStore.getState();
      expect(state.layout.type).toBe('horizontal');
      expect(state.panes).toHaveLength(2);
      expect(state.activePaneId).toBe('pane-2');
    });

    it('splits vertically', () => {
      usePaneStore.getState().splitPane('vertical');
      expect(usePaneStore.getState().layout.type).toBe('vertical');
    });

    it('moves specified tab to new pane', () => {
      usePaneStore.setState({
        panes: [{ id: 'pane-1', tabs: ['tab-1', 'tab-2'], activeTabId: 'tab-1' }],
      });
      usePaneStore.getState().splitPane('horizontal', 'tab-2');

      const state = usePaneStore.getState();
      expect(state.panes[0]!.tabs).toEqual(['tab-1']);
      expect(state.panes[1]!.tabs).toEqual(['tab-2']);
      expect(state.panes[1]!.activeTabId).toBe('tab-2');
    });

    it('does nothing if already split', () => {
      usePaneStore.getState().splitPane('horizontal');
      usePaneStore.getState().splitPane('vertical');
      // Still horizontal, not re-split
      expect(usePaneStore.getState().layout.type).toBe('horizontal');
      expect(usePaneStore.getState().panes).toHaveLength(2);
    });

    it('updates pane1 activeTab when moving the active tab', () => {
      usePaneStore.setState({
        panes: [{ id: 'pane-1', tabs: ['tab-1', 'tab-2'], activeTabId: 'tab-2' }],
      });
      usePaneStore.getState().splitPane('horizontal', 'tab-2');
      expect(usePaneStore.getState().panes[0]!.activeTabId).toBe('tab-1');
    });
  });

  // =========================================================================
  // closePane
  // =========================================================================
  describe('closePane', () => {
    it('merges tabs when closing a pane', () => {
      usePaneStore.setState({
        layout: { type: 'horizontal', splitRatio: 0.5 },
        panes: [
          { id: 'pane-1', tabs: ['tab-1'], activeTabId: 'tab-1' },
          { id: 'pane-2', tabs: ['tab-2'], activeTabId: 'tab-2' },
        ],
        activePaneId: 'pane-2',
      });

      usePaneStore.getState().closePane('pane-2');
      const state = usePaneStore.getState();
      expect(state.layout.type).toBe('single');
      expect(state.panes).toHaveLength(1);
      expect(state.panes[0]!.tabs).toEqual(['tab-1', 'tab-2']);
    });

    it('does nothing in single mode', () => {
      usePaneStore.getState().closePane('pane-1');
      expect(usePaneStore.getState().panes).toHaveLength(1);
    });
  });

  // =========================================================================
  // moveTabToPane
  // =========================================================================
  describe('moveTabToPane', () => {
    beforeEach(() => {
      usePaneStore.setState({
        layout: { type: 'horizontal', splitRatio: 0.5 },
        panes: [
          { id: 'pane-1', tabs: ['tab-1', 'tab-2'], activeTabId: 'tab-1' },
          { id: 'pane-2', tabs: ['tab-3'], activeTabId: 'tab-3' },
        ],
        activePaneId: 'pane-1',
      });
    });

    it('moves tab between panes', () => {
      usePaneStore.getState().moveTabToPane('tab-2', 'pane-1', 'pane-2');
      const state = usePaneStore.getState();
      expect(state.panes[0]!.tabs).toEqual(['tab-1']);
      expect(state.panes[1]!.tabs).toEqual(['tab-3', 'tab-2']);
    });

    it('sets moved tab as active in target pane', () => {
      usePaneStore.getState().moveTabToPane('tab-2', 'pane-1', 'pane-2');
      expect(usePaneStore.getState().panes[1]!.activeTabId).toBe('tab-2');
    });

    it('closes source pane if it becomes empty', () => {
      usePaneStore.setState({
        layout: { type: 'horizontal', splitRatio: 0.5 },
        panes: [
          { id: 'pane-1', tabs: ['tab-1'], activeTabId: 'tab-1' },
          { id: 'pane-2', tabs: ['tab-3'], activeTabId: 'tab-3' },
        ],
      });
      usePaneStore.getState().moveTabToPane('tab-1', 'pane-1', 'pane-2');
      expect(usePaneStore.getState().layout.type).toBe('single');
    });

    it('does nothing if tab not in source pane', () => {
      usePaneStore.getState().moveTabToPane('tab-3', 'pane-1', 'pane-2');
      // tab-3 was never in pane-1, so nothing changes
      expect(usePaneStore.getState().panes[0]!.tabs).toEqual(['tab-1', 'tab-2']);
    });
  });

  // =========================================================================
  // setSplitRatio
  // =========================================================================
  describe('setSplitRatio', () => {
    it('sets ratio', () => {
      usePaneStore.getState().setSplitRatio(0.7);
      expect(usePaneStore.getState().layout.splitRatio).toBe(0.7);
    });

    it('clamps ratio to minimum 0.2', () => {
      usePaneStore.getState().setSplitRatio(0.1);
      expect(usePaneStore.getState().layout.splitRatio).toBe(0.2);
    });

    it('clamps ratio to maximum 0.8', () => {
      usePaneStore.getState().setSplitRatio(0.9);
      expect(usePaneStore.getState().layout.splitRatio).toBe(0.8);
    });
  });

  // =========================================================================
  // addTabToPane / removeTabFromPane
  // =========================================================================
  describe('addTabToPane', () => {
    it('adds tab to active pane by default', () => {
      usePaneStore.getState().addTabToPane('tab-1');
      expect(usePaneStore.getState().panes[0]!.tabs).toContain('tab-1');
      expect(usePaneStore.getState().panes[0]!.activeTabId).toBe('tab-1');
    });

    it('does not add duplicate tab', () => {
      usePaneStore.getState().addTabToPane('tab-1');
      usePaneStore.getState().addTabToPane('tab-1');
      expect(usePaneStore.getState().panes[0]!.tabs.filter((t) => t === 'tab-1')).toHaveLength(1);
    });
  });

  describe('removeTabFromPane', () => {
    it('removes tab and updates activeTabId', () => {
      usePaneStore.setState({
        panes: [{ id: 'pane-1', tabs: ['tab-1', 'tab-2'], activeTabId: 'tab-2' }],
      });
      usePaneStore.getState().removeTabFromPane('tab-2');
      const pane = usePaneStore.getState().panes[0]!;
      expect(pane.tabs).toEqual(['tab-1']);
      expect(pane.activeTabId).toBe('tab-1');
    });

    it('sets activeTabId to null when last tab removed', () => {
      usePaneStore.setState({
        panes: [{ id: 'pane-1', tabs: ['tab-1'], activeTabId: 'tab-1' }],
      });
      usePaneStore.getState().removeTabFromPane('tab-1');
      expect(usePaneStore.getState().panes[0]!.activeTabId).toBeNull();
    });
  });

  // =========================================================================
  // Helpers
  // =========================================================================
  describe('helpers', () => {
    it('getPaneForTab finds correct pane', () => {
      usePaneStore.setState({
        panes: [{ id: 'pane-1', tabs: ['tab-1'], activeTabId: 'tab-1' }],
      });
      expect(usePaneStore.getState().getPaneForTab('tab-1')?.id).toBe('pane-1');
      expect(usePaneStore.getState().getPaneForTab('nonexistent')).toBeUndefined();
    });

    it('getActivePane returns active pane', () => {
      expect(usePaneStore.getState().getActivePane()?.id).toBe('pane-1');
    });

    it('setScrollSyncEnabled toggles sync', () => {
      usePaneStore.getState().setScrollSyncEnabled(false);
      expect(usePaneStore.getState().scrollSyncEnabled).toBe(false);
      usePaneStore.getState().setScrollSyncEnabled(true);
      expect(usePaneStore.getState().scrollSyncEnabled).toBe(true);
    });
  });
});
