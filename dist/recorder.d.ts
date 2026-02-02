import type { BuildlogFile, BuildlogStep, BuildlogMetadata, NoteCategory, OutcomeStatus, AIProvider } from './types.js';
export type RecorderState = 'idle' | 'recording' | 'paused';
export interface RecorderConfig {
    /** Whether to include full AI responses and diffs (full format) */
    fullFormat: boolean;
    /** Default AI provider */
    aiProvider: AIProvider;
    /** Model name */
    model?: string;
}
export interface RecordingSession {
    id: string;
    title: string;
    startedAt: number;
    steps: BuildlogStep[];
    sequenceCounter: number;
    metadata: Partial<BuildlogMetadata>;
    filesCreated: Set<string>;
    filesModified: Set<string>;
}
export interface OpenClawEvent {
    type: 'user_message' | 'assistant_message' | 'file_change' | 'terminal_command' | 'tool_use';
    timestamp: number;
    data: unknown;
}
export interface UserMessageEvent extends OpenClawEvent {
    type: 'user_message';
    data: {
        content: string;
        attachments?: Array<{
            name: string;
            content: string;
        }>;
    };
}
export interface AssistantMessageEvent extends OpenClawEvent {
    type: 'assistant_message';
    data: {
        content: string;
        toolCalls?: Array<{
            name: string;
            arguments: Record<string, unknown>;
        }>;
    };
}
export interface FileChangeEvent extends OpenClawEvent {
    type: 'file_change';
    data: {
        path: string;
        action: 'create' | 'modify' | 'delete';
        diff?: string;
    };
}
export interface TerminalCommandEvent extends OpenClawEvent {
    type: 'terminal_command';
    data: {
        command: string;
        output?: string;
        exitCode?: number;
    };
}
type EventHandler = (event: OpenClawEvent) => void;
/**
 * BuildlogRecorder v2 - Slim workflow format
 *
 * Key change from v1: Prompts are the primary artifact.
 * We capture the workflow, not the full file contents.
 *
 * States: idle -> recording <-> paused -> idle
 */
export declare class BuildlogRecorder {
    private state;
    private session;
    private config;
    private eventHandlers;
    private lastPromptStep;
    private pendingFileChanges;
    constructor(config?: Partial<RecorderConfig>);
    /**
     * Get current recorder state
     */
    getState(): RecorderState;
    /**
     * Get current session if recording
     */
    getSession(): RecordingSession | null;
    /**
     * Check if actively recording (not paused)
     */
    isRecording(): boolean;
    /**
     * Start a new recording session
     */
    start(title: string, metadata?: Partial<BuildlogMetadata>): void;
    /**
     * Stop recording and return the buildlog
     */
    stop(outcome?: {
        status: OutcomeStatus;
        summary: string;
    }): BuildlogFile | null;
    /**
     * Pause recording
     */
    pause(): void;
    /**
     * Resume recording
     */
    resume(): void;
    /**
     * Process an OpenClaw event
     */
    handleEvent(event: OpenClawEvent): void;
    /**
     * Manually add a prompt step
     */
    addPrompt(content: string, options?: {
        context?: string[];
        intent?: string;
    }): void;
    /**
     * Manually add an action step
     */
    addAction(summary: string, options?: {
        filesCreated?: string[];
        filesModified?: string[];
        filesDeleted?: string[];
        approach?: string;
        aiResponse?: string;
    }): void;
    /**
     * Add a note step
     */
    addNote(content: string, category?: NoteCategory): void;
    /**
     * Add a checkpoint step
     */
    addCheckpoint(label: string, summary?: string): void;
    /**
     * Track a file change for the current action
     */
    trackFileChange(path: string, changeType: 'created' | 'modified' | 'deleted'): void;
    /**
     * Add a terminal command step
     */
    addTerminal(command: string, cwd?: string, exitCode?: number): void;
    /**
     * Add an error step
     */
    addError(message: string, resolved?: boolean, resolution?: string): void;
    /**
     * Get recording status
     */
    getStatus(): {
        state: RecorderState;
        sessionId?: string;
        title?: string;
        stepCount: number;
        promptCount: number;
        duration: number;
    };
    /**
     * Convert session to Buildlog format
     */
    toBuildlog(outcome?: {
        status: OutcomeStatus;
        summary: string;
    }): BuildlogFile | null;
    /**
     * Subscribe to recorder events
     */
    on(event: string, handler: EventHandler): () => void;
    private handleUserMessage;
    private handleAssistantMessage;
    private handleFileChange;
    private handleTerminalCommand;
    /**
     * Flush pending file changes into an action step
     */
    private flushPendingChanges;
    private generateActionSummary;
    private getTimestamp;
    private generateId;
    private emit;
}
export {};
//# sourceMappingURL=recorder.d.ts.map