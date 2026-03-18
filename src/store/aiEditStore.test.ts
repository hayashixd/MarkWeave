import { describe, it, expect, beforeEach } from 'vitest';
import { useAiEditStore } from './aiEditStore';
import type { ReferenceFile, DiffSegment } from '../ai/edit/types';

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function makeRef(path: string): ReferenceFile {
  return { path, name: path.split('/').pop()!, content: 'content', estimatedTokens: 100 };
}

function makeSegments(): DiffSegment[] {
  return [
    { type: 'unchanged', text: 'unchanged' },
    { type: 'removed', text: 'old' },
    { type: 'added', text: 'new' },
  ];
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe('aiEditStore', () => {
  beforeEach(() => {
    // 各テスト前にストアを初期状態にリセット
    useAiEditStore.setState({
      streamState: 'idle',
      streamId: null,
      accumulated: '',
      error: null,
      selectedTemplateId: null,
      userInstruction: '',
      activeConstraints: [],
      references: [],
      diffSegments: [],
      originalText: '',
      selectionFrom: null,
      selectionTo: null,
      inputTokens: 0,
      outputTokens: 0,
      panelOpen: false,
      advancedMode: false,
    });
  });

  // ── 初期状態 ─────────────────────────────────────────────────────────────────

  describe('初期状態', () => {
    it('streamState が idle', () => {
      expect(useAiEditStore.getState().streamState).toBe('idle');
    });

    it('panelOpen が false', () => {
      expect(useAiEditStore.getState().panelOpen).toBe(false);
    });

    it('references が空配列', () => {
      expect(useAiEditStore.getState().references).toEqual([]);
    });

    it('inputTokens / outputTokens が 0', () => {
      const { inputTokens, outputTokens } = useAiEditStore.getState();
      expect(inputTokens).toBe(0);
      expect(outputTokens).toBe(0);
    });
  });

  // ── startStream ───────────────────────────────────────────────────────────────

  describe('startStream', () => {
    it('streamState が streaming になる', () => {
      useAiEditStore.getState().startStream('sid-1');
      expect(useAiEditStore.getState().streamState).toBe('streaming');
    });

    it('streamId が設定される', () => {
      useAiEditStore.getState().startStream('my-stream');
      expect(useAiEditStore.getState().streamId).toBe('my-stream');
    });

    it('accumulated がクリアされる', () => {
      useAiEditStore.setState({ accumulated: '既存テキスト' });
      useAiEditStore.getState().startStream('s');
      expect(useAiEditStore.getState().accumulated).toBe('');
    });

    it('error がクリアされる', () => {
      useAiEditStore.setState({ error: 'previous error' });
      useAiEditStore.getState().startStream('s');
      expect(useAiEditStore.getState().error).toBeNull();
    });

    it('diffSegments がクリアされる', () => {
      useAiEditStore.setState({ diffSegments: makeSegments() });
      useAiEditStore.getState().startStream('s');
      expect(useAiEditStore.getState().diffSegments).toEqual([]);
    });

    it('inputTokens / outputTokens がリセットされる', () => {
      useAiEditStore.setState({ inputTokens: 999, outputTokens: 888 });
      useAiEditStore.getState().startStream('s');
      expect(useAiEditStore.getState().inputTokens).toBe(0);
      expect(useAiEditStore.getState().outputTokens).toBe(0);
    });
  });

  // ── updateAccumulated ─────────────────────────────────────────────────────────

  describe('updateAccumulated', () => {
    it('accumulated が更新される', () => {
      useAiEditStore.getState().updateAccumulated('hello', 'hello');
      expect(useAiEditStore.getState().accumulated).toBe('hello');
    });

    it('delta は使われず accumulated の値が直接セットされる', () => {
      useAiEditStore.getState().updateAccumulated('delta-only', 'full-accumulated');
      expect(useAiEditStore.getState().accumulated).toBe('full-accumulated');
    });
  });

  // ── finishStream ──────────────────────────────────────────────────────────────

  describe('finishStream', () => {
    it('streamState が done になる', () => {
      useAiEditStore.getState().finishStream('final content', 1000, 500);
      expect(useAiEditStore.getState().streamState).toBe('done');
    });

    it('content が accumulated にセットされる', () => {
      useAiEditStore.getState().finishStream('final text', 0, 0);
      expect(useAiEditStore.getState().accumulated).toBe('final text');
    });

    it('inputTokens / outputTokens がセットされる', () => {
      useAiEditStore.getState().finishStream('', 1234, 567);
      expect(useAiEditStore.getState().inputTokens).toBe(1234);
      expect(useAiEditStore.getState().outputTokens).toBe(567);
    });
  });

  // ── setError ──────────────────────────────────────────────────────────────────

  describe('setError', () => {
    it('streamState が error になる', () => {
      useAiEditStore.getState().setError('API エラー');
      expect(useAiEditStore.getState().streamState).toBe('error');
    });

    it('error メッセージがセットされる', () => {
      useAiEditStore.getState().setError('ネットワークエラー');
      expect(useAiEditStore.getState().error).toBe('ネットワークエラー');
    });
  });

  // ── resetStream ───────────────────────────────────────────────────────────────

  describe('resetStream', () => {
    it('streamState が idle に戻る', () => {
      useAiEditStore.setState({ streamState: 'done' });
      useAiEditStore.getState().resetStream();
      expect(useAiEditStore.getState().streamState).toBe('idle');
    });

    it('streamId が null になる', () => {
      useAiEditStore.setState({ streamId: 'some-id' });
      useAiEditStore.getState().resetStream();
      expect(useAiEditStore.getState().streamId).toBeNull();
    });

    it('accumulated / error / diffSegments / tokens が全てクリアされる', () => {
      useAiEditStore.setState({
        accumulated: 'text',
        error: 'err',
        diffSegments: makeSegments(),
        inputTokens: 100,
        outputTokens: 50,
      });
      useAiEditStore.getState().resetStream();
      const s = useAiEditStore.getState();
      expect(s.accumulated).toBe('');
      expect(s.error).toBeNull();
      expect(s.diffSegments).toEqual([]);
      expect(s.inputTokens).toBe(0);
      expect(s.outputTokens).toBe(0);
    });
  });

  // ── テンプレート ──────────────────────────────────────────────────────────────

  describe('setSelectedTemplateId', () => {
    it('selectedTemplateId が更新される', () => {
      useAiEditStore.getState().setSelectedTemplateId('builtin-proofread');
      expect(useAiEditStore.getState().selectedTemplateId).toBe('builtin-proofread');
    });
  });

  describe('setUserInstruction', () => {
    it('userInstruction が更新される', () => {
      useAiEditStore.getState().setUserInstruction('簡潔にして');
      expect(useAiEditStore.getState().userInstruction).toBe('簡潔にして');
    });
  });

  describe('setActiveConstraints', () => {
    it('activeConstraints が更新される', () => {
      useAiEditStore.getState().setActiveConstraints([true, false, true]);
      expect(useAiEditStore.getState().activeConstraints).toEqual([true, false, true]);
    });
  });

  // ── 参考資料 ──────────────────────────────────────────────────────────────────

  describe('addReference', () => {
    it('新規ファイルが追加される', () => {
      useAiEditStore.getState().addReference(makeRef('/a.md'));
      expect(useAiEditStore.getState().references).toHaveLength(1);
    });

    it('同じ path のファイルは重複追加されない', () => {
      useAiEditStore.getState().addReference(makeRef('/dup.md'));
      useAiEditStore.getState().addReference(makeRef('/dup.md'));
      expect(useAiEditStore.getState().references).toHaveLength(1);
    });

    it('異なる path のファイルは両方追加される', () => {
      useAiEditStore.getState().addReference(makeRef('/a.md'));
      useAiEditStore.getState().addReference(makeRef('/b.md'));
      expect(useAiEditStore.getState().references).toHaveLength(2);
    });
  });

  describe('removeReference', () => {
    it('指定した path のファイルが削除される', () => {
      useAiEditStore.setState({ references: [makeRef('/a.md'), makeRef('/b.md')] });
      useAiEditStore.getState().removeReference('/a.md');
      expect(useAiEditStore.getState().references).toHaveLength(1);
      expect(useAiEditStore.getState().references[0]!.path).toBe('/b.md');
    });

    it('存在しない path を削除しても他のファイルは変わらない', () => {
      useAiEditStore.setState({ references: [makeRef('/a.md')] });
      useAiEditStore.getState().removeReference('/nonexistent.md');
      expect(useAiEditStore.getState().references).toHaveLength(1);
    });
  });

  describe('clearReferences', () => {
    it('全参考資料がクリアされる', () => {
      useAiEditStore.setState({ references: [makeRef('/a.md'), makeRef('/b.md')] });
      useAiEditStore.getState().clearReferences();
      expect(useAiEditStore.getState().references).toEqual([]);
    });
  });

  // ── diff ──────────────────────────────────────────────────────────────────────

  describe('setDiff', () => {
    it('diffSegments / originalText / selectionFrom / selectionTo がセットされる', () => {
      const segs = makeSegments();
      useAiEditStore.getState().setDiff(segs, 'original text', 10, 50);
      const s = useAiEditStore.getState();
      expect(s.diffSegments).toEqual(segs);
      expect(s.originalText).toBe('original text');
      expect(s.selectionFrom).toBe(10);
      expect(s.selectionTo).toBe(50);
    });
  });

  describe('clearDiff', () => {
    it('diffSegments / originalText / selection 位置がクリアされる', () => {
      useAiEditStore.setState({
        diffSegments: makeSegments(),
        originalText: 'text',
        selectionFrom: 5,
        selectionTo: 20,
      });
      useAiEditStore.getState().clearDiff();
      const s = useAiEditStore.getState();
      expect(s.diffSegments).toEqual([]);
      expect(s.originalText).toBe('');
      expect(s.selectionFrom).toBeNull();
      expect(s.selectionTo).toBeNull();
    });
  });

  // ── パネル ────────────────────────────────────────────────────────────────────

  describe('openPanel', () => {
    it('panelOpen が true になる', () => {
      useAiEditStore.getState().openPanel();
      expect(useAiEditStore.getState().panelOpen).toBe(true);
    });
  });

  describe('closePanel', () => {
    it('panelOpen が false になる', () => {
      useAiEditStore.setState({ panelOpen: true });
      useAiEditStore.getState().closePanel();
      expect(useAiEditStore.getState().panelOpen).toBe(false);
    });

    it('ストリーム状態も合わせてリセットされる', () => {
      useAiEditStore.setState({
        panelOpen: true,
        streamState: 'done',
        streamId: 'sid',
        accumulated: 'text',
        error: 'err',
        diffSegments: makeSegments(),
      });
      useAiEditStore.getState().closePanel();
      const s = useAiEditStore.getState();
      expect(s.streamState).toBe('idle');
      expect(s.streamId).toBeNull();
      expect(s.accumulated).toBe('');
      expect(s.error).toBeNull();
      expect(s.diffSegments).toEqual([]);
    });
  });

  describe('toggleAdvancedMode', () => {
    it('false → true にトグルされる', () => {
      expect(useAiEditStore.getState().advancedMode).toBe(false);
      useAiEditStore.getState().toggleAdvancedMode();
      expect(useAiEditStore.getState().advancedMode).toBe(true);
    });

    it('true → false にトグルされる', () => {
      useAiEditStore.setState({ advancedMode: true });
      useAiEditStore.getState().toggleAdvancedMode();
      expect(useAiEditStore.getState().advancedMode).toBe(false);
    });
  });

  // ── 状態遷移シーケンス ────────────────────────────────────────────────────────

  describe('状態遷移シーケンス', () => {
    it('idle → streaming → done の正常フロー', () => {
      const store = useAiEditStore.getState();

      store.startStream('s1');
      expect(useAiEditStore.getState().streamState).toBe('streaming');

      store.updateAccumulated('partial', 'partial text');
      expect(useAiEditStore.getState().accumulated).toBe('partial text');

      store.finishStream('final text', 500, 200);
      expect(useAiEditStore.getState().streamState).toBe('done');
      expect(useAiEditStore.getState().accumulated).toBe('final text');
    });

    it('idle → streaming → error の失敗フロー', () => {
      const store = useAiEditStore.getState();

      store.startStream('s2');
      expect(useAiEditStore.getState().streamState).toBe('streaming');

      store.setError('API rate limit exceeded');
      expect(useAiEditStore.getState().streamState).toBe('error');
      expect(useAiEditStore.getState().error).toBe('API rate limit exceeded');
    });

    it('done → resetStream → idle', () => {
      useAiEditStore.setState({ streamState: 'done', accumulated: 'text' });
      useAiEditStore.getState().resetStream();
      expect(useAiEditStore.getState().streamState).toBe('idle');
      expect(useAiEditStore.getState().accumulated).toBe('');
    });
  });
});
