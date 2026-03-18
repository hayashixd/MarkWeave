export interface TemplateConstraint {
  text: string;
  defaultEnabled: boolean;
}

export interface AiEditTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  source: 'builtin' | 'user';
  persona: string;
  task: string;
  constraints: TemplateConstraint[];
  outputFormat: string;
  autoSelect: {
    requiresSelection: boolean;
    cursorPosition?: 'end' | 'any';
    priority: number;
  };
}

export interface ReferenceFile {
  path: string;
  name: string;
  content: string;
  estimatedTokens: number;
}

export type AiStreamState = 'idle' | 'streaming' | 'done' | 'error';

export interface BuiltPrompt {
  system: string;
  user: string;
  estimatedInputTokens: number;
}

export interface PromptBuildContext {
  template: AiEditTemplate;
  document: string;
  selection?: string;
  userInstruction?: string;
  references: ReferenceFile[];
  activeConstraints: boolean[];
}

export interface DiffSegment {
  type: 'unchanged' | 'removed' | 'added';
  text: string;
}

export interface ContextBudget {
  modelMaxTokens: number;
  systemPrompt: number;
  references: number;
  document: number;
  reservedForOutput: number;
  available: number;
}
