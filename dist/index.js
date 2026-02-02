"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadBuildlog = exports.UploadError = exports.BuildlogUploader = exports.exportSession = exports.BuildlogExporter = exports.BuildlogRecorder = exports.createBuildlogSkill = exports.BuildlogSkill = void 0;
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
// Uploader exports
var uploader_js_1 = require("./uploader.js");
Object.defineProperty(exports, "BuildlogUploader", { enumerable: true, get: function () { return uploader_js_1.BuildlogUploader; } });
Object.defineProperty(exports, "UploadError", { enumerable: true, get: function () { return uploader_js_1.UploadError; } });
Object.defineProperty(exports, "uploadBuildlog", { enumerable: true, get: function () { return uploader_js_1.uploadBuildlog; } });
// Default export for OpenClaw skill registration
const skill_js_2 = require("./skill.js");
exports.default = skill_js_2.BuildlogSkill;
//# sourceMappingURL=index.js.map