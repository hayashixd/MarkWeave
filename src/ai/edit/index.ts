// AI 編集モジュール公開 API

export type {
  AiEditTemplate,
  TemplateConstraint,
  ReferenceFile,
  AiStreamState,
  BuiltPrompt,
  PromptBuildContext,
  DiffSegment,
  ContextBudget,
} from './types';

export { BUILTIN_TEMPLATES } from './templates/builtin';
export { autoSelectTemplate, type AutoSelectContext } from './auto-select';
export {
  estimateTokens,
  calculateBudget,
  validateBudget,
} from './context-budget';
export { buildPrompt } from './prompt-builder';
export {
  loadUserTemplates,
  saveUserTemplate,
  deleteUserTemplate,
} from './template-storage';
export { loadAllTemplates } from './template-registry';
export { getTemplateById } from './template-registry';
export { computeInlineDiff } from './diff';
export {
  listenAiStream,
  startAiStream,
  cancelAiStream,
  type StreamCallbacks,
  type AiStreamRequest,
  type StreamChunkPayload,
  type StreamDonePayload,
  type StreamErrorPayload,
} from './stream-listener';
export { acceptAiEdit, acceptAiContinue } from './accept-reject';
