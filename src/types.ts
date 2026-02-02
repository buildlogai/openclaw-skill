/**
 * Type definitions for buildlog format v2
 * Slim workflow format - prompts are the artifact
 */

// =============================================================================
// CONSTANTS
// =============================================================================

export const BUILDLOG_VERSION = '2.0.0';
export type BuildlogFormat = 'slim' | 'full';

export type EditorType = 'cursor' | 'vscode' | 'windsurf' | 'zed' | 'neovim' | 'jetbrains' | 'openclaw' | 'other';
export type AIProvider = 'claude' | 'gpt' | 'copilot' | 'gemini' | 'other';
export type NoteCategory = 'explanation' | 'tip' | 'warning' | 'decision' | 'todo';
export type TerminalOutcome = 'success' | 'failure' | 'partial';
export type OutcomeStatus = 'success' | 'partial' | 'failure' | 'abandoned';

// =============================================================================
// STEP TYPES
// =============================================================================

interface BaseStep {
  id?: string;
  timestamp: number; // seconds since recording start
  sequence?: number;
  index?: number; // alias for sequence
}

export interface PromptStep extends BaseStep {
  type: 'prompt';
  content: string;
  context?: string[];
  intent?: string;
  response?: string; // Only in 'full' format
}

export interface ActionStep extends BaseStep {
  type: 'action';
  summary: string;
  files?: string[]; // shorthand for all affected files
  changeType?: 'created' | 'modified' | 'deleted' | 'mixed';
  filesCreated?: string[];
  filesModified?: string[];
  filesDeleted?: string[];
  packagesAdded?: string[];
  packagesRemoved?: string[];
  approach?: string;
  // Only in 'full' format:
  aiResponse?: string;
  diff?: string; // single diff
  diffs?: Record<string, string>;
}

export interface TerminalStep extends BaseStep {
  type: 'terminal';
  command: string;
  cwd?: string;
  outcome?: TerminalOutcome;
  summary?: string;
  // Only in 'full' format:
  output?: string;
  exitCode?: number;
}

export interface NoteStep extends BaseStep {
  type: 'note';
  content: string;
  category?: NoteCategory;
}

export interface CheckpointStep extends BaseStep {
  type: 'checkpoint';
  name?: string;
  label?: string; // alias for name
  summary?: string;
  description?: string; // alias for summary
}

export interface ErrorStep extends BaseStep {
  type: 'error';
  message: string;
  stack?: string;
  resolution?: string;
  resolved?: boolean;
}

export type BuildlogStep = 
  | PromptStep 
  | ActionStep 
  | TerminalStep 
  | NoteStep 
  | CheckpointStep 
  | ErrorStep;

export type StepType = BuildlogStep['type'];

// =============================================================================
// BUILDLOG FILE
// =============================================================================

export interface BuildlogAuthor {
  name?: string;
  username?: string;
  url?: string;
}

export interface BuildlogMetadata {
  id?: string;
  title: string;
  description?: string;
  author?: BuildlogAuthor;
  createdAt: string;
  durationSeconds?: number;
  duration?: number; // alias
  editor?: EditorType | string;
  aiProvider?: AIProvider | string;
  model?: string;
  language?: string;
  framework?: string;
  tags?: string[];
  replicable?: boolean;
  stepCount?: number;
  promptCount?: number;
  dependencies?: string[];
}

export interface BuildlogOutcome {
  status: OutcomeStatus | 'completed' | 'failed';
  summary: string;
  filesCreated?: number | string[];
  filesModified?: number | string[];
  canReplicate?: boolean;
  replicationNotes?: string;
}

export interface BuildlogFile {
  version: '2.0.0' | string;
  format: BuildlogFormat;
  metadata: BuildlogMetadata;
  steps: BuildlogStep[];
  outcome?: BuildlogOutcome;
}

// Legacy alias for compatibility
export type Buildlog = BuildlogFile;

// =============================================================================
// STEP ICONS
// =============================================================================

export const STEP_TYPE_ICONS: Record<StepType, string> = {
  prompt: '💬',
  action: '⚡',
  terminal: '🖥️',
  note: '📝',
  checkpoint: '🚩',
  error: '❌',
};

