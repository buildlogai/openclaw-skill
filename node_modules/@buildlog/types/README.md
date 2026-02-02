# @buildlog/types

> Portable workflow format for AI-assisted development

Type definitions and Zod schemas for the `.buildlog` file format v2.0.

## What's a Buildlog?

A buildlog is a **workflow recipe** — a lightweight, portable format that captures your AI coding sessions as replicable workflows. Think of it as `package.json` for vibe coding.

**Key insight:** The prompts are the artifact. The code is ephemeral and non-deterministic. We capture the workflow, not the output.

## Installation

```bash
npm install @buildlog/types
# or
pnpm add @buildlog/types
```

## Slim vs Full Format

Buildlog v2 introduces two capture formats:

| Format | Size | Contents | Use Case |
|--------|------|----------|----------|
| **slim** (default) | 2-50 KB | Prompts + summaries | Sharing, agent replication |
| **full** | 1-50 MB | + AI responses, diffs | Debugging, detailed review |

## Usage

### TypeScript Types

```typescript
import type { 
  BuildlogFile, 
  BuildlogStep, 
  PromptStep,
  ActionStep 
} from '@buildlog/types';

const buildlog: BuildlogFile = {
  version: '2.0.0',
  format: 'slim',
  metadata: {
    id: 'uuid-here',
    title: 'Add Stripe Integration',
    createdAt: '2026-02-01T14:30:00Z',
    durationSeconds: 720,
    editor: 'cursor',
    aiProvider: 'claude',
    replicable: true,
  },
  steps: [
    {
      id: 'step-1',
      type: 'prompt',
      timestamp: 0,
      sequence: 0,
      content: 'Add Stripe subscription checkout to this Next.js app',
      context: ['package.json', 'app/layout.tsx'],
    },
    {
      id: 'step-2',
      type: 'action',
      timestamp: 45,
      sequence: 1,
      summary: 'Created checkout API route and webhook handler',
      filesCreated: ['app/api/checkout/route.ts', 'app/api/webhook/route.ts'],
      packagesAdded: ['stripe', '@stripe/stripe-js'],
    },
  ],
  outcome: {
    status: 'success',
    summary: 'Built working Stripe integration with checkout and webhooks',
    filesCreated: 4,
    filesModified: 2,
    canReplicate: true,
  },
};
```

### Validation

```typescript
import { validateBuildlog, parseBuildlog } from '@buildlog/types';

// Validate unknown data
const result = validateBuildlog(data);
if (result.valid) {
  console.log('Valid buildlog!');
  if (result.warnings) {
    console.warn('Warnings:', result.warnings);
  }
} else {
  console.error('Errors:', result.errors);
}

// Parse and validate JSON
const buildlog = parseBuildlog(jsonString);
```

### Utilities

```typescript
import { 
  isBuildlogFile,
  computeStats,
  formatDuration,
  estimateBuildlogSize,
  isReplicable,
  toSlim,
  getStepIcon,
} from '@buildlog/types';

isBuildlogFile('session.buildlog'); // true
estimateBuildlogSize(buildlog); // 'tiny' | 'small' | 'medium' | 'large'
isReplicable(buildlog); // true
formatDuration(720); // '12m 0s'

// Convert full buildlog to slim (strips AI responses & diffs)
const slim = toSlim(fullBuildlog);
```

## Step Types

| Type | Description | Always Captured |
|------|-------------|-----------------|
| `prompt` | User prompt to AI | Full content ✓ |
| `action` | Summary of AI changes | Summary only (full response in full mode) |
| `terminal` | Terminal command | Command + outcome |
| `note` | Human annotation | Full content |
| `checkpoint` | Milestone marker | Name + summary |
| `error` | Error encountered | Message + resolution |

## For Agent Consumption

Buildlogs are designed to be **agent-consumable**. Another AI agent can read a buildlog and replicate the workflow:

```typescript
// Agent reads buildlog
const buildlog = parseBuildlog(content);

if (buildlog.outcome.canReplicate) {
  for (const step of buildlog.steps) {
    if (step.type === 'prompt') {
      // Execute this prompt in current context
      await agent.execute(step.content);
    }
  }
}
```

## Migration from v1

See [MIGRATION.md](./MIGRATION.md) for upgrading from buildlog v1.

## License

MIT
