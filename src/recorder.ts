import type {
  Buildlog,
  BuildlogEntry,
  BuildlogMetadata,
  FileChange,
  TerminalCommand,
} from './types.js';

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
export class BuildlogRecorder {
  private state: RecorderState = 'idle';
  private session: RecordingSession | null = null;
  private config: RecorderConfig;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private pendingUserMessage: BuildlogEntry | null = null;

  constructor(config: Partial<RecorderConfig> = {}) {
    this.config = {
      includeFileContents: config.includeFileContents ?? true,
      maxFileSizeKb: config.maxFileSizeKb ?? 100,
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
      entries: [],
      notes: [],
      chapters: [],
      metadata: {
        ...metadata,
        title,
        createdAt: new Date().toISOString(),
      },
    };

    this.state = 'recording';
    this.emit('started', { sessionId: this.session.id, title });
  }

  /**
   * Stop recording and return the session
   */
  stop(): RecordingSession | null {
    if (this.state === 'idle') {
      throw new Error('Cannot stop: not recording');
    }

    const session = this.session;
    if (session) {
      session.metadata.duration = Date.now() - session.startedAt;
    }

    this.state = 'idle';
    this.session = null;
    this.pendingUserMessage = null;

    this.emit('stopped', { session });
    return session;
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
   * Add a note at the current position
   */
  addNote(text: string): void {
    if (!this.session) {
      throw new Error('Cannot add note: no active session');
    }

    this.session.notes.push({
      timestamp: Date.now(),
      text,
      entryIndex: this.session.entries.length,
    });

    this.emit('note_added', { text });
  }

  /**
   * Add a chapter marker
   */
  addChapter(title: string): void {
    if (!this.session) {
      throw new Error('Cannot add chapter: no active session');
    }

    this.session.chapters.push({
      title,
      entryIndex: this.session.entries.length,
      timestamp: Date.now(),
    });

    this.emit('chapter_added', { title });
  }

  /**
   * Mark the last entry as important
   */
  markImportant(): void {
    if (!this.session || this.session.entries.length === 0) {
      throw new Error('Cannot mark: no entries');
    }

    const lastEntry = this.session.entries[this.session.entries.length - 1];
    lastEntry.metadata = {
      ...lastEntry.metadata,
      important: true,
    };

    this.emit('marked_important', { entryIndex: this.session.entries.length - 1 });
  }

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
  } {
    return {
      state: this.state,
      sessionId: this.session?.id,
      title: this.session?.title,
      entryCount: this.session?.entries.length ?? 0,
      duration: this.session ? Date.now() - this.session.startedAt : 0,
      noteCount: this.session?.notes.length ?? 0,
      chapterCount: this.session?.chapters.length ?? 0,
    };
  }

  /**
   * Convert session to Buildlog format
   */
  toBuildlog(): Buildlog | null {
    if (!this.session) {
      return null;
    }

    return {
      version: '1.0.0',
      metadata: {
        id: this.session.id,
        title: this.session.title,
        createdAt: new Date(this.session.startedAt).toISOString(),
        duration: Date.now() - this.session.startedAt,
        entryCount: this.session.entries.length,
        ...this.session.metadata,
      } as BuildlogMetadata,
      entries: this.session.entries,
      chapters: this.session.chapters.map((ch) => ({
        title: ch.title,
        startIndex: ch.entryIndex,
      })),
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
    const entry: BuildlogEntry = {
      type: 'user',
      timestamp: event.timestamp,
      content: event.data.content,
      attachments: event.data.attachments?.map((a) => ({
        type: 'file' as const,
        name: a.name,
        content: this.truncateContent(a.content),
      })),
    };

    this.pendingUserMessage = entry;
    this.session!.entries.push(entry);
  }

  private handleAssistantMessage(event: AssistantMessageEvent): void {
    const entry: BuildlogEntry = {
      type: 'assistant',
      timestamp: event.timestamp,
      content: event.data.content,
      toolCalls: event.data.toolCalls,
    };

    this.session!.entries.push(entry);
    this.pendingUserMessage = null;
  }

  private handleFileChange(event: FileChangeEvent): void {
    const fileChange = event.data;

    // Optionally truncate file content
    if (fileChange.content && !this.config.includeFileContents) {
      delete fileChange.content;
    } else if (fileChange.content) {
      fileChange.content = this.truncateContent(fileChange.content);
    }

    const entry: BuildlogEntry = {
      type: 'file_change',
      timestamp: event.timestamp,
      fileChange,
    };

    this.session!.entries.push(entry);
  }

  private handleTerminalCommand(event: TerminalCommandEvent): void {
    const entry: BuildlogEntry = {
      type: 'terminal',
      timestamp: event.timestamp,
      command: event.data,
    };

    this.session!.entries.push(entry);
  }

  private truncateContent(content: string): string {
    const maxBytes = this.config.maxFileSizeKb * 1024;
    if (content.length <= maxBytes) {
      return content;
    }
    return content.slice(0, maxBytes) + '\n... [truncated]';
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
