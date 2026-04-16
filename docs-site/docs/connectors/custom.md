---
sidebar_position: 5
title: "Building a Custom Connector"
description: "Create a HIVE connector for any AI provider"
---

# Building a Custom Connector

HIVE is designed to be extensible. Build a custom connector for any AI provider.

## Architecture

A connector implements two interfaces:

```typescript
interface ProviderHook {
  name: string;
  version: string;
  intercept(request: ApiRequest): InterceptionResult | undefined;
  parseResponse(response: ApiResponse): ParsedMetadata;
  createEvent(request, response, metadata): TTPEvent;
}

interface Connector {
  createClient(config): ProviderClient;
}
```

## Example: Custom Provider

Let's build a connector for "MyAI" (a fictional provider).

### Step 1: Scaffold the Package

```bash
mkdir @hive/connector-myai
cd @hive/connector-myai
npm init -y
npm install @hive/scout typescript
```

### Step 2: Implement the Hook

Create `src/myai.ts`:

```typescript
import { ProviderHook, TTPEvent, Scout } from '@hive/core';

interface MyAIRequest {
  model: string;
  prompt: string;
  maxTokens?: number;
}

interface MyAIResponse {
  id: string;
  model: string;
  completion: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
  duration_ms: number;
}

const MYAI_PRICING = {
  'myai-base': {
    prompt: 0.001,
    completion: 0.002,
  },
  'myai-pro': {
    prompt: 0.002,
    completion: 0.004,
  },
};

export class MyAIHook implements ProviderHook {
  name = 'myai';
  version = '1.0.0';

  constructor(private scout: Scout, private department?: string) {}

  intercept(request: MyAIRequest): InterceptionResult | undefined {
    // Validate this is a MyAI request
    if (!request.model?.startsWith('myai-')) {
      return undefined;
    }

    return {
      model: request.model,
      promptTokens: this.estimateTokens(request.prompt),
    };
  }

  parseResponse(response: MyAIResponse): ParsedMetadata {
    return {
      completionTokens: response.usage.completionTokens,
      latency: response.duration_ms,
      model: response.model,
    };
  }

  createEvent(
    request: MyAIRequest,
    response: MyAIResponse,
    metadata: ParsedMetadata
  ): TTPEvent {
    const pricing = MYAI_PRICING[response.model];
    const costPrompt =
      (metadata.promptTokens / 1000) * pricing.prompt;
    const costCompletion =
      (metadata.completionTokens / 1000) * pricing.completion;

    return {
      timestamp: new Date().toISOString(),
      provider: 'myai',
      model: response.model,
      tokens_prompt: metadata.promptTokens,
      tokens_completion: metadata.completionTokens,
      cost_usd: costPrompt + costCompletion,
      latency_ms: metadata.latency,
      department: this.department,
    };
  }

  private estimateTokens(text: string): number {
    // Simple heuristic: 1 token per 4 characters
    return Math.ceil(text.length / 4);
  }
}
```

### Step 3: Create the Connector Wrapper

Create `src/index.ts`:

```typescript
import { Scout } from '@hive/scout';
import { MyAIHook } from './myai';

// MyAI SDK types (you'd import the real SDK)
interface MyAIClient {
  complete(request: MyAIRequest): Promise<MyAIResponse>;
  completeStream(request: MyAIRequest): AsyncIterator<MyAIResponse>;
}

export interface MyAIConnectorConfig {
  scout: Scout;
  department?: string;
  enabled?: boolean;
}

export function createMyAIConnector(config: MyAIConnectorConfig) {
  const hook = new MyAIHook(config.scout, config.department);

  return {
    createClient(apiKey: string): MyAIClient {
      // Wrap the real MyAI SDK
      const realClient = new RealMyAIClient({ apiKey });

      return {
        async complete(request) {
          const startTime = Date.now();

          // Pre-call: extract metadata
          const intercepted = hook.intercept(request);
          if (!intercepted) {
            return realClient.complete(request);
          }

          try {
            // Make the call
            const response = await realClient.complete(request);

            // Post-call: extract response metadata
            const metadata = hook.parseResponse(response);

            // Create and send TTP event
            const event = hook.createEvent(request, response, metadata);
            config.scout.track(event);

            return response;
          } catch (error) {
            // Track the error
            config.scout.track({
              timestamp: new Date().toISOString(),
              provider: 'myai',
              model: request.model,
              tokens_prompt: intercepted.promptTokens,
              cost_usd: 0,
              latency_ms: Date.now() - startTime,
              error: error.message,
            });

            throw error;
          }
        },

        async *completeStream(request) {
          const startTime = Date.now();
          const intercepted = hook.intercept(request);

          if (!intercepted) {
            yield* realClient.completeStream(request);
            return;
          }

          let lastResponse: MyAIResponse | null = null;

          try {
            for await (const chunk of realClient.completeStream(request)) {
              lastResponse = chunk;
              yield chunk;
            }

            // After stream ends, track the final response
            if (lastResponse) {
              const metadata = hook.parseResponse(lastResponse);
              const event = hook.createEvent(
                request,
                lastResponse,
                metadata
              );
              config.scout.track(event);
            }
          } catch (error) {
            config.scout.track({
              timestamp: new Date().toISOString(),
              provider: 'myai',
              model: request.model,
              tokens_prompt: intercepted.promptTokens,
              cost_usd: 0,
              latency_ms: Date.now() - startTime,
              error: error.message,
            });

            throw error;
          }
        },
      };
    },
  };
}

// Placeholder for real SDK client
class RealMyAIClient implements MyAIClient {
  constructor(config: { apiKey: string }) {}
  async complete(request): Promise<MyAIResponse> {
    throw new Error('Not implemented');
  }
  async *completeStream(request): AsyncIterator<MyAIResponse> {
    throw new Error('Not implemented');
  }
}
```

### Step 4: Write Tests

Create `test/index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createMyAIConnector } from '../src/index';
import { MockScout } from '@hive/scout/testing';

describe('MyAI Connector', () => {
  it('should track a completion call', async () => {
    const mockScout = new MockScout();
    const connector = createMyAIConnector({
      scout: mockScout,
      department: 'engineering',
    });

    // Mock the API response
    const client = connector.createClient('test-key');
    // (Would normally test with a real or mocked SDK)

    // Verify Scout was called
    expect(mockScout.events.length).toBeGreaterThan(0);
    const event = mockScout.events[0];
    expect(event.provider).toBe('myai');
    expect(event.tokens_prompt).toBeGreaterThan(0);
    expect(event.tokens_completion).toBeGreaterThan(0);
    expect(event.cost_usd).toBeGreaterThan(0);
  });

  it('should handle errors', async () => {
    const mockScout = new MockScout();
    const connector = createMyAIConnector({ scout: mockScout });

    // Test error tracking...
  });
});
```

Run tests:

```bash
npm test
```

### Step 5: Package and Publish

Create `package.json`:

```json
{
  "name": "@hive/connector-myai",
  "version": "1.0.0",
  "description": "HIVE connector for MyAI",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  },
  "dependencies": {
    "@hive/core": "*",
    "@hive/scout": "*"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^0.34.0"
  }
}
```

Build:

```bash
npm run build
npm publish
```

## Integration Patterns

### Pattern 1: Fetch Wrapping

For providers without a native SDK:

```typescript
const originalFetch = globalThis.fetch;

globalThis.fetch = async (url, options) => {
  const startTime = Date.now();

  // Check if this is a MyAI request
  if (!url.includes('myai.com')) {
    return originalFetch(url, options);
  }

  const response = await originalFetch(url, options);
  const data = await response.json();

  // Extract tokens and cost
  const event = {
    timestamp: new Date().toISOString(),
    provider: 'myai',
    model: data.model,
    tokens_prompt: data.usage.promptTokens,
    tokens_completion: data.usage.completionTokens,
    cost_usd: data.usage.cost,
    latency_ms: Date.now() - startTime,
  };

  scout.track(event);

  // Return response (clone it since we consumed it)
  return new Response(JSON.stringify(data), { status: response.status });
};
```

### Pattern 2: Middleware

For HTTP frameworks:

```typescript
import express from 'express';

const app = express();

// HIVE tracking middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function (data) {
    if (req.path === '/api/complete') {
      const event = {
        timestamp: new Date().toISOString(),
        provider: 'myai',
        model: req.body.model,
        tokens_prompt: req.body.prompt.length / 4,
        tokens_completion: JSON.parse(data).completion.length / 4,
        latency_ms: Date.now() - startTime,
      };

      scout.track(event);
    }

    return originalSend.call(this, data);
  };

  next();
});
```

### Pattern 3: Monkey Patching

For SDKs with no wrapper support:

```typescript
import * as myai from 'myai';

const originalComplete = myai.Client.prototype.complete;

myai.Client.prototype.complete = async function (request) {
  const startTime = Date.now();
  const response = await originalComplete.call(this, request);

  scout.track({
    timestamp: new Date().toISOString(),
    provider: 'myai',
    model: request.model,
    tokens_prompt: response.usage.promptTokens,
    tokens_completion: response.usage.completionTokens,
    cost_usd: response.usage.cost,
    latency_ms: Date.now() - startTime,
  });

  return response;
};
```

## Best Practices

1. **Always include error handling** — Track failed requests too
2. **Estimate tokens accurately** — Use provider's tokenizer if available
3. **Support streaming** — Many providers return partial responses
4. **Update pricing regularly** — Cost estimates should reflect current rates
5. **Write comprehensive tests** — Mock provider responses
6. **Document usage** — Provide clear examples
7. **Handle authentication** — Never log or expose API keys

## Contributing

Contribute your connector back to HIVE:

1. Fork the HIVE repository
2. Add your connector to `packages/`
3. Submit a PR with tests and documentation
4. We'll merge and publish to npm

---

Next: [API Reference](/api/ingest) or [Dashboard Overview](/dashboard/overview).
