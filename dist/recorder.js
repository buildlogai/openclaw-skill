"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildlogRecorder = void 0;
/**
 * BuildlogRecorder - State machine for recording OpenClaw sessions
 *
 * States: idle -> recording <-> paused -> idle
 */
class BuildlogRecorder {
    state = 'idle';
    session = null;
    config;
    eventHandlers = new Map();
    pendingUserMessage = null;
    constructor(config = {}) {
        this.config = {
            includeFileContents: config.includeFileContents ?? true,
            maxFileSizeKb: config.maxFileSizeKb ?? 100,
        };
    }
    /**
     * Get current recorder state
     */
    getState() {
        return this.state;
    }
    /**
     * Get current session if recording
     */
    getSession() {
        return this.session;
    }
    /**
     * Check if actively recording (not paused)
     */
    isRecording() {
        return this.state === 'recording';
    }
    /**
     * Start a new recording session
     */
    start(title, metadata = {}) {
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
    stop() {
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
    pause() {
        if (this.state !== 'recording') {
            throw new Error(`Cannot pause: currently ${this.state}`);
        }
        this.state = 'paused';
        this.emit('paused', { sessionId: this.session?.id });
    }
    /**
     * Resume recording
     */
    resume() {
        if (this.state !== 'paused') {
            throw new Error(`Cannot resume: currently ${this.state}`);
        }
        this.state = 'recording';
        this.emit('resumed', { sessionId: this.session?.id });
    }
    /**
     * Process an OpenClaw event
     */
    handleEvent(event) {
        if (this.state !== 'recording' || !this.session) {
            return;
        }
        switch (event.type) {
            case 'user_message':
                this.handleUserMessage(event);
                break;
            case 'assistant_message':
                this.handleAssistantMessage(event);
                break;
            case 'file_change':
                this.handleFileChange(event);
                break;
            case 'terminal_command':
                this.handleTerminalCommand(event);
                break;
        }
    }
    /**
     * Add a note at the current position
     */
    addNote(text) {
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
    addChapter(title) {
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
    markImportant() {
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
    getStatus() {
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
    toBuildlog() {
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
            },
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
    on(event, handler) {
        const handlers = this.eventHandlers.get(event) ?? [];
        handlers.push(handler);
        this.eventHandlers.set(event, handlers);
        return () => {
            const idx = handlers.indexOf(handler);
            if (idx >= 0)
                handlers.splice(idx, 1);
        };
    }
    // Private methods
    handleUserMessage(event) {
        const entry = {
            type: 'user',
            timestamp: event.timestamp,
            content: event.data.content,
            attachments: event.data.attachments?.map((a) => ({
                type: 'file',
                name: a.name,
                content: this.truncateContent(a.content),
            })),
        };
        this.pendingUserMessage = entry;
        this.session.entries.push(entry);
    }
    handleAssistantMessage(event) {
        const entry = {
            type: 'assistant',
            timestamp: event.timestamp,
            content: event.data.content,
            toolCalls: event.data.toolCalls,
        };
        this.session.entries.push(entry);
        this.pendingUserMessage = null;
    }
    handleFileChange(event) {
        const fileChange = event.data;
        // Optionally truncate file content
        if (fileChange.content && !this.config.includeFileContents) {
            delete fileChange.content;
        }
        else if (fileChange.content) {
            fileChange.content = this.truncateContent(fileChange.content);
        }
        const entry = {
            type: 'file_change',
            timestamp: event.timestamp,
            fileChange,
        };
        this.session.entries.push(entry);
    }
    handleTerminalCommand(event) {
        const entry = {
            type: 'terminal',
            timestamp: event.timestamp,
            command: event.data,
        };
        this.session.entries.push(entry);
    }
    truncateContent(content) {
        const maxBytes = this.config.maxFileSizeKb * 1024;
        if (content.length <= maxBytes) {
            return content;
        }
        return content.slice(0, maxBytes) + '\n... [truncated]';
    }
    generateId() {
        return `bl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
    emit(event, data) {
        const handlers = this.eventHandlers.get(event) ?? [];
        for (const handler of handlers) {
            try {
                handler({ type: event, timestamp: Date.now(), data });
            }
            catch (err) {
                console.error(`Error in event handler for ${event}:`, err);
            }
        }
    }
}
exports.BuildlogRecorder = BuildlogRecorder;
//# sourceMappingURL=recorder.js.map