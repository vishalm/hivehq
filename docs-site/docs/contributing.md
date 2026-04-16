---
sidebar_position: 10
title: "Contributing"
description: "Code style, testing, and contribution guidelines"
---

# Contributing

HIVE is open source. Contributions are welcome.

## Code Style

### TypeScript

All code is **TypeScript strict mode**:

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitAny": true,
    "noImplicitThis": true
  }
}
```

### Formatting

Use Prettier:

```bash
npm run format
npm run format:check
```

### Naming Conventions

- **Files**: lowercase-with-dashes.ts
- **Classes**: PascalCase
- **Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Interfaces**: PascalCase, prefix with I or use as-is

### Imports

Use absolute imports:

```typescript
// ✓ Good
import { Scout } from '@hive/scout';
import { createNode } from '@hive/node';

// ✗ Bad
import { Scout } from '../../../scout';
```

Configure in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@hive/*": ["packages/*"]
    }
  }
}
```

## Zod Schemas

All input validation uses Zod:

```typescript
import { z } from 'zod';

const TTPEvent = z.object({
  timestamp: z.string().datetime(),
  provider: z.enum(['openai', 'anthropic', 'ollama']),
  model: z.string(),
  tokens_prompt: z.number().int().nonnegative(),
  tokens_completion: z.number().int().nonnegative(),
});

// Validate
const event = TTPEvent.parse(data);
```

Frozen fields use `z.literal(false)`:

```typescript
const GovernanceBlock = z.object({
  pii_asserted: z.literal(false),        // Cannot be changed
  content_asserted: z.literal(false),    // Cannot be changed
});
```

## Testing

All packages must have tests. Use Vitest:

```bash
npm run test
npm run test:watch
npm run test:coverage
```

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { createScout } from '@hive/scout';

describe('Scout', () => {
  it('should batch events', async () => {
    const scout = createScout({ nodeUrl: 'http://localhost:3001' });

    scout.track({
      timestamp: new Date().toISOString(),
      provider: 'openai',
      model: 'gpt-4',
      tokens_prompt: 100,
      tokens_completion: 50,
      cost_usd: 0.003,
    });

    expect(scout.pendingEvents()).toHaveLength(1);
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect } from 'vitest';
import { createNode } from '@hive/node';

describe('Node API', () => {
  it('should ingest TTP batches', async () => {
    const node = await createNode({
      database: 'sqlite:./test.db',
    });

    const response = await fetch('http://localhost:3001/api/v1/ttp/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ... }),
    });

    expect(response.status).toBe(200);
    await node.close();
  });
});
```

## Adding a Connector

To add support for a new provider:

### Step 1: Create Package

```bash
mkdir packages/@hive/connector-newprovider
cd packages/@hive/connector-newprovider
npm init -y
npm install @hive/core @hive/scout
```

### Step 2: Implement Hook

```typescript
import { ProviderHook, TTPEvent } from '@hive/core';

export class NewProviderHook implements ProviderHook {
  name = 'newprovider';
  version = '1.0.0';

  intercept(request) { ... }
  parseResponse(response) { ... }
  createEvent(request, response, metadata) { ... }
}
```

### Step 3: Create Wrapper

```typescript
export function createNewProviderConnector(config) {
  const hook = new NewProviderHook(config.scout);
  return {
    createClient(apiKey) {
      // Return wrapped client
    }
  };
}
```

### Step 4: Add Tests

```typescript
describe('NewProvider Connector', () => {
  it('should track API calls', async () => { ... });
});
```

### Step 5: Submit PR

1. Fork the HIVE repository
2. Push your connector to a feature branch
3. Submit a PR with:
   - Implemented connector
   - Tests (> 80% coverage)
   - Documentation (README with examples)
   - Pricing table (if applicable)

## Package Structure

```
packages/
├── core/
│   ├── src/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── schemas.ts
│   ├── test/
│   │   └── *.test.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── scout/
├── node/
├── dashboard/
└── ...
```

## PR Workflow

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Make changes
3. Add tests for new code
4. Format: `npm run format`
5. Lint: `npm run lint`
6. Test: `npm run test`
7. Commit: `git commit -m "feat: add my feature"`
8. Push: `git push origin feat/my-feature`
9. Open a PR on GitHub

## Commit Messages

Follow Conventional Commits:

```
feat: add spend forecasting
fix: correct anomaly detection threshold
docs: update API reference
test: add unit tests for clustering
refactor: simplify cost calculation
chore: update dependencies
```

## Code Review

All PRs require:
- 1 approval from maintainer
- Tests passing (100% required)
- No linting errors
- No TypeScript errors

## Releasing

Only maintainers can release:

```bash
npm run version:bump:patch  # v1.0.1
npm run version:bump:minor  # v1.1.0
npm run version:bump:major  # v2.0.0

npm run publish
```

Package versions are synchronized.

## Reporting Issues

Found a bug? Open an issue:

1. Search existing issues first
2. Provide reproduction steps
3. Include error logs/screenshots
4. Mention your environment (OS, Node version, etc.)

## Roadmap

High-priority items:

- [ ] Multi-region support
- [ ] Advanced anomaly detection (ML-based)
- [ ] Custom metrics and dimensions
- [ ] GraphQL API
- [ ] Webhooks for events
- [ ] Spend attribution by user
- [ ] LLM fine-tuning cost calculator
- [ ] Open SaaS deployment

See GitHub Issues for more.

## Questions?

- **Slack**: #hive-dev (if available)
- **GitHub Discussions**: Ask in Q&A
- **Email**: contact@hivehq.dev

---

Thank you for contributing to HIVE!
