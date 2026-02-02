"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.STEP_TYPE_ICONS = exports.uploadBuildlog = exports.UploadError = exports.BuildlogUploader = exports.MAX_SLIM_SIZE_BYTES = exports.DEFAULT_FORMAT = exports.BUILDLOG_VERSION = exports.exportSession = exports.BuildlogExporter = exports.BuildlogRecorder = exports.createBuildlogSkill = exports.BuildlogSkill = void 0;
// Main skill export
var skill_js_1 = require("./skill.js");
Object.defineProperty(exports, "BuildlogSkill", { enumerable: true, get: function () { return skill_js_1.BuildlogSkill; } });
Object.defineProperty(exports, "createBuildlogSkill", { enumerable: true, get: function () { return skill_js_1.createBuildlogSkill; } });
// Recorder exports
var recorder_js_1 = require("./recorder.js");
Object.defineProperty(exports, "BuildlogRecorder", { enumerable: true, get: function () { return recorder_js_1.BuildlogRecorder; } });
// Exporter exports
var exporter_js_1 = require("./exporter.js");
Object.defineProperty(exports, "BuildlogExporter", { enumerable: true, get: function () { return exporter_js_1.BuildlogExporter; } });
Object.defineProperty(exports, "exportSession", { enumerable: true, get: function () { return exporter_js_1.exportSession; } });
Object.defineProperty(exports, "BUILDLOG_VERSION", { enumerable: true, get: function () { return exporter_js_1.BUILDLOG_VERSION; } });
Object.defineProperty(exports, "DEFAULT_FORMAT", { enumerable: true, get: function () { return exporter_js_1.DEFAULT_FORMAT; } });
Object.defineProperty(exports, "MAX_SLIM_SIZE_BYTES", { enumerable: true, get: function () { return exporter_js_1.MAX_SLIM_SIZE_BYTES; } });
// Uploader exports
var uploader_js_1 = require("./uploader.js");
Object.defineProperty(exports, "BuildlogUploader", { enumerable: true, get: function () { return uploader_js_1.BuildlogUploader; } });
Object.defineProperty(exports, "UploadError", { enumerable: true, get: function () { return uploader_js_1.UploadError; } });
Object.defineProperty(exports, "uploadBuildlog", { enumerable: true, get: function () { return uploader_js_1.uploadBuildlog; } });
var types_js_1 = require("./types.js");
Object.defineProperty(exports, "STEP_TYPE_ICONS", { enumerable: true, get: function () { return types_js_1.STEP_TYPE_ICONS; } });
// Default export for OpenClaw skill registration
const skill_js_2 = require("./skill.js");
exports.default = skill_js_2.BuildlogSkill;
//# sourceMappingURL=index.js.map