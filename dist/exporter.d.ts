import type { BuildlogFile, BuildlogMetadata } from './types.js';
export declare const BUILDLOG_VERSION = "2.0.0";
export declare const DEFAULT_FORMAT = "slim";
export declare const MAX_SLIM_SIZE_BYTES: number;
export interface SessionMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
    toolCalls?: Array<{
        name: string;
        arguments: Record<string, unknown>;
        result?: unknown;
    }>;
    attachments?: Array<{
        name: string;
        content: string;
        type?: string;
    }>;
}
export interface FileChangeInfo {
    path: string;
    changeType: 'created' | 'modified' | 'deleted';
    timestamp?: number;
    content?: string;
    previousContent?: string;
}
export interface TerminalCommandInfo {
    command: string;
    cwd?: string;
    exitCode?: number;
    output?: string;
    timestamp?: number;
}
export interface SessionHistory {
    messages: SessionMessage[];
    fileChanges?: FileChangeInfo[];
    terminalCommands?: TerminalCommandInfo[];
    metadata?: Partial<BuildlogMetadata>;
}
export interface ExportOptions {
    title?: string;
    description?: string;
    tags?: string[];
    includeSystemMessages?: boolean;
    format?: 'slim' | 'full';
    lastN?: number;
    author?: string;
    aiProvider?: string;
    editor?: string;
}
/**
 * BuildlogExporter - Convert session history to v2 buildlog format
 *
 * Exports workflow recipes focused on prompts as artifacts.
 * Supports both slim (default, 2-50KB) and full (with responses) formats.
 */
export declare class BuildlogExporter {
    private options;
    constructor(options?: Partial<ExportOptions>);
    /**
     * Export a session history to v2 buildlog format
     */
    export(history: SessionHistory): BuildlogFile;
    /**
     * Export only the last N messages
     */
    exportLastN(history: SessionHistory, n: number): BuildlogFile;
    /**
     * Export a range of messages
     */
    exportRange(history: SessionHistory, start: number, end: number): BuildlogFile;
    /**
     * Convert to slim format (strip full data)
     */
    toSlim(buildlog: BuildlogFile): BuildlogFile;
    /**
     * Merge file changes and terminal commands into the timeline as steps
     */
    private convertToSteps;
    /**
     * Convert a user message to a prompt step
     */
    private messageToPromptStep;
    /**
     * Convert a file change to an action step
     */
    private fileChangeToActionStep;
    /**
     * Convert a terminal command to a terminal step
     */
    private terminalToStep;
    /**
     * Filter messages based on options
     */
    private filterMessages;
    /**
     * Build metadata for the buildlog
     */
    private buildMetadata;
    /**
     * Try to infer a title from the session content
     */
    private inferTitle;
    /**
     * Try to infer a description from the steps
     */
    private inferDescription;
    /**
     * Try to infer tags from file extensions and content
     */
    private inferTags;
    /**
     * Try to infer outcome from the session
     */
    private inferOutcome;
    /**
     * Generate a unique ID
     */
    private generateId;
    /**
     * Capitalize first letter
     */
    private capitalizeFirst;
}
/**
 * Convenience function to export a session
 */
export declare function exportSession(history: SessionHistory, options?: ExportOptions): BuildlogFile;
//# sourceMappingURL=exporter.d.ts.map