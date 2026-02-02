"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildlogSkill = void 0;
exports.createBuildlogSkill = createBuildlogSkill;
const recorder_js_1 = require("./recorder.js");
const exporter_js_1 = require("./exporter.js");
const uploader_js_1 = require("./uploader.js");
/**
 * BuildlogSkill - Main skill implementation for OpenClaw
 *
 * v2: Captures workflow recipes, not session replays.
 * Prompts are the artifact. Code is ephemeral.
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
        // Add prompt (explicit)
        {
            pattern: /^add\s+(a\s+)?prompt[:\-]?\s+(.+)$/i,
            handler: this.handleAddPrompt.bind(this),
        },
        // Add action
        {
            pattern: /^add\s+(an\s+)?action[:\-]?\s+(.+)$/i,
            handler: this.handleAddAction.bind(this),
        },
        // Add note
        {
            pattern: /^add\s+(a\s+)?note[:\-]?\s+(.+)$/i,
            handler: this.handleAddNote.bind(this),
        },
        // Add checkpoint
        {
            pattern: /^(add\s+)?(checkpoint|milestone)[:\-]?\s+(.+)$/i,
            handler: this.handleAddCheckpoint.bind(this),
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
        const recorderConfig = {
            fullFormat: config.fullFormat ?? false,
            aiProvider: (config.aiProvider ?? 'other'),
        };
        this.recorder = new recorder_js_1.BuildlogRecorder(recorderConfig);
        this.exporter = new exporter_js_1.BuildlogExporter({
            format: config.fullFormat ? 'full' : 'slim',
            aiProvider: config.aiProvider,
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
        const title = match[3]?.trim() || 'Untitled Workflow';
        try {
            this.recorder.start(title);
            ctx.respond(`🔴 Recording started: "${title}"\n\nI'll capture this workflow. Say "stop the buildlog" when you're done.`);
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
            this.lastBuildlog = this.recorder.toBuildlog();
            const stepCount = this.lastBuildlog?.steps.length ?? 0;
            const promptCount = this.lastBuildlog?.metadata?.promptCount ?? 0;
            ctx.events.emit('buildlog:stopped', { stepCount, promptCount });
            if (this.config.autoUpload) {
                const result = await this.uploadBuildlog(ctx);
                if (result.success) {
                    ctx.respond(`✅ Workflow captured. ${promptCount} prompts, ${stepCount} steps.\n\n🔗 ${result.url}`);
                }
                else {
                    ctx.respond(`✅ Workflow captured. ${promptCount} prompts, ${stepCount} steps.\n\n❌ Upload failed: ${result.error}\n\nSay "upload the buildlog" to try again.`);
                }
            }
            else {
                const shouldUpload = await ctx.confirm(`Workflow captured. ${promptCount} prompts, ${stepCount} steps.\n\nUpload to buildlog.ai?`);
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
            const stepCount = this.lastBuildlog?.steps.length ?? 0;
            const promptCount = this.lastBuildlog?.metadata?.promptCount ?? 0;
            const title = this.lastBuildlog?.metadata?.title ?? 'Untitled';
            ctx.respond(`✅ Exported workflow: "${title}"\n\n📊 ${promptCount} prompts, ${stepCount} steps\n\nSay "upload the buildlog" to share.`);
        }
        catch (error) {
            ctx.respond(`❌ Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async handleExportLastN(ctx, match) {
        const n = parseInt(match[2], 10);
        try {
            this.lastBuildlog = this.exporter.exportLastN(ctx.session.history, n);
            const stepCount = this.lastBuildlog.steps.length;
            ctx.respond(`✅ Exported last ${n} exchanges as workflow (${stepCount} steps).\n\nSay "upload the buildlog" to share.`);
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
    async handleAddPrompt(ctx, match) {
        const promptText = match[2]?.trim();
        if (!promptText) {
            ctx.respond('❌ Please provide prompt text. Example: "add a prompt: Create a React component"');
            return;
        }
        try {
            this.recorder.addPrompt(promptText);
            ctx.respond(`💬 Prompt added: "${promptText.slice(0, 50)}${promptText.length > 50 ? '...' : ''}"`);
        }
        catch (error) {
            ctx.respond(`❌ ${error instanceof Error ? error.message : 'Failed to add prompt'}`);
        }
    }
    async handleAddAction(ctx, match) {
        const summary = match[2]?.trim();
        if (!summary) {
            ctx.respond('❌ Please provide action summary. Example: "add an action: Created user service"');
            return;
        }
        try {
            this.recorder.addAction(summary, {});
            ctx.respond(`⚡ Action added: "${summary}"`);
        }
        catch (error) {
            ctx.respond(`❌ ${error instanceof Error ? error.message : 'Failed to add action'}`);
        }
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
    async handleAddCheckpoint(ctx, match) {
        const label = match[3]?.trim();
        if (!label) {
            ctx.respond('❌ Please provide checkpoint label. Example: "checkpoint: Feature complete"');
            return;
        }
        try {
            this.recorder.addCheckpoint(label);
            ctx.respond(`🏁 Checkpoint added: "${label}"`);
        }
        catch (error) {
            ctx.respond(`❌ ${error instanceof Error ? error.message : 'Failed to add checkpoint'}`);
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
            message += `\n💬 Prompts: ${status.promptCount}`;
            message += `\n📊 Total steps: ${status.stepCount}`;
        }
        if (this.lastBuildlog && status.state === 'idle') {
            message += `\n\n📦 Last buildlog ready to upload (${this.lastBuildlog.steps.length} steps)`;
        }
        ctx.respond(message);
    }
    async handleInfo(ctx, _match) {
        await this.handleStatus(ctx, []);
    }
    // Private helpers
    subscribeToEvents(ctx) {
        // Subscribe to user messages (capture as prompts)
        const unsubUser = ctx.events.on('user_message', (data) => {
            const msg = data;
            if (msg.content) {
                this.recorder.addPrompt(msg.content, { context: msg.context });
            }
        });
        this.unsubscribers.push(unsubUser);
        // Subscribe to file changes (batch into actions)
        const unsubFiles = ctx.events.on('file_change', (data) => {
            const change = data;
            // File changes are tracked internally and batched
            this.recorder.trackFileChange(change.path, change.changeType ?? 'modified');
        });
        this.unsubscribers.push(unsubFiles);
        // Subscribe to terminal commands
        const unsubTerminal = ctx.events.on('terminal_command', (data) => {
            const cmd = data;
            this.recorder.addTerminal(cmd.command, cmd.cwd, cmd.exitCode);
        });
        this.unsubscribers.push(unsubTerminal);
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