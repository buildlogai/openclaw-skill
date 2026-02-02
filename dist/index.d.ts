/**
 * @buildlog/openclaw-skill
 *
 * Capture workflow recipes from AI coding sessions.
 * Prompts are the artifact. Code is ephemeral.
 *
 * @example
 * ```typescript
 * import { BuildlogSkill, createBuildlogSkill } from '@buildlog/openclaw-skill';
 *
 * const skill = createBuildlogSkill({
 *   apiKey: 'your-api-key',
 *   autoUpload: false,
 *   defaultPublic: true,
 *   fullFormat: false, // slim format by default (2-50KB)
 * });
 *
 * await skill.initialize(openClawContext);
 * ```
 */
export { BuildlogSkill, createBuildlogSkill } from './skill.js';
export type { SkillConfig, OpenClawContext, CommandMatch } from './skill.js';
export { BuildlogRecorder } from './recorder.js';
export type { RecorderState, RecorderConfig, RecordingSession, } from './recorder.js';
export { BuildlogExporter, exportSession, BUILDLOG_VERSION, DEFAULT_FORMAT, MAX_SLIM_SIZE_BYTES } from './exporter.js';
export type { SessionMessage, SessionHistory, ExportOptions, FileChangeInfo, TerminalCommandInfo, } from './exporter.js';
export { BuildlogUploader, UploadError, uploadBuildlog } from './uploader.js';
export type { UploadConfig, UploadOptions, UploadResult, BuildlogInfo, } from './uploader.js';
export type { BuildlogFile, BuildlogStep, BuildlogMetadata, PromptStep, ActionStep, TerminalStep, NoteStep, CheckpointStep, ErrorStep, NoteCategory, } from './types.js';
export { STEP_TYPE_ICONS } from './types.js';
import { BuildlogSkill } from './skill.js';
export default BuildlogSkill;
//# sourceMappingURL=index.d.ts.map