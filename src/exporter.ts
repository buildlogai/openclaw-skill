import type {
  Buildlog,
  BuildlogEntry,
  BuildlogMetadata,
  FileChange,
  TerminalCommand,
} from './types.js';

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

const DEFAULT_OPTIONS: ExportOptions = {
  includeSystemMessages: false,
  includeFileContents: true,
  maxFileSizeKb: 100,
};

/**
 * BuildlogExporter - Convert session history to buildlog format
 * 
 * Supports retroactive export from session_history
 */
export class BuildlogExporter {
  private options: ExportOptions;

  constructor(options: Partial<ExportOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Export a session history to buildlog format
   */
  export(history: SessionHistory): Buildlog {
    const messages = this.filterMessages(history.messages);
    const entries = this.convertToEntries(messages, history);
    const metadata = this.buildMetadata(history, entries);

    return {
      version: '1.0.0',
      metadata,
      entries,
      chapters: this.detectChapters(entries),
    };
  }

  /**
   * Export only the last N messages
   */
  exportLastN(history: SessionHistory, n: number): Buildlog {
    const limitedHistory: SessionHistory = {
      ...history,
      messages: history.messages.slice(-n),
    };
    return this.export(limitedHistory);
  }

  /**
   * Export a range of messages
   */
  exportRange(history: SessionHistory, start: number, end: number): Buildlog {
    const limitedHistory: SessionHistory = {
      ...history,
      messages: history.messages.slice(start, end),
    };
    return this.export(limitedHistory);
  }

  /**
   * Merge file changes and terminal commands into the timeline
   */
  private convertToEntries(
    messages: SessionMessage[],
    history: SessionHistory
  ): BuildlogEntry[] {
    const entries: BuildlogEntry[] = [];
    
    // Create a timeline of all events
    const timeline: Array<{
      timestamp: number;
      type: 'message' | 'file' | 'terminal';
      data: SessionMessage | FileChange | TerminalCommand;
    }> = [];

    // Add messages to timeline
    for (const msg of messages) {
      timeline.push({
        timestamp: msg.timestamp ?? Date.now(),
        type: 'message',
        data: msg,
      });
    }

    // Add file changes to timeline
    if (history.fileChanges) {
      for (const fc of history.fileChanges) {
        timeline.push({
          timestamp: fc.timestamp ?? Date.now(),
          type: 'file',
          data: fc,
        });
      }
    }

    // Add terminal commands to timeline
    if (history.terminalCommands) {
      for (const cmd of history.terminalCommands) {
        timeline.push({
          timestamp: cmd.timestamp ?? Date.now(),
          type: 'terminal',
          data: cmd,
        });
      }
    }

    // Sort by timestamp
    timeline.sort((a, b) => a.timestamp - b.timestamp);

    // Convert to entries
    for (const event of timeline) {
      switch (event.type) {
        case 'message':
          entries.push(this.messageToEntry(event.data as SessionMessage, event.timestamp));
          break;
        case 'file':
          entries.push(this.fileChangeToEntry(event.data as FileChange, event.timestamp));
          break;
        case 'terminal':
          entries.push(this.terminalToEntry(event.data as TerminalCommand, event.timestamp));
          break;
      }
    }

    return entries;
  }

  /**
   * Convert a session message to a buildlog entry
   */
  private messageToEntry(message: SessionMessage, timestamp: number): BuildlogEntry {
    const entry: BuildlogEntry = {
      type: message.role === 'user' ? 'user' : 'assistant',
      timestamp,
      content: message.content,
    };

    if (message.toolCalls && message.toolCalls.length > 0) {
      entry.toolCalls = message.toolCalls.map((tc) => ({
        name: tc.name,
        arguments: tc.arguments,
        result: tc.result,
      }));
    }

    if (message.attachments && message.attachments.length > 0) {
      entry.attachments = message.attachments.map((a) => ({
        type: (a.type as 'file' | 'image') ?? 'file',
        name: a.name,
        content: this.options.includeFileContents
          ? this.truncateContent(a.content)
          : undefined,
      }));
    }

    return entry;
  }

  /**
   * Convert a file change to a buildlog entry
   */
  private fileChangeToEntry(fileChange: FileChange, timestamp: number): BuildlogEntry {
    const fc = { ...fileChange };

    if (!this.options.includeFileContents) {
      delete fc.content;
      delete fc.previousContent;
    } else {
      if (fc.content) {
        fc.content = this.truncateContent(fc.content);
      }
      if (fc.previousContent) {
        fc.previousContent = this.truncateContent(fc.previousContent);
      }
    }

    return {
      type: 'file_change',
      timestamp,
      fileChange: fc,
    };
  }

  /**
   * Convert a terminal command to a buildlog entry
   */
  private terminalToEntry(command: TerminalCommand, timestamp: number): BuildlogEntry {
    return {
      type: 'terminal',
      timestamp,
      command: {
        ...command,
        output: command.output ? this.truncateContent(command.output) : undefined,
      },
    };
  }

  /**
   * Filter messages based on options
   */
  private filterMessages(messages: SessionMessage[]): SessionMessage[] {
    let filtered = messages;

    // Filter out system messages if not included
    if (!this.options.includeSystemMessages) {
      filtered = filtered.filter((m) => m.role !== 'system');
    }

    // Limit to last N if specified
    if (this.options.lastN && this.options.lastN > 0) {
      filtered = filtered.slice(-this.options.lastN);
    }

    return filtered;
  }

  /**
   * Build metadata for the buildlog
   */
  private buildMetadata(
    history: SessionHistory,
    entries: BuildlogEntry[]
  ): BuildlogMetadata {
    const now = new Date().toISOString();
    const timestamps = entries.map((e) => e.timestamp).filter(Boolean) as number[];
    const duration = timestamps.length >= 2
      ? Math.max(...timestamps) - Math.min(...timestamps)
      : 0;

    return {
      id: this.generateId(),
      title: this.options.title ?? this.inferTitle(history) ?? 'Untitled Session',
      description: this.options.description ?? this.inferDescription(history),
      createdAt: now,
      duration,
      entryCount: entries.length,
      tags: this.options.tags ?? this.inferTags(history),
      author: this.options.author,
      ...history.metadata,
    };
  }

  /**
   * Try to infer a title from the session content
   */
  private inferTitle(history: SessionHistory): string | undefined {
    // Look for the first substantial user message
    const firstUserMessage = history.messages.find(
      (m) => m.role === 'user' && m.content.length > 10
    );

    if (!firstUserMessage) {
      return undefined;
    }

    // Extract first line or first 50 chars
    const content = firstUserMessage.content;
    const firstLine = content.split('\n')[0];
    
    if (firstLine.length <= 60) {
      return firstLine;
    }

    return firstLine.slice(0, 57) + '...';
  }

  /**
   * Try to infer a description from the session
   */
  private inferDescription(history: SessionHistory): string | undefined {
    const messageCount = history.messages.filter((m) => m.role !== 'system').length;
    const fileCount = history.fileChanges?.length ?? 0;
    const cmdCount = history.terminalCommands?.length ?? 0;

    const parts: string[] = [];
    if (messageCount > 0) parts.push(`${messageCount} messages`);
    if (fileCount > 0) parts.push(`${fileCount} file changes`);
    if (cmdCount > 0) parts.push(`${cmdCount} commands`);

    return parts.length > 0 ? `Session with ${parts.join(', ')}` : undefined;
  }

  /**
   * Try to infer tags from file extensions and content
   */
  private inferTags(history: SessionHistory): string[] {
    const tags = new Set<string>();

    // Infer from file extensions
    if (history.fileChanges) {
      for (const fc of history.fileChanges) {
        const ext = fc.path.split('.').pop()?.toLowerCase();
        if (ext) {
          const langMap: Record<string, string> = {
            ts: 'typescript',
            tsx: 'typescript',
            js: 'javascript',
            jsx: 'javascript',
            py: 'python',
            rs: 'rust',
            go: 'go',
            rb: 'ruby',
            java: 'java',
            cpp: 'c++',
            c: 'c',
            cs: 'csharp',
            swift: 'swift',
            kt: 'kotlin',
          };
          if (langMap[ext]) {
            tags.add(langMap[ext]);
          }
        }
      }
    }

    // Look for common keywords in messages
    const allContent = history.messages.map((m) => m.content).join(' ').toLowerCase();
    const keywords = [
      'react', 'vue', 'angular', 'node', 'express', 'api', 'database',
      'testing', 'docker', 'kubernetes', 'aws', 'git', 'debug',
    ];

    for (const kw of keywords) {
      if (allContent.includes(kw)) {
        tags.add(kw);
      }
    }

    return Array.from(tags).slice(0, 10);
  }

  /**
   * Detect natural chapter breaks in the content
   */
  private detectChapters(entries: BuildlogEntry[]): Array<{ title: string; startIndex: number }> {
    const chapters: Array<{ title: string; startIndex: number }> = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      
      // Look for user messages that start a new topic
      if (entry.type === 'user' && entry.content) {
        const content = entry.content.toLowerCase();
        
        // Check for chapter-like phrases
        const chapterPatterns = [
          /^(now|next|let's|let us|can you|please)\s+(create|build|add|implement|fix|update|refactor)/i,
          /^(step|part|phase)\s+\d+/i,
          /^(first|second|third|finally|lastly)/i,
        ];

        for (const pattern of chapterPatterns) {
          if (pattern.test(content)) {
            const title = this.extractChapterTitle(entry.content);
            chapters.push({ title, startIndex: i });
            break;
          }
        }
      }
    }

    return chapters;
  }

  /**
   * Extract a chapter title from a message
   */
  private extractChapterTitle(content: string): string {
    const firstLine = content.split('\n')[0];
    if (firstLine.length <= 50) {
      return firstLine;
    }
    return firstLine.slice(0, 47) + '...';
  }

  /**
   * Truncate content to max size
   */
  private truncateContent(content: string): string {
    const maxBytes = (this.options.maxFileSizeKb ?? 100) * 1024;
    if (content.length <= maxBytes) {
      return content;
    }
    return content.slice(0, maxBytes) + '\n... [truncated]';
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `bl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

/**
 * Convenience function to export a session
 */
export function exportSession(
  history: SessionHistory,
  options: ExportOptions = {}
): Buildlog {
  const exporter = new BuildlogExporter(options);
  return exporter.export(history);
}
