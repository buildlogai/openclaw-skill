import type {
  BuildlogFile,
  BuildlogStep,
  BuildlogMetadata,
  PromptStep,
  ActionStep,
  TerminalStep,
  NoteStep,
} from './types.js';

// Re-export constants
export const BUILDLOG_VERSION = '2.0.0';
export const DEFAULT_FORMAT = 'slim';
export const MAX_SLIM_SIZE_BYTES = 100 * 1024; // 100KB

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

const DEFAULT_OPTIONS: ExportOptions = {
  includeSystemMessages: false,
  format: 'slim',
};

/**
 * BuildlogExporter - Convert session history to v2 buildlog format
 * 
 * Exports workflow recipes focused on prompts as artifacts.
 * Supports both slim (default, 2-50KB) and full (with responses) formats.
 */
export class BuildlogExporter {
  private options: ExportOptions;

  constructor(options: Partial<ExportOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Export a session history to v2 buildlog format
   */
  export(history: SessionHistory): BuildlogFile {
    const messages = this.filterMessages(history.messages);
    const steps = this.convertToSteps(messages, history);
    const metadata = this.buildMetadata(history, steps);

    const buildlog: BuildlogFile = {
      version: BUILDLOG_VERSION,
      format: this.options.format ?? 'slim',
      metadata,
      steps,
    };

    // Add outcome if we can infer it
    const outcome = this.inferOutcome(history);
    if (outcome) {
      buildlog.outcome = outcome;
    }

    return buildlog;
  }

  /**
   * Export only the last N messages
   */
  exportLastN(history: SessionHistory, n: number): BuildlogFile {
    const limitedHistory: SessionHistory = {
      ...history,
      messages: history.messages.slice(-n),
    };
    return this.export(limitedHistory);
  }

  /**
   * Export a range of messages
   */
  exportRange(history: SessionHistory, start: number, end: number): BuildlogFile {
    const limitedHistory: SessionHistory = {
      ...history,
      messages: history.messages.slice(start, end),
    };
    return this.export(limitedHistory);
  }

  /**
   * Convert to slim format (strip full data)
   */
  toSlim(buildlog: BuildlogFile): BuildlogFile {
    if (buildlog.format === 'slim') {
      return buildlog;
    }

    const slim: BuildlogFile = {
      ...buildlog,
      format: 'slim',
      steps: buildlog.steps.map((step) => {
        if (step.type === 'prompt' && 'response' in step) {
          const { response, ...rest } = step as PromptStep & { response?: string };
          return rest;
        }
        if (step.type === 'action' && 'diff' in step) {
          const { diff, ...rest } = step as ActionStep & { diff?: string };
          return rest;
        }
        return step;
      }),
    };

    return slim;
  }

  /**
   * Merge file changes and terminal commands into the timeline as steps
   */
  private convertToSteps(
    messages: SessionMessage[],
    history: SessionHistory
  ): BuildlogStep[] {
    const steps: BuildlogStep[] = [];
    
    // Create a timeline of all events
    const timeline: Array<{
      timestamp: number;
      type: 'prompt' | 'action' | 'terminal';
      data: SessionMessage | FileChangeInfo | TerminalCommandInfo;
    }> = [];

    // Add user messages as prompts
    for (const msg of messages) {
      if (msg.role === 'user') {
        timeline.push({
          timestamp: msg.timestamp ?? Date.now(),
          type: 'prompt',
          data: msg,
        });
      }
    }

    // Add file changes as actions
    if (history.fileChanges) {
      for (const fc of history.fileChanges) {
        timeline.push({
          timestamp: fc.timestamp ?? Date.now(),
          type: 'action',
          data: fc,
        });
      }
    }

    // Add terminal commands
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

    // Convert to steps
    let stepIndex = 0;
    for (const event of timeline) {
      switch (event.type) {
        case 'prompt':
          steps.push(this.messageToPromptStep(event.data as SessionMessage, event.timestamp, stepIndex++));
          break;
        case 'action':
          steps.push(this.fileChangeToActionStep(event.data as FileChangeInfo, event.timestamp, stepIndex++));
          break;
        case 'terminal':
          steps.push(this.terminalToStep(event.data as TerminalCommandInfo, event.timestamp, stepIndex++));
          break;
      }
    }

    return steps;
  }

  /**
   * Convert a user message to a prompt step
   */
  private messageToPromptStep(message: SessionMessage, timestamp: number, index: number): PromptStep {
    const step: PromptStep = {
      type: 'prompt',
      timestamp,
      index,
      content: message.content,
    };

    // Add context if there are attachments
    if (message.attachments && message.attachments.length > 0) {
      step.context = message.attachments.map((a) => a.name);
    }

    return step;
  }

  /**
   * Convert a file change to an action step
   */
  private fileChangeToActionStep(fileChange: FileChangeInfo, timestamp: number, index: number): ActionStep {
    const step: ActionStep = {
      type: 'action',
      timestamp,
      index,
      summary: `${this.capitalizeFirst(fileChange.changeType)} ${fileChange.path}`,
      files: [fileChange.path],
      changeType: fileChange.changeType,
    };

    // Only include diff in full format
    if (this.options.format === 'full' && fileChange.content) {
      (step as ActionStep & { diff?: string }).diff = fileChange.content;
    }

    return step;
  }

  /**
   * Convert a terminal command to a terminal step
   */
  private terminalToStep(command: TerminalCommandInfo, timestamp: number, index: number): TerminalStep {
    const step: TerminalStep = {
      type: 'terminal',
      timestamp,
      index,
      command: command.command,
    };

    if (command.cwd) {
      step.cwd = command.cwd;
    }

    if (command.exitCode !== undefined) {
      step.exitCode = command.exitCode;
    }

    // Only include output in full format
    if (this.options.format === 'full' && command.output) {
      step.output = command.output;
    }

    return step;
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
    steps: BuildlogStep[]
  ): BuildlogMetadata {
    const now = new Date().toISOString();
    const timestamps = steps.map((s) => s.timestamp).filter(Boolean) as number[];
    const duration = timestamps.length >= 2
      ? Math.max(...timestamps) - Math.min(...timestamps)
      : 0;

    const promptCount = steps.filter((s) => s.type === 'prompt').length;

    const metadata: BuildlogMetadata = {
      id: this.generateId(),
      title: this.options.title ?? this.inferTitle(history) ?? 'Untitled Workflow',
      createdAt: now,
    };

    if (this.options.description) {
      metadata.description = this.options.description;
    } else {
      const inferred = this.inferDescription(steps);
      if (inferred) metadata.description = inferred;
    }

    if (duration > 0) metadata.duration = duration;
    if (this.options.author) metadata.author = { name: this.options.author };
    if (this.options.tags && this.options.tags.length > 0) {
      metadata.tags = this.options.tags;
    } else {
      const inferredTags = this.inferTags(history);
      if (inferredTags.length > 0) metadata.tags = inferredTags;
    }

    metadata.stepCount = steps.length;
    metadata.promptCount = promptCount;
    
    if (this.options.aiProvider) metadata.aiProvider = this.options.aiProvider;
    if (this.options.editor) metadata.editor = this.options.editor;

    // Merge with session metadata
    if (history.metadata) {
      Object.assign(metadata, history.metadata);
    }

    return metadata;
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
   * Try to infer a description from the steps
   */
  private inferDescription(steps: BuildlogStep[]): string | undefined {
    const promptCount = steps.filter((s) => s.type === 'prompt').length;
    const actionCount = steps.filter((s) => s.type === 'action').length;
    const terminalCount = steps.filter((s) => s.type === 'terminal').length;

    const parts: string[] = [];
    if (promptCount > 0) parts.push(`${promptCount} prompt${promptCount > 1 ? 's' : ''}`);
    if (actionCount > 0) parts.push(`${actionCount} action${actionCount > 1 ? 's' : ''}`);
    if (terminalCount > 0) parts.push(`${terminalCount} command${terminalCount > 1 ? 's' : ''}`);

    return parts.length > 0 ? `Workflow with ${parts.join(', ')}` : undefined;
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
   * Try to infer outcome from the session
   */
  private inferOutcome(history: SessionHistory): BuildlogFile['outcome'] | undefined {
    const lastMessage = history.messages.findLast((m) => m.role === 'assistant');
    if (!lastMessage) return undefined;

    const content = lastMessage.content.toLowerCase();
    
    // Look for success indicators
    const successIndicators = ['done', 'complete', 'finished', 'works', 'success'];
    const hasSuccess = successIndicators.some((i) => content.includes(i));

    // Look for failure indicators
    const failureIndicators = ['error', 'failed', 'doesn\'t work', 'issue', 'problem'];
    const hasFailure = failureIndicators.some((i) => content.includes(i));

    if (hasSuccess && !hasFailure) {
      return {
        status: 'completed',
        summary: 'Workflow completed successfully',
      };
    } else if (hasFailure && !hasSuccess) {
      return {
        status: 'failed',
        summary: 'Workflow encountered issues',
      };
    }

    return undefined;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `bl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Convenience function to export a session
 */
export function exportSession(
  history: SessionHistory,
  options: ExportOptions = {}
): BuildlogFile {
  const exporter = new BuildlogExporter(options);
  return exporter.export(history);
}

