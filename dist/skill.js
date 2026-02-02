"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildlogSkill = void 0;
exports.createBuildlogSkill = createBuildlogSkill;
const recorder_js_1 = require("./recorder.js");
const exporter_js_1 = require("./exporter.js");
const uploader_js_1 = require("./uploader.js");
/**
 * BuildlogSkill - Main skill implementation for OpenClaw
 */
class BuildlogSkill {
    recorder;
    exporter;
    uploader;
    config;
    lastBuildlog = null;
    unsubscribers = [];
    // Command patterns for natural language matching
    commands = [
        // Start recording
        {
            pattern: /^(start|begin|record)\s+(a\s+)?buildlog\s*[:\-]?\s*(.*)$/i,
            handler: this.handleStart.bind(this),
        },
        // Stop recording
        {
            pattern: /^(stop|end|finish)\s+(the\s+)?buildlog$/i,
            handler: this.handleStop.bind(this),
        },
        // Pause recording
        {
            pattern: /^pause\s+(the\s+)?buildlog$/i,
            handler: this.handlePause.bind(this),
        },
        // Resume recording
        {
            pattern: /^resume\s+(the\s+)?buildlog$/i,
            handler: this.handleResume.bind(this),
        },
        // Export session
        {
            pattern: /^export\s+(this\s+)?(session|conversation)\s+(as\s+)?(a\s+)?buildlog$/i,
            handler: this.handleExport.bind(this),
        },
        // Export last N messages
        {
            pattern: /^export\s+(the\s+)?last\s+(\d+)\s+(messages?|exchanges?)(\s+as\s+(a\s+)?buildlog)?$/i,
            handler: this.handleExportLastN.bind(this),
        },
        // Upload buildlog
        {
            pattern: /^(upload|push|publish)\s+(the\s+)?buildlog$/i,
            handler: this.handleUpload.bind(this),
        },
        // Share buildlog (upload + get link)
        {
            pattern: /^share\s+(the\s+)?buildlog$/i,
            handler: this.handleShare.bind(this),
        },
        // Add note
        {
            pattern: /^add\s+(a\s+)?note[:\-]?\s+(.+)$/i,
            handler: this.handleAddNote.bind(this),
        },
        // Add chapter
        {
            pattern: /^add\s+(a\s+)?chapter[:\-]?\s+(.+)$/i,
            handler: this.handleAddChapter.bind(this),
        },
        // Mark important
        {
            pattern: /^mark\s+(this\s+)?(as\s+)?important$/i,
            handler: this.handleMarkImportant.bind(this),
        },
        // Check status
        {
            pattern: /^buildlog\s+status$/i,
            handler: this.handleStatus.bind(this),
        },
        // Show info
        {
            pattern: /^(show\s+)?buildlog\s+info$/i,
            handler: this.handleInfo.bind(this),
        },
    ];
    constructor(config = {}) {
        this.config = config;
        this.recorder = new recorder_js_1.BuildlogRecorder({
            includeFileContents: config.includeFileContents ?? true,
            maxFileSizeKb: config.maxFileSizeKb ?? 100,
        });
        this.exporter = new exporter_js_1.BuildlogExporter({
            includeFileContents: config.includeFileContents ?? true,
            maxFileSizeKb: config.maxFileSizeKb ?? 100,
        });
        this.uploader = new uploader_js_1.BuildlogUploader({
            apiKey: config.apiKey,
        });
    }
    /**
     * Initialize the skill with OpenClaw context
     */
    async initialize(ctx) {
        // Update config from context
        if (ctx.config.apiKey) {
            this.uploader.setApiKey(ctx.config.apiKey);
        }
        // Subscribe to OpenClaw events for real-time recording
        this.subscribeToEvents(ctx);
    }
    /**
     * Handle a user message and check for commands
     */
    async handleMessage(ctx, message) {
        const trimmed = message.trim();
        for (const command of this.commands) {
            const match = trimmed.match(command.pattern);
            if (match) {
                await command.handler(ctx, match);
                return true;
            }
        }
        return false;
    }
    /**
     * Cleanup when skill is unloaded
     */
    dispose() {
        for (const unsub of this.unsubscribers) {
            unsub();
        }
        this.unsubscribers = [];
        if (this.recorder.isRecording()) {
            this.recorder.stop();
        }
    }
    // Command handlers
    async handleStart(ctx, match) {
        const title = match[3]?.trim() || 'Untitled Buildlog';
        try {
            this.recorder.start(title);
            ctx.respond(`🔴 Recording started: "${title}"\n\nI'll capture this session. Say "stop the buildlog" when you're done.`);
            ctx.events.emit('buildlog:started', { title });
        }
        catch (error) {
            ctx.respond(`❌ ${error instanceof Error ? error.message : 'Failed to start recording'}`);
        }
    }
    async handleStop(ctx, _match) {
        try {
            const session = this.recorder.stop();
            if (!session) {
                ctx.respond('❌ No recording to stop');
                return;
            }
            this.lastBuildlog = this.sessionToBuildlog(session);
            const entryCount = this.lastBuildlog.entries.length;
            ctx.events.emit('buildlog:stopped', { entryCount });
            if (this.config.autoUpload) {
                const result = await this.uploadBuildlog(ctx);
                if (result.success) {
                    ctx.respond(`✅ Recording stopped. ${entryCount} exchanges captured and uploaded.\n\n🔗 ${result.url}`);
                }
                else {
                    ctx.respond(`✅ Recording stopped. ${entryCount} exchanges captured.\n\n❌ Upload failed: ${result.error}\n\nSay "upload the buildlog" to try again.`);
                }
            }
            else {
                const shouldUpload = await ctx.confirm(`Recording stopped. ${entryCount} exchanges captured.\n\nWould you like to upload to buildlog.ai?`);
                if (shouldUpload) {
                    await this.handleUpload(ctx, []);
                }
                else {
                    ctx.respond('Buildlog saved locally. Say "upload the buildlog" when ready.');
                }
            }
        }
        catch (error) {
            ctx.respond(`❌ ${error instanceof Error ? error.message : 'Failed to stop recording'}`);
        }
    }
    async handlePause(ctx, _match) {
        try {
            this.recorder.pause();
            ctx.respond('⏸️ Recording paused. Say "resume the buildlog" to continue.');
            ctx.events.emit('buildlog:paused', {});
        }
        catch (error) {
            ctx.respond(`❌ ${error instanceof Error ? error.message : 'Failed to pause recording'}`);
        }
    }
    async handleResume(ctx, _match) {
        try {
            this.recorder.resume();
            ctx.respond('🔴 Recording resumed.');
            ctx.events.emit('buildlog:resumed', {});
        }
        catch (error) {
            ctx.respond(`❌ ${error instanceof Error ? error.message : 'Failed to resume recording'}`);
        }
    }
    async handleExport(ctx, _match) {
        try {
            this.lastBuildlog = this.exporter.export(ctx.session.history);
            const entryCount = this.lastBuildlog.entries.length;
            const title = this.lastBuildlog.metadata.title;
            ctx.respond(`✅ Exported ${entryCount} exchanges as buildlog.\n\n📝 Title: "${title}"\n\nSay "upload the buildlog" to share on buildlog.ai.`);
        }
        catch (error) {
            ctx.respond(`❌ Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async handleExportLastN(ctx, match) {
        const n = parseInt(match[2], 10);
        try {
            this.lastBuildlog = this.exporter.exportLastN(ctx.session.history, n);
            const entryCount = this.lastBuildlog.entries.length;
            ctx.respond(`✅ Exported last ${entryCount} exchanges as buildlog.\n\nSay "upload the buildlog" to share.`);
        }
        catch (error) {
            ctx.respond(`❌ Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async handleUpload(ctx, _match) {
        if (!this.lastBuildlog) {
            // Try to get from current recording or export session
            if (this.recorder.isRecording()) {
                this.lastBuildlog = this.recorder.toBuildlog();
            }
            else {
                this.lastBuildlog = this.exporter.export(ctx.session.history);
            }
        }
        if (!this.lastBuildlog) {
            ctx.respond('❌ No buildlog to upload. Try "export this session as a buildlog" first.');
            return;
        }
        const result = await this.uploadBuildlog(ctx);
        if (result.success) {
            ctx.respond(`✅ Uploaded to buildlog.ai!\n\n🔗 ${result.url}\n📋 Short link: ${result.shortUrl}`);
            ctx.events.emit('buildlog:uploaded', { url: result.url, id: result.id });
        }
        else {
            ctx.respond(`❌ Upload failed: ${result.error}\n\nPlease check your API key and try again.`);
            ctx.events.emit('buildlog:error', { error: result.error });
        }
    }
    async handleShare(ctx, match) {
        // Share is just upload with public visibility
        await this.handleUpload(ctx, match);
    }
    async handleAddNote(ctx, match) {
        const noteText = match[2]?.trim();
        if (!noteText) {
            ctx.respond('❌ Please provide note text. Example: "add a note: This is important"');
            return;
        }
        try {
            this.recorder.addNote(noteText);
            ctx.respond(`📝 Note added: "${noteText}"`);
        }
        catch (error) {
            ctx.respond(`❌ ${error instanceof Error ? error.message : 'Failed to add note'}`);
        }
    }
    async handleAddChapter(ctx, match) {
        const title = match[2]?.trim();
        if (!title) {
            ctx.respond('❌ Please provide chapter title. Example: "add chapter: Setup"');
            return;
        }
        try {
            this.recorder.addChapter(title);
            ctx.respond(`📖 Chapter added: "${title}"`);
        }
        catch (error) {
            ctx.respond(`❌ ${error instanceof Error ? error.message : 'Failed to add chapter'}`);
        }
    }
    async handleMarkImportant(ctx, _match) {
        try {
            this.recorder.markImportant();
            ctx.respond('⭐ Marked as important');
        }
        catch (error) {
            ctx.respond(`❌ ${error instanceof Error ? error.message : 'Failed to mark important'}`);
        }
    }
    async handleStatus(ctx, _match) {
        const status = this.recorder.getStatus();
        const stateEmoji = {
            idle: '⚪',
            recording: '🔴',
            paused: '⏸️',
        };
        let message = `${stateEmoji[status.state]} Buildlog Status: ${status.state.toUpperCase()}`;
        if (status.state !== 'idle') {
            const duration = Math.round(status.duration / 1000);
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            message += `\n\n📝 Title: "${status.title}"`;
            message += `\n⏱️ Duration: ${minutes}m ${seconds}s`;
            message += `\n💬 Exchanges: ${status.entryCount}`;
            if (status.noteCount > 0)
                message += `\n📝 Notes: ${status.noteCount}`;
            if (status.chapterCount > 0)
                message += `\n📖 Chapters: ${status.chapterCount}`;
        }
        if (this.lastBuildlog && status.state === 'idle') {
            message += `\n\n📦 Last buildlog ready to upload (${this.lastBuildlog.entries.length} entries)`;
        }
        ctx.respond(message);
    }
    async handleInfo(ctx, _match) {
        await this.handleStatus(ctx, []);
    }
    // Private helpers
    subscribeToEvents(ctx) {
        // Subscribe to user messages
        const unsubUser = ctx.events.on('user_message', (data) => {
            this.recorder.handleEvent({
                type: 'user_message',
                timestamp: Date.now(),
                data,
            });
        });
        this.unsubscribers.push(unsubUser);
        // Subscribe to assistant messages
        const unsubAssistant = ctx.events.on('assistant_message', (data) => {
            this.recorder.handleEvent({
                type: 'assistant_message',
                timestamp: Date.now(),
                data,
            });
        });
        this.unsubscribers.push(unsubAssistant);
        // Subscribe to file changes
        const unsubFiles = ctx.events.on('file_change', (data) => {
            this.recorder.handleEvent({
                type: 'file_change',
                timestamp: Date.now(),
                data,
            });
        });
        this.unsubscribers.push(unsubFiles);
        // Subscribe to terminal commands
        const unsubTerminal = ctx.events.on('terminal_command', (data) => {
            this.recorder.handleEvent({
                type: 'terminal_command',
                timestamp: Date.now(),
                data,
            });
        });
        this.unsubscribers.push(unsubTerminal);
    }
    sessionToBuildlog(session) {
        return {
            version: '1.0.0',
            metadata: {
                id: session.id,
                title: session.title,
                createdAt: new Date(session.startedAt).toISOString(),
                duration: Date.now() - session.startedAt,
                entryCount: session.entries.length,
                ...session.metadata,
            },
            entries: session.entries,
            chapters: session.chapters.map((ch) => ({
                title: ch.title,
                startIndex: ch.entryIndex,
            })),
        };
    }
    async uploadBuildlog(ctx) {
        if (!this.lastBuildlog) {
            return {
                success: false,
                error: 'No buildlog to upload',
                errorCode: 'NO_BUILDLOG',
            };
        }
        return this.uploader.upload(this.lastBuildlog, {
            isPublic: this.config.defaultPublic ?? true,
        });
    }
}
exports.BuildlogSkill = BuildlogSkill;
/**
 * Create and initialize skill instance
 */
function createBuildlogSkill(config = {}) {
    return new BuildlogSkill(config);
}
//# sourceMappingURL=skill.js.map