# @buildlog/openclaw-skill

Record, export, and share your AI coding sessions as replayable buildlogs.

[![npm version](https://badge.fury.io/js/@buildlog%2Fopenclaw-skill.svg)](https://www.npmjs.com/package/@buildlog/openclaw-skill)
[![ClawHub](https://img.shields.io/badge/ClawHub-buildlog-blue)](https://clawhub.io/skills/buildlog)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

The buildlog skill captures your OpenClaw AI-assisted coding sessions in real-time, creating replayable recordings that can be shared on [buildlog.ai](https://buildlog.ai).

Perfect for:
- 📚 **Tutorials** — Share how you built something step-by-step
- 📝 **Documentation** — Create living documentation of complex implementations
- 🐛 **Debugging** — Review sessions to understand what went wrong
- 🎓 **Learning** — Study how others approach problems

## Installation

### From ClawHub (Recommended)

```bash
openclaw skill install buildlog
```

### From npm

```bash
npm install @buildlog/openclaw-skill
```

## Quick Start

Once installed, just talk to OpenClaw:

```
You: Start a buildlog "Building a REST API"
🔴 Recording started: "Building a REST API"

You: Create an Express server with TypeScript
[OpenClaw creates files...]

You: Stop the buildlog
✅ Recording stopped. 12 exchanges captured.
Would you like to upload to buildlog.ai?

You: Yes
✅ Uploaded to buildlog.ai!
🔗 https://buildlog.ai/b/abc123
```

## Commands

### Recording

| Command | Description |
|---------|-------------|
| `Start a buildlog [title]` | Begin recording a new session |
| `Stop the buildlog` | End recording and optionally upload |
| `Pause the buildlog` | Temporarily pause recording |
| `Resume the buildlog` | Continue a paused recording |

### Exporting

| Command | Description |
|---------|-------------|
| `Export this session as a buildlog` | Convert current session to buildlog format |
| `Export the last [N] messages` | Export a portion of the session |

### Uploading

| Command | Description |
|---------|-------------|
| `Upload the buildlog` | Push to buildlog.ai |
| `Share the buildlog` | Upload and get a shareable link |

### Annotations

| Command | Description |
|---------|-------------|
| `Add a note: [text]` | Add commentary to the current point |
| `Mark this as important` | Flag the current exchange |
| `Add chapter: [title]` | Create a chapter marker |

### Status

| Command | Description |
|---------|-------------|
| `Buildlog status` | Check recording state |
| `Show buildlog info` | Display current recording details |

## Configuration

Add to your OpenClaw configuration file (`~/.openclaw/config.json`):

```json
{
  "skills": {
    "buildlog": {
      "apiKey": "your-api-key",
      "autoUpload": false,
      "defaultPublic": true,
      "includeFileContents": true,
      "maxFileSizeKb": 100
    }
  }
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | — | Your buildlog.ai API key (optional for public uploads) |
| `autoUpload` | boolean | `false` | Automatically upload when recording stops |
| `defaultPublic` | boolean | `true` | Make buildlogs public by default |
| `includeFileContents` | boolean | `true` | Include file content snapshots |
| `maxFileSizeKb` | number | `100` | Maximum file size to include in buildlog |

## Programmatic Usage

You can also use the skill programmatically:

```typescript
import { 
  BuildlogRecorder, 
  BuildlogExporter, 
  BuildlogUploader 
} from '@buildlog/openclaw-skill';

// Create a recorder
const recorder = new BuildlogRecorder({
  includeFileContents: true,
  maxFileSizeKb: 100,
});

// Start recording
recorder.start('My Session');

// Handle events
recorder.handleEvent({
  type: 'user_message',
  timestamp: Date.now(),
  data: { content: 'Create a function...' },
});

// Stop and get buildlog
const session = recorder.stop();
const buildlog = recorder.toBuildlog();

// Upload
const uploader = new BuildlogUploader({ apiKey: 'your-key' });
const result = await uploader.upload(buildlog);

console.log('Uploaded:', result.url);
```

### Retroactive Export

Export an existing session history:

```typescript
import { BuildlogExporter } from '@buildlog/openclaw-skill';

const exporter = new BuildlogExporter({
  title: 'My Coding Session',
  tags: ['typescript', 'api'],
});

const buildlog = exporter.export(sessionHistory);
```

## Events

The skill emits the following events that you can subscribe to:

```typescript
skill.recorder.on('started', (event) => {
  console.log('Recording started:', event.data.title);
});

skill.recorder.on('stopped', (event) => {
  console.log('Recording stopped:', event.data.session);
});
```

| Event | Description |
|-------|-------------|
| `buildlog:started` | Recording began |
| `buildlog:stopped` | Recording ended |
| `buildlog:paused` | Recording paused |
| `buildlog:resumed` | Recording resumed |
| `buildlog:uploaded` | Buildlog uploaded successfully |
| `buildlog:error` | An error occurred |

## API Reference

### BuildlogSkill

Main skill class for OpenClaw integration.

```typescript
const skill = createBuildlogSkill(config);
await skill.initialize(openClawContext);
const handled = await skill.handleMessage(ctx, 'start a buildlog');
skill.dispose();
```

### BuildlogRecorder

State machine for recording sessions.

```typescript
const recorder = new BuildlogRecorder(config);
recorder.start('Title');
recorder.handleEvent(event);
recorder.addNote('Important point');
recorder.addChapter('Setup');
recorder.pause();
recorder.resume();
const session = recorder.stop();
```

### BuildlogExporter

Convert session history to buildlog format.

```typescript
const exporter = new BuildlogExporter(options);
const buildlog = exporter.export(sessionHistory);
const partial = exporter.exportLastN(sessionHistory, 10);
```

### BuildlogUploader

Upload buildlogs to buildlog.ai.

```typescript
const uploader = new BuildlogUploader({ apiKey });
const result = await uploader.upload(buildlog, options);
const info = await uploader.getInfo(id);
await uploader.delete(id);
```

## Privacy

- 🔒 Buildlogs can be public or private
- 🔑 API keys are never included in exports
- 🎛️ You control what gets shared
- 🗑️ Delete buildlogs anytime at buildlog.ai

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run dev
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © [buildlog.ai](https://buildlog.ai)

## Links

- [buildlog.ai](https://buildlog.ai) — View and share buildlogs
- [Documentation](https://docs.buildlog.ai) — Full documentation
- [ClawHub](https://clawhub.io/skills/buildlog) — Skill registry listing
- [GitHub](https://github.com/buildlog/openclaw-skill) — Source code
