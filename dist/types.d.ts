/**
 * Type definitions for buildlog format v2
 * Slim workflow format - prompts are the artifact
 */
export declare const BUILDLOG_VERSION = "2.0.0";
export type BuildlogFormat = 'slim' | 'full';
export type EditorType = 'cursor' | 'vscode' | 'windsurf' | 'zed' | 'neovim' | 'jetbrains' | 'openclaw' | 'other';
export type AIProvider = 'claude' | 'gpt' | 'copilot' | 'gemini' | 'other';
export type NoteCategory = 'explanation' | 'tip' | 'warning' | 'decision' | 'todo';
export type TerminalOutcome = 'success' | 'failure' | 'partial';
export type OutcomeStatus = 'success' | 'partial' | 'failure' | 'abandoned';
interface BaseStep {
    id?: string;
    timestamp: number;
    sequence?: number;
    index?: number;
}
export interface PromptStep extends BaseStep {
    type: 'prompt';
    content: string;
    context?: string[];
    intent?: string;
    response?: string;
}
export interface ActionStep extends BaseStep {
    type: 'action';
    summary: string;
    files?: string[];
    changeType?: 'created' | 'modified' | 'deleted' | 'mixed';
    filesCreated?: string[];
    filesModified?: string[];
    filesDeleted?: string[];
    packagesAdded?: string[];
    packagesRemoved?: string[];
    approach?: string;
    aiResponse?: string;
    diff?: string;
    diffs?: Record<string, string>;
}
export interface TerminalStep extends BaseStep {
    type: 'terminal';
    command: string;
    cwd?: string;
    outcome?: TerminalOutcome;
    summary?: string;
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
    label?: string;
    summary?: string;
    description?: string;
}
export interface ErrorStep extends BaseStep {
    type: 'error';
    message: string;
    stack?: string;
    resolution?: string;
    resolved?: boolean;
}
export type BuildlogStep = PromptStep | ActionStep | TerminalStep | NoteStep | CheckpointStep | ErrorStep;
export type StepType = BuildlogStep['type'];
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
    duration?: number;
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
export type Buildlog = BuildlogFile;
export declare const STEP_TYPE_ICONS: Record<StepType, string>;
export {};
//# sourceMappingURL=types.d.ts.map