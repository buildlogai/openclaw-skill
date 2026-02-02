import type { Buildlog, BuildlogEntry, BuildlogMetadata, FileChange, TerminalCommand } from './types.js';
export type RecorderState = 'idle' | 'recording' | 'paused';
export interface RecorderConfig {
    includeFileContents: boolean;
    maxFileSizeKb: number;
}
export interface Note {
    timestamp: number;
    text: string;
    entryIndex: number;
}
export interface Chapter {
    title: string;
    entryIndex: number;
    timestamp: number;
}
export interface RecordingSession {
    id: string;
    title: string;
    startedAt: number;
    entries: BuildlogEntry[];
    notes: Note[];
    chapters: Chapter[];
    metadata: Partial<BuildlogMetadata>;
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
    data: FileChange;
}
export interface TerminalCommandEvent extends OpenClawEvent {
    type: 'terminal_command';
    data: TerminalCommand;
}
type EventHandler = (event: OpenClawEvent) => void;
/**
 * BuildlogRecorder - State machine for recording OpenClaw sessions
 *
 * States: idle -> recording <-> paused -> idle
 */
export declare class BuildlogRecorder {
    private state;
    private session;
    private config;
    private eventHandlers;
    private pendingUserMessage;
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
     * Stop recording and return the session
     */
    stop(): RecordingSession | null;
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
     * Add a note at the current position
     */
    addNote(text: string): void;
    /**
     * Add a chapter marker
     */
    addChapter(title: string): void;
    /**
     * Mark the last entry as important
     */
    markImportant(): void;
    /**
     * Get recording status
     */
    getStatus(): {
        state: RecorderState;
        sessionId?: string;
        title?: string;
        entryCount: number;
        duration: number;
        noteCount: number;
        chapterCount: number;
    };
    /**
     * Convert session to Buildlog format
     */
    toBuildlog(): Buildlog | null;
    /**
     * Subscribe to recorder events
     */
    on(event: string, handler: EventHandler): () => void;
    private handleUserMessage;
    private handleAssistantMessage;
    private handleFileChange;
    private handleTerminalCommand;
    private truncateContent;
    private generateId;
    private emit;
}
export {};
//# sourceMappingURL=recorder.d.ts.map