/**
 * @buildlog/openclaw-skill
 *
 * Record, export, and share your AI coding sessions as replayable buildlogs.
 *
 * @example
 * ```typescript
 * import { BuildlogSkill, createBuildlogSkill } from '@buildlog/openclaw-skill';
 *
 * const skill = createBuildlogSkill({
 *   apiKey: 'your-api-key',
 *   autoUpload: false,
 *   defaultPublic: true,
 * });
 *
 * await skill.initialize(openClawContext);
 * ```
 */
export { BuildlogSkill, createBuildlogSkill } from './skill.js';
export type { SkillConfig, OpenClawContext, CommandMatch } from './skill.js';
export { BuildlogRecorder } from './recorder.js';
export type { RecorderState, RecorderConfig, RecordingSession, Note, Chapter, OpenClawEvent, UserMessageEvent, AssistantMessageEvent, FileChangeEvent, TerminalCommandEvent, } from './recorder.js';
export { BuildlogExporter, exportSession } from './exporter.js';
export type { SessionMessage, SessionHistory, ExportOptions, } from './exporter.js';
export { BuildlogUploader, UploadError, uploadBuildlog } from './uploader.js';
export type { UploadConfig, UploadOptions, UploadResult, BuildlogInfo, } from './uploader.js';
export type { Buildlog, BuildlogEntry, BuildlogMetadata, FileChange, TerminalCommand, BuildlogChapter, } from './types.js';
import { BuildlogSkill } from './skill.js';
export default BuildlogSkill;
//# sourceMappingURL=index.d.ts.map