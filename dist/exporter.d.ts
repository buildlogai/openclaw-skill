import type { Buildlog, BuildlogMetadata, FileChange, TerminalCommand } from './types.js';
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
export interface SessionHistory {
    messages: SessionMessage[];
    fileChanges?: FileChange[];
    terminalCommands?: TerminalCommand[];
    metadata?: Partial<BuildlogMetadata>;
}
export interface ExportOptions {
    title?: string;
    description?: string;
    tags?: string[];
    includeSystemMessages?: boolean;
    includeFileContents?: boolean;
    maxFileSizeKb?: number;
    lastN?: number;
    author?: string;
}
/**
 * BuildlogExporter - Convert session history to buildlog format
 *
 * Supports retroactive export from session_history
 */
export declare class BuildlogExporter {
    private options;
    constructor(options?: Partial<ExportOptions>);
    /**
     * Export a session history to buildlog format
     */
    export(history: SessionHistory): Buildlog;
    /**
     * Export only the last N messages
     */
    exportLastN(history: SessionHistory, n: number): Buildlog;
    /**
     * Export a range of messages
     */
    exportRange(history: SessionHistory, start: number, end: number): Buildlog;
    /**
     * Merge file changes and terminal commands into the timeline
     */
    private convertToEntries;
    /**
     * Convert a session message to a buildlog entry
     */
    private messageToEntry;
    /**
     * Convert a file change to a buildlog entry
     */
    private fileChangeToEntry;
    /**
     * Convert a terminal command to a buildlog entry
     */
    private terminalToEntry;
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
     * Try to infer a description from the session
     */
    private inferDescription;
    /**
     * Try to infer tags from file extensions and content
     */
    private inferTags;
    /**
     * Detect natural chapter breaks in the content
     */
    private detectChapters;
    /**
     * Extract a chapter title from a message
     */
    private extractChapterTitle;
    /**
     * Truncate content to max size
     */
    private truncateContent;
    /**
     * Generate a unique ID
     */
    private generateId;
}
/**
 * Convenience function to export a session
 */
export declare function exportSession(history: SessionHistory, options?: ExportOptions): Buildlog;
//# sourceMappingURL=exporter.d.ts.map