import { type SessionHistory } from './exporter.js';
/**
 * OpenClaw Skill interface (provided by OpenClaw runtime)
 */
export interface OpenClawContext {
    config: SkillConfig;
    session: {
        id: string;
        history: SessionHistory;
    };
    events: {
        on(event: string, handler: (data: unknown) => void): () => void;
        emit(event: string, data: unknown): void;
    };
    respond(message: string): void;
    ask(question: string): Promise<string>;
    confirm(question: string): Promise<boolean>;
}
export interface SkillConfig {
    apiKey?: string;
    autoUpload?: boolean;
    defaultPublic?: boolean;
    fullFormat?: boolean;
    aiProvider?: string;
}
export interface CommandMatch {
    pattern: RegExp;
    handler: (ctx: OpenClawContext, match: RegExpMatchArray) => Promise<void>;
}
/**
 * BuildlogSkill - Main skill implementation for OpenClaw
 *
 * v2: Captures workflow recipes, not session replays.
 * Prompts are the artifact. Code is ephemeral.
 */
export declare class BuildlogSkill {
    private recorder;
    private exporter;
    private uploader;
    private config;
    private lastBuildlog;
    private unsubscribers;
    private commands;
    constructor(config?: SkillConfig);
    /**
     * Initialize the skill with OpenClaw context
     */
    initialize(ctx: OpenClawContext): Promise<void>;
    /**
     * Handle a user message and check for commands
     */
    handleMessage(ctx: OpenClawContext, message: string): Promise<boolean>;
    /**
     * Cleanup when skill is unloaded
     */
    dispose(): void;
    private handleStart;
    private handleStop;
    private handlePause;
    private handleResume;
    private handleExport;
    private handleExportLastN;
    private handleUpload;
    private handleShare;
    private handleAddPrompt;
    private handleAddAction;
    private handleAddNote;
    private handleAddCheckpoint;
    private handleStatus;
    private handleInfo;
    private subscribeToEvents;
    private uploadBuildlog;
}
/**
 * Create and initialize skill instance
 */
export declare function createBuildlogSkill(config?: SkillConfig): BuildlogSkill;
//# sourceMappingURL=skill.d.ts.map