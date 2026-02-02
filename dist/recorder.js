"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildlogRecorder = void 0;
/**
 * BuildlogRecorder v2 - Slim workflow format
 *
 * Key change from v1: Prompts are the primary artifact.
 * We capture the workflow, not the full file contents.
 *
 * States: idle -> recording <-> paused -> idle
 */
class BuildlogRecorder {
    state = 'idle';
    session = null;
    config;
    eventHandlers = new Map();
    lastPromptStep = null;
    pendingFileChanges = new Map();
    constructor(config = {}) {
        this.config = {
            fullFormat: config.fullFormat ?? false,
            aiProvider: config.aiProvider ?? 'claude',
            model: config.model,
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
    stop(outcome) {
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
     * Manually add a prompt step
     */
    addPrompt(content, options) {
        if (!this.session) {
            throw new Error('Cannot add prompt: no active session');
        }
        // Flush any pending file changes as an action
        this.flushPendingChanges();
        const step = {
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
    addAction(summary, options) {
        if (!this.session) {
            throw new Error('Cannot add action: no active session');
        }
        // Track files for outcome
        options?.filesCreated?.forEach(f => this.session.filesCreated.add(f));
        options?.filesModified?.forEach(f => this.session.filesModified.add(f));
        const step = {
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
    addNote(content, category) {
        if (!this.session) {
            throw new Error('Cannot add note: no active session');
        }
        const step = {
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
    addCheckpoint(label, summary) {
        if (!this.session) {
            throw new Error('Cannot add checkpoint: no active session');
        }
        const step = {
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
    trackFileChange(path, changeType) {
        if (!this.session)
            return;
        if (changeType === 'created') {
            this.session.filesCreated.add(path);
        }
        else if (changeType === 'modified') {
            this.session.filesModified.add(path);
        }
    }
    /**
     * Add a terminal command step
     */
    addTerminal(command, cwd, exitCode) {
        if (!this.session) {
            throw new Error('Cannot add terminal: no active session');
        }
        const outcome = exitCode === 0 ? 'success' : exitCode !== undefined ? 'failure' : 'success';
        const step = {
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
    addError(message, resolved = false, resolution) {
        if (!this.session) {
            throw new Error('Cannot add error: no active session');
        }
        const step = {
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
    getStatus() {
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
    toBuildlog(outcome) {
        if (!this.session) {
            return null;
        }
        const durationSeconds = Math.round((Date.now() - this.session.startedAt) / 1000);
        const hasPrompts = this.session.steps.some(s => s.type === 'prompt');
        const metadata = {
            id: this.session.id,
            title: this.session.title,
            createdAt: new Date(this.session.startedAt).toISOString(),
            durationSeconds,
            editor: 'openclaw',
            aiProvider: this.config.aiProvider,
            model: this.config.model,
            replicable: hasPrompts,
            ...this.session.metadata,
        };
        const buildlogOutcome = {
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
        // User messages become prompts
        const context = event.data.attachments?.map(a => a.name);
        this.addPrompt(event.data.content, { context });
    }
    handleAssistantMessage(event) {
        // Flush pending file changes and create an action step
        this.flushPendingChanges(event.data.content);
    }
    handleFileChange(event) {
        const { path, action } = event.data;
        // Track the file change
        if (action === 'create') {
            this.pendingFileChanges.set(path, 'create');
            this.session?.filesCreated.add(path);
        }
        else if (action === 'modify') {
            if (!this.pendingFileChanges.has(path)) {
                this.pendingFileChanges.set(path, 'modify');
            }
            this.session?.filesModified.add(path);
        }
    }
    handleTerminalCommand(event) {
        if (!this.session)
            return;
        const { command, output, exitCode } = event.data;
        const outcome = exitCode === 0 ? 'success' :
            exitCode === undefined ? 'partial' : 'failure';
        const step = {
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
    flushPendingChanges(aiResponse) {
        if (!this.session || this.pendingFileChanges.size === 0) {
            return;
        }
        const filesCreated = [];
        const filesModified = [];
        for (const [path, action] of this.pendingFileChanges) {
            if (action === 'create') {
                filesCreated.push(path);
            }
            else {
                filesModified.push(path);
            }
        }
        const summary = this.generateActionSummary(filesCreated, filesModified);
        const step = {
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
    generateActionSummary(created, modified) {
        const parts = [];
        if (created.length > 0) {
            parts.push(`Created ${created.length} file${created.length > 1 ? 's' : ''}`);
        }
        if (modified.length > 0) {
            parts.push(`Modified ${modified.length} file${modified.length > 1 ? 's' : ''}`);
        }
        return parts.join(', ') || 'Code changes';
    }
    getTimestamp() {
        if (!this.session)
            return 0;
        return Math.round((Date.now() - this.session.startedAt) / 1000);
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