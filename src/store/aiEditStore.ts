/**
 * AI 編集ストア（ai-edit-design.md 準拠）
 *
 * エディタ状態と連動する AI インライン編集の状態管理。
 * Zustand セレクターは必ず細粒度にする（CLAUDE.md パフォーマンス原則 1）。
 */

import { create } from 'zustand';
import type {
  AiStreamState,
  ReferenceFile,
  DiffSegment,
} from '../ai/edit/types';

interface AiEditState {
  // ストリーム状態
  streamState: AiStreamState;
  streamId: string | null;
  accumulated: string;
  error: string | null;

  // テンプレート
  selectedTemplateId: string | null;
  userInstruction: string;
  activeConstraints: boolean[];

  // 参考資料（タブ単位で管理）
  references: ReferenceFile[];

  // diff プレビュー
  diffSegments: DiffSegment[];
  originalText: string;
  selectionFrom: number | null;
  selectionTo: number | null;

  // トークン使用量
  inputTokens: number;
  outputTokens: number;

  // パネル表示
  panelOpen: boolean;
  advancedMode: boolean;
}

interface AiEditActions {
  // ストリーム制御
  startStream: (streamId: string) => void;
  updateAccumulated: (delta: string, accumulated: string) => void;
  finishStream: (content: string, inputTokens: number, outputTokens: number) => void;
  setError: (message: string) => void;
  resetStream: () => void;

  // テンプレート
  setSelectedTemplateId: (id: string) => void;
  setUserInstruction: (text: string) => void;
  setActiveConstraints: (constraints: boolean[]) => void;

  // 参考資料
  addReference: (ref: ReferenceFile) => void;
  removeReference: (path: string) => void;
  clearReferences: () => void;

  // diff
  setDiff: (segments: DiffSegment[], original: string, from: number, to: number) => void;
  clearDiff: () => void;

  // パネル
  openPanel: () => void;
  closePanel: () => void;
  toggleAdvancedMode: () => void;
}

export const useAiEditStore = create<AiEditState & AiEditActions>((set) => ({
  // 初期状態
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

  // ストリーム制御
  startStream: (streamId) =>
    set({
      streamState: 'streaming',
      streamId,
      accumulated: '',
      error: null,
      diffSegments: [],
      inputTokens: 0,
      outputTokens: 0,
    }),

  updateAccumulated: (_delta, accumulated) =>
    set({ accumulated }),

  finishStream: (content, inputTokens, outputTokens) =>
    set({
      streamState: 'done',
      accumulated: content,
      inputTokens,
      outputTokens,
    }),

  setError: (message) =>
    set({ streamState: 'error', error: message }),

  resetStream: () =>
    set({
      streamState: 'idle',
      streamId: null,
      accumulated: '',
      error: null,
      diffSegments: [],
      inputTokens: 0,
      outputTokens: 0,
    }),

  // テンプレート
  setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),
  setUserInstruction: (text) => set({ userInstruction: text }),
  setActiveConstraints: (constraints) => set({ activeConstraints: constraints }),

  // 参考資料
  addReference: (ref) =>
    set((s) => ({
      references: s.references.some((r) => r.path === ref.path)
        ? s.references
        : [...s.references, ref],
    })),

  removeReference: (path) =>
    set((s) => ({
      references: s.references.filter((r) => r.path !== path),
    })),

  clearReferences: () => set({ references: [] }),

  // diff
  setDiff: (segments, original, from, to) =>
    set({
      diffSegments: segments,
      originalText: original,
      selectionFrom: from,
      selectionTo: to,
    }),

  clearDiff: () =>
    set({
      diffSegments: [],
      originalText: '',
      selectionFrom: null,
      selectionTo: null,
    }),

  // パネル
  openPanel: () => set({ panelOpen: true }),
  closePanel: () =>
    set({
      panelOpen: false,
      streamState: 'idle',
      streamId: null,
      accumulated: '',
      error: null,
      diffSegments: [],
    }),
  toggleAdvancedMode: () => set((s) => ({ advancedMode: !s.advancedMode })),
}));
