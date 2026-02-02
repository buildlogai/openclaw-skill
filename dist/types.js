"use strict";
/**
 * Type definitions for buildlog format v2
 * Slim workflow format - prompts are the artifact
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STEP_TYPE_ICONS = exports.BUILDLOG_VERSION = void 0;
// =============================================================================
// CONSTANTS
// =============================================================================
exports.BUILDLOG_VERSION = '2.0.0';
// =============================================================================
// STEP ICONS
// =============================================================================
exports.STEP_TYPE_ICONS = {
    prompt: '💬',
    action: '⚡',
    terminal: '🖥️',
    note: '📝',
    checkpoint: '🚩',
    error: '❌',
};
//# sourceMappingURL=types.js.map