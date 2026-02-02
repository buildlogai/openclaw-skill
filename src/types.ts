/**
 * Type definitions for buildlog format
 * These would normally come from @buildlog/types package
 */

export interface BuildlogMetadata {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  duration?: number;
  entryCount: number;
  tags?: string[];
  author?: string;
  source?: string;
  version?: string;
}

export interface BuildlogEntry {
  type: 'user' | 'assistant' | 'file_change' | 'terminal' | 'system';
  timestamp: number;
  content?: string;
  fileChange?: FileChange;
  command?: TerminalCommand;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
  }>;
  attachments?: Array<{
    type: 'file' | 'image';
    name: string;
    content?: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface FileChange {
  path: string;
  action: 'create' | 'modify' | 'delete' | 'rename';
  content?: string;
  previousContent?: string;
  diff?: string;
  language?: string;
  timestamp?: number;
}

export interface TerminalCommand {
  command: string;
  cwd?: string;
  output?: string;
  exitCode?: number;
  timestamp?: number;
}

export interface BuildlogChapter {
  title: string;
  startIndex: number;
  endIndex?: number;
}

export interface Buildlog {
  version: string;
  metadata: BuildlogMetadata;
  entries: BuildlogEntry[];
  chapters?: BuildlogChapter[];
}
