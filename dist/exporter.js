"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildlogExporter = exports.MAX_SLIM_SIZE_BYTES = exports.DEFAULT_FORMAT = exports.BUILDLOG_VERSION = void 0;
exports.exportSession = exportSession;
// Re-export constants
exports.BUILDLOG_VERSION = '2.0.0';
exports.DEFAULT_FORMAT = 'slim';
exports.MAX_SLIM_SIZE_BYTES = 100 * 1024; // 100KB
const DEFAULT_OPTIONS = {
    includeSystemMessages: false,
    format: 'slim',
};
/**
 * BuildlogExporter - Convert session history to v2 buildlog format
 *
 * Exports workflow recipes focused on prompts as artifacts.
 * Supports both slim (default, 2-50KB) and full (with responses) formats.
 */
class BuildlogExporter {
    options;
    constructor(options = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }
    /**
     * Export a session history to v2 buildlog format
     */
    export(history) {
        const messages = this.filterMessages(history.messages);
        const steps = this.convertToSteps(messages, history);
        const metadata = this.buildMetadata(history, steps);
        const buildlog = {
            version: exports.BUILDLOG_VERSION,
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
    exportLastN(history, n) {
        const limitedHistory = {
            ...history,
            messages: history.messages.slice(-n),
        };
        return this.export(limitedHistory);
    }
    /**
     * Export a range of messages
     */
    exportRange(history, start, end) {
        const limitedHistory = {
            ...history,
            messages: history.messages.slice(start, end),
        };
        return this.export(limitedHistory);
    }
    /**
     * Convert to slim format (strip full data)
     */
    toSlim(buildlog) {
        if (buildlog.format === 'slim') {
            return buildlog;
        }
        const slim = {
            ...buildlog,
            format: 'slim',
            steps: buildlog.steps.map((step) => {
                if (step.type === 'prompt' && 'response' in step) {
                    const { response, ...rest } = step;
                    return rest;
                }
                if (step.type === 'action' && 'diff' in step) {
                    const { diff, ...rest } = step;
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
    convertToSteps(messages, history) {
        const steps = [];
        // Create a timeline of all events
        const timeline = [];
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
                    steps.push(this.messageToPromptStep(event.data, event.timestamp, stepIndex++));
                    break;
                case 'action':
                    steps.push(this.fileChangeToActionStep(event.data, event.timestamp, stepIndex++));
                    break;
                case 'terminal':
                    steps.push(this.terminalToStep(event.data, event.timestamp, stepIndex++));
                    break;
            }
        }
        return steps;
    }
    /**
     * Convert a user message to a prompt step
     */
    messageToPromptStep(message, timestamp, index) {
        const step = {
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
    fileChangeToActionStep(fileChange, timestamp, index) {
        const step = {
            type: 'action',
            timestamp,
            index,
            summary: `${this.capitalizeFirst(fileChange.changeType)} ${fileChange.path}`,
            files: [fileChange.path],
            changeType: fileChange.changeType,
        };
        // Only include diff in full format
        if (this.options.format === 'full' && fileChange.content) {
            step.diff = fileChange.content;
        }
        return step;
    }
    /**
     * Convert a terminal command to a terminal step
     */
    terminalToStep(command, timestamp, index) {
        const step = {
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
    filterMessages(messages) {
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
    buildMetadata(history, steps) {
        const now = new Date().toISOString();
        const timestamps = steps.map((s) => s.timestamp).filter(Boolean);
        const duration = timestamps.length >= 2
            ? Math.max(...timestamps) - Math.min(...timestamps)
            : 0;
        const promptCount = steps.filter((s) => s.type === 'prompt').length;
        const metadata = {
            id: this.generateId(),
            title: this.options.title ?? this.inferTitle(history) ?? 'Untitled Workflow',
            createdAt: now,
        };
        if (this.options.description) {
            metadata.description = this.options.description;
        }
        else {
            const inferred = this.inferDescription(steps);
            if (inferred)
                metadata.description = inferred;
        }
        if (duration > 0)
            metadata.duration = duration;
        if (this.options.author)
            metadata.author = { name: this.options.author };
        if (this.options.tags && this.options.tags.length > 0) {
            metadata.tags = this.options.tags;
        }
        else {
            const inferredTags = this.inferTags(history);
            if (inferredTags.length > 0)
                metadata.tags = inferredTags;
        }
        metadata.stepCount = steps.length;
        metadata.promptCount = promptCount;
        if (this.options.aiProvider)
            metadata.aiProvider = this.options.aiProvider;
        if (this.options.editor)
            metadata.editor = this.options.editor;
        // Merge with session metadata
        if (history.metadata) {
            Object.assign(metadata, history.metadata);
        }
        return metadata;
    }
    /**
     * Try to infer a title from the session content
     */
    inferTitle(history) {
        // Look for the first substantial user message
        const firstUserMessage = history.messages.find((m) => m.role === 'user' && m.content.length > 10);
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
    inferDescription(steps) {
        const promptCount = steps.filter((s) => s.type === 'prompt').length;
        const actionCount = steps.filter((s) => s.type === 'action').length;
        const terminalCount = steps.filter((s) => s.type === 'terminal').length;
        const parts = [];
        if (promptCount > 0)
            parts.push(`${promptCount} prompt${promptCount > 1 ? 's' : ''}`);
        if (actionCount > 0)
            parts.push(`${actionCount} action${actionCount > 1 ? 's' : ''}`);
        if (terminalCount > 0)
            parts.push(`${terminalCount} command${terminalCount > 1 ? 's' : ''}`);
        return parts.length > 0 ? `Workflow with ${parts.join(', ')}` : undefined;
    }
    /**
     * Try to infer tags from file extensions and content
     */
    inferTags(history) {
        const tags = new Set();
        // Infer from file extensions
        if (history.fileChanges) {
            for (const fc of history.fileChanges) {
                const ext = fc.path.split('.').pop()?.toLowerCase();
                if (ext) {
                    const langMap = {
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
    inferOutcome(history) {
        const lastMessage = history.messages.findLast((m) => m.role === 'assistant');
        if (!lastMessage)
            return undefined;
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
        }
        else if (hasFailure && !hasSuccess) {
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
    generateId() {
        return `bl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
    /**
     * Capitalize first letter
     */
    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
exports.BuildlogExporter = BuildlogExporter;
/**
 * Convenience function to export a session
 */
function exportSession(history, options = {}) {
    const exporter = new BuildlogExporter(options);
    return exporter.export(history);
}
//# sourceMappingURL=exporter.js.map