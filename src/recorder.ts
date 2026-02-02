import type {
  BuildlogFile,
  BuildlogStep,
  BuildlogMetadata,
  BuildlogOutcome,
  PromptStep,
  ActionStep,
  TerminalStep,
  NoteStep,
  CheckpointStep,
  ErrorStep,
  NoteCategory,
  TerminalOutcome,
  OutcomeStatus,
  AIProvider,
  BUILDLOG_VERSION,
} from './types.js';

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
    attachments?: Array<{ name: string; content: string }>;
  };
}

export interface AssistantMessageEvent extends OpenClawEvent {
  type: 'assistant_message';
  data: {
    content: string;
    toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
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
export class BuildlogRecorder {
  private state: RecorderState = 'idle';
  private session: RecordingSession | null = null;
  private config: RecorderConfig;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private lastPromptStep: PromptStep | null = null;
  private pendingFileChanges: Map<string, 'create' | 'modify'> = new Map();

  constructor(config: Partial<RecorderConfig> = {}) {
    this.config = {
      fullFormat: config.fullFormat ?? false,
      aiProvider: config.aiProvider ?? 'claude',
      model: config.model,
    };
  }

  /**
   * Get current recorder state
   */
  getState(): RecorderState {
    return this.state;
  }

  /**
   * Get current session if recording
   */
  getSession(): RecordingSession | null {
    return this.session;
  }

  /**
   * Check if actively recording (not paused)
   */
  isRecording(): boolean {
    return this.state === 'recording';
  }

  /**
   * Start a new recording session
   */
  start(title: string, metadata: Partial<BuildlogMetadata> = {}): void {
    if (this.state !== 'idle') {
      throw new Error(`Cannot start recording: currently ${this.state}`);
    }

    this.session = {
      id: this.generateId(),
      title,
      startedAt: Date.now(),
      steps: [],
      sequenceCounter: 0,
      metadata: {
        ...metadata,
        title,
        createdAt: new Date().toISOString(),
        editor: 'openclaw',
        aiProvider: this.config.aiProvider,
        model: this.config.model,
      },
      filesCreated: new Set(),
      filesModified: new Set(),
    };

    this.state = 'recording';
    this.lastPromptStep = null;
    this.pendingFileChanges.clear();
    this.emit('started', { sessionId: this.session.id, title });
  }

  /**
   * Stop recording and return the buildlog
   */
  stop(outcome?: { status: OutcomeStatus; summary: string }): BuildlogFile | null {
    if (this.state === 'idle') {
      throw new Error('Cannot stop: not recording');
    }

    const buildlog = this.toBuildlog(outcome);

    this.state = 'idle';
    this.session = null;
    this.lastPromptStep = null;
    this.pendingFileChanges.clear();

    this.emit('stopped', { buildlog });
    return buildlog;
  }

  /**
   * Pause recording
   */
  pause(): void {
    if (this.state !== 'recording') {
      throw new Error(`Cannot pause: currently ${this.state}`);
    }

    this.state = 'paused';
    this.emit('paused', { sessionId: this.session?.id });
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (this.state !== 'paused') {
      throw new Error(`Cannot resume: currently ${this.state}`);
    }

    this.state = 'recording';
    this.emit('resumed', { sessionId: this.session?.id });
  }

  /**
   * Process an OpenClaw event
   */
  handleEvent(event: OpenClawEvent): void {
    if (this.state !== 'recording' || !this.session) {
      return;
    }

    switch (event.type) {
      case 'user_message':
        this.handleUserMessage(event as UserMessageEvent);
        break;
      case 'assistant_message':
        this.handleAssistantMessage(event as AssistantMessageEvent);
        break;
      case 'file_change':
        this.handleFileChange(event as FileChangeEvent);
        break;
      case 'terminal_command':
        this.handleTerminalCommand(event as TerminalCommandEvent);
        break;
    }
  }

  /**
   * Manually add a prompt step
   */
  addPrompt(content: string, options?: { context?: string[]; intent?: string }): void {
    if (!this.session) {
      throw new Error('Cannot add prompt: no active session');
    }

    // Flush any pending file changes as an action
    this.flushPendingChanges();

    const step: PromptStep = {
      id: this.generateId(),
      type: 'prompt',
      timestamp: this.getTimestamp(),
      sequence: this.session.sequenceCounter++,
      content,
      context: options?.context,
      intent: options?.intent,
    };

    this.session.steps.push(step);
    this.lastPromptStep = step;
    this.emit('step_added', { step });
  }

  /**
   * Manually add an action step
   */
  addAction(summary: string, options?: {
    filesCreated?: string[];
    filesModified?: string[];
    filesDeleted?: string[];
    approach?: string;
    aiResponse?: string;
  }): void {
    if (!this.session) {
      throw new Error('Cannot add action: no active session');
    }

    // Track files for outcome
    options?.filesCreated?.forEach(f => this.session!.filesCreated.add(f));
    options?.filesModified?.forEach(f => this.session!.filesModified.add(f));

    const step: ActionStep = {
      id: this.generateId(),
      type: 'action',
      timestamp: this.getTimestamp(),
      sequence: this.session.sequenceCounter++,
      summary,
      filesCreated: options?.filesCreated,
      filesModified: options?.filesModified,
      filesDeleted: options?.filesDeleted,
      approach: options?.approach,
      aiResponse: this.config.fullFormat ? options?.aiResponse : undefined,
    };

    this.session.steps.push(step);
    this.emit('step_added', { step });
  }

  /**
   * Add a note step
   */
  addNote(content: string, category?: NoteCategory): void {
    if (!this.session) {
      throw new Error('Cannot add note: no active session');
    }

    const step: NoteStep = {
      id: this.generateId(),
      type: 'note',
      timestamp: this.getTimestamp(),
      sequence: this.session.sequenceCounter++,
      content,
      category,
    };

    this.session.steps.push(step);
    this.emit('step_added', { step });
  }

  /**
   * Add a checkpoint step
   */
  addCheckpoint(label: string, summary?: string): void {
    if (!this.session) {
      throw new Error('Cannot add checkpoint: no active session');
    }

    const step: CheckpointStep = {
      id: this.generateId(),
      type: 'checkpoint',
      timestamp: this.getTimestamp(),
      sequence: this.session.sequenceCounter++,
      name: label,
      label: label,
      summary: summary,
      description: summary,
    };

    this.session.steps.push(step);
    this.emit('step_added', { step });
  }

  /**
   * Track a file change for the current action
   */
  trackFileChange(path: string, changeType: 'created' | 'modified' | 'deleted'): void {
    if (!this.session) return;
    
    if (changeType === 'created') {
      this.session.filesCreated.add(path);
    } else if (changeType === 'modified') {
      this.session.filesModified.add(path);
    }
  }

  /**
   * Add a terminal command step
   */
  addTerminal(command: string, cwd?: string, exitCode?: number): void {
    if (!this.session) {
      throw new Error('Cannot add terminal: no active session');
    }

    const outcome: TerminalOutcome = exitCode === 0 ? 'success' : exitCode !== undefined ? 'failure' : 'success';
    
    const step: TerminalStep = {
      id: this.generateId(),
      type: 'terminal',
      timestamp: this.getTimestamp(),
      sequence: this.session.sequenceCounter++,
      command,
      cwd,
      outcome,
      exitCode,
    };

    this.session.steps.push(step);
    this.emit('step_added', { step });
  }

  /**
   * Add an error step
   */
  addError(message: string, resolved: boolean = false, resolution?: string): void {
    if (!this.session) {
      throw new Error('Cannot add error: no active session');
    }

    const step: ErrorStep = {
      id: this.generateId(),
      type: 'error',
      timestamp: this.getTimestamp(),
      sequence: this.session.sequenceCounter++,
      message,
      resolved,
      resolution,
    };

    this.session.steps.push(step);
    this.emit('step_added', { step });
  }

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
  } {
    const promptCount = this.session?.steps.filter(s => s.type === 'prompt').length ?? 0;
    return {
      state: this.state,
      sessionId: this.session?.id,
      title: this.session?.title,
      stepCount: this.session?.steps.length ?? 0,
      promptCount,
      duration: this.session ? Date.now() - this.session.startedAt : 0,
    };
  }

  /**
   * Convert session to Buildlog format
   */
  toBuildlog(outcome?: { status: OutcomeStatus; summary: string }): BuildlogFile | null {
    if (!this.session) {
      return null;
    }

    const durationSeconds = Math.round((Date.now() - this.session.startedAt) / 1000);
    const hasPrompts = this.session.steps.some(s => s.type === 'prompt');

    const metadata: BuildlogMetadata = {
      id: this.session.id,
      title: this.session.title,
      createdAt: new Date(this.session.startedAt).toISOString(),
      durationSeconds,
      editor: 'openclaw',
      aiProvider: this.config.aiProvider,
      model: this.config.model,
      replicable: hasPrompts,
      ...this.session.metadata,
    } as BuildlogMetadata;

    const buildlogOutcome: BuildlogOutcome = {
      status: outcome?.status || (hasPrompts ? 'success' : 'abandoned'),
      summary: outcome?.summary || `Recorded ${this.session.steps.length} steps`,
      filesCreated: this.session.filesCreated.size,
      filesModified: this.session.filesModified.size,
      canReplicate: hasPrompts,
    };

    return {
      version: '2.0.0',
      format: this.config.fullFormat ? 'full' : 'slim',
      metadata,
      steps: this.session.steps,
      outcome: buildlogOutcome,
    };
  }

  /**
   * Subscribe to recorder events
   */
  on(event: string, handler: EventHandler): () => void {
    const handlers = this.eventHandlers.get(event) ?? [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);

    return () => {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  }

  // Private methods

  private handleUserMessage(event: UserMessageEvent): void {
    // User messages become prompts
    const context = event.data.attachments?.map(a => a.name);
    this.addPrompt(event.data.content, { context });
  }

  private handleAssistantMessage(event: AssistantMessageEvent): void {
    // Flush pending file changes and create an action step
    this.flushPendingChanges(event.data.content);
  }

  private handleFileChange(event: FileChangeEvent): void {
    const { path, action } = event.data;
    
    // Track the file change
    if (action === 'create') {
      this.pendingFileChanges.set(path, 'create');
      this.session?.filesCreated.add(path);
    } else if (action === 'modify') {
      if (!this.pendingFileChanges.has(path)) {
        this.pendingFileChanges.set(path, 'modify');
      }
      this.session?.filesModified.add(path);
    }
  }

  private handleTerminalCommand(event: TerminalCommandEvent): void {
    if (!this.session) return;

    const { command, output, exitCode } = event.data;
    const outcome: TerminalOutcome = 
      exitCode === 0 ? 'success' : 
      exitCode === undefined ? 'partial' : 'failure';

    const step: TerminalStep = {
      id: this.generateId(),
      type: 'terminal',
      timestamp: this.getTimestamp(),
      sequence: this.session.sequenceCounter++,
      command,
      outcome,
      output: this.config.fullFormat ? output : undefined,
      exitCode,
    };

    this.session.steps.push(step);
    this.emit('step_added', { step });
  }

  /**
   * Flush pending file changes into an action step
   */
  private flushPendingChanges(aiResponse?: string): void {
    if (!this.session || this.pendingFileChanges.size === 0) {
      return;
    }

    const filesCreated: string[] = [];
    const filesModified: string[] = [];

    for (const [path, action] of this.pendingFileChanges) {
      if (action === 'create') {
        filesCreated.push(path);
      } else {
        filesModified.push(path);
      }
    }

    const summary = this.generateActionSummary(filesCreated, filesModified);

    const step: ActionStep = {
      id: this.generateId(),
      type: 'action',
      timestamp: this.getTimestamp(),
      sequence: this.session.sequenceCounter++,
      summary,
      filesCreated: filesCreated.length > 0 ? filesCreated : undefined,
      filesModified: filesModified.length > 0 ? filesModified : undefined,
      aiResponse: this.config.fullFormat ? aiResponse : undefined,
    };

    this.session.steps.push(step);
    this.pendingFileChanges.clear();
    this.emit('step_added', { step });
  }

  private generateActionSummary(created: string[], modified: string[]): string {
    const parts: string[] = [];
    if (created.length > 0) {
      parts.push(`Created ${created.length} file${created.length > 1 ? 's' : ''}`);
    }
    if (modified.length > 0) {
      parts.push(`Modified ${modified.length} file${modified.length > 1 ? 's' : ''}`);
    }
    return parts.join(', ') || 'Code changes';
  }

  private getTimestamp(): number {
    if (!this.session) return 0;
    return Math.round((Date.now() - this.session.startedAt) / 1000);
  }

  private generateId(): string {
    return `bl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private emit(event: string, data: unknown): void {
    const handlers = this.eventHandlers.get(event) ?? [];
    for (const handler of handlers) {
      try {
        handler({ type: event, timestamp: Date.now(), data } as OpenClawEvent);
      } catch (err) {
        console.error(`Error in event handler for ${event}:`, err);
      }
    }
  }
}
