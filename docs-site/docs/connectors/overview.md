---
sidebar_position: 1
title: "Connectors Overview"
description: "How connectors work, ProviderHook interface, fetch wrapping, and supported providers"
---

# Connectors Overview

Connectors are transparent wrappers around AI provider SDKs. They intercept API calls, extract tokens and costs, and ship events to Scout.

## How Connectors Work

A connector wraps a provider's client library:

```
Your App
  │
  ├─ import connector
  │
  ├─ connector.createClient({ apiKey: '...' })
  │         │
  │         └─> Wraps provider SDK
  │            (e.g., OpenAI client)
  │
  ├─ client.chat.completions.create({...})
  │         │
  │         └─> Connector intercepts
  │            - Extracts tokens
  │            - Computes cost
  │            - Creates TTP event
  │            - Calls Scout
  │
  └─ (response returned unchanged)
```

**Key principle:** The connector is transparent. Your code doesn't need to change.

## ProviderHook Interface

All connectors implement ProviderHook:

```typescript
interface ProviderHook {
  name: string;                    // Provider name (openai, anthropic, etc.)
  version: string;                 // Connector version
  
  intercept(request: ApiRequest): InterceptionResult | undefined;
  // Called before API call
  // Returns: tokens, cost, or undefined if not tracked
  
  parseResponse(response: ApiResponse): ParsedMetadata;
  // Called after API response
  // Extracts: completion tokens, error details, latency
  
  createEvent(request, response, metadata): TTPEvent;
  // Combines all data into a TTP event
}
```

## Supported Providers

| Provider | Package | Status | Tracked Endpoints |
|----------|---------|--------|-------------------|
| OpenAI | `@hive/connector-openai` | Stable | `/v1/chat/completions`, `/v1/embeddings` |
| Anthropic | `@hive/connector-anthropic` | Stable | `/v1/messages` |
| Ollama | `@hive/connector-ollama` | Stable | `/api/chat`, `/api/generate`, `/api/embeddings` |
| Google | `@hive/connector-google` | Beta | `/v1beta1/generateContent` |
| Mistral | `@hive/connector-mistral` | Beta | `/v1/chat/completions` |
| AWS Bedrock | `@hive/connector-bedrock` | Beta | `/model/invoke` |
| Azure OpenAI | `@hive/connector-azure-openai` | Stable | `/v1/chat/completions` |

## Installation

Install the connector for your provider:

```bash
npm install @hive/connector-openai @hive/scout
```

## Basic Setup

Initialize Scout first:

```typescript
import { createScout } from '@hive/scout';

const scout = createScout({
  nodeUrl: 'http://localhost:3001',
  department: 'engineering',
  batchSize: 10,
  flushIntervalMs: 5000,
});
```

Then initialize the connector:

```typescript
import { createOpenAIConnector } from '@hive/connector-openai';

const connector = createOpenAIConnector({ scout });

const openai = connector.createClient({
  apiKey: process.env.OPENAI_API_KEY,
});

// Use as normal
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

Every call is tracked automatically.

## Cost Estimation

Connectors compute cost based on token count and provider pricing:

```typescript
// OpenAI pricing (updated monthly)
const OPENAI_PRICING = {
  'gpt-4': {
    prompt: 0.00003,        // $0.03 per 1K prompt tokens
    completion: 0.00006,    // $0.06 per 1K completion tokens
  },
  'gpt-3.5-turbo': {
    prompt: 0.0000015,
    completion: 0.000002,
  },
};

// Compute cost
const costPrompt = (tokens.prompt / 1000) * pricing.prompt;
const costCompletion = (tokens.completion / 1000) * pricing.completion;
const costTotal = costPrompt + costCompletion;
```

Pricing is updated in the connector code. Check GitHub for latest rates.

## Fetch Wrapping

Some connectors use fetch wrapping to intercept all HTTP calls:

```typescript
// Scout wraps globalThis.fetch
const originalFetch = globalThis.fetch;

globalThis.fetch = async function(url, options) {
  // Pre-call: extract metadata
  const startTime = Date.now();
  const metadata = extractMetadata(url, options);
  
  // Make the actual call
  const response = await originalFetch(url, options);
  
  // Post-call: extract response data
  const latency = Date.now() - startTime;
  const responseData = await response.json();
  
  // Create TTP event
  const event = {
    timestamp: new Date().toISOString(),
    provider: 'ollama',
    model: metadata.model,
    tokens_prompt: responseData.prompt_eval_count,
    tokens_completion: responseData.eval_count,
    latency_ms: latency,
    ...
  };
  
  // Send to Scout
  scout.track(event);
  
  // Return response (unchanged)
  return response;
};
```

This approach works for any provider that uses HTTP, even if no official SDK exists.

## Streaming Support

Connectors support streaming responses:

```typescript
// OpenAI streaming
const stream = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}

// Connector tracks completion tokens from final metadata_finish_reason
```

For streaming, token counts are extracted from the final message (when stream ends).

## Error Handling

Connectors track errors:

```typescript
try {
  const response = await openai.chat.completions.create({...});
} catch (error) {
  // Connector still tracks the failed request
  // TTP event includes: error: "rate_limit_exceeded", tokens_prompt: X, latency_ms: Y
  scout.track({
    timestamp: new Date().toISOString(),
    provider: 'openai',
    model: 'gpt-4',
    tokens_prompt: 100,
    tokens_completion: 0,
    error: error.code,  // e.g., "rate_limit_exceeded"
    latency_ms: 500,
    ...
  });
}
```

## Multi-Provider Usage

Use multiple connectors in the same app:

```typescript
import { createOpenAIConnector } from '@hive/connector-openai';
import { createAnthropicConnector } from '@hive/connector-anthropic';
import { createScout } from '@hive/scout';

const scout = createScout({ nodeUrl: 'http://localhost:3001' });

const openai = createOpenAIConnector({ scout }).createClient({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = createAnthropicConnector({ scout }).createClient({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Use both
const openaiResponse = await openai.chat.completions.create({...});
const anthropicResponse = await anthropic.messages.create({...});

// Both tracked in one Scout instance
```

## Configuration Options

All connectors support:

```typescript
interface ConnectorConfig {
  scout: Scout;                    // Required: Scout instance
  department?: string;             // Override department
  enabled?: boolean;               // Enable/disable tracking
  sampleRate?: number;             // Track only X% of calls (0-1)
  batchSize?: number;              // Override batch size
  maxRetries?: number;             // Retry failed shipments
  timeout?: number;                // Request timeout (ms)
}
```

Example:

```typescript
const connector = createOpenAIConnector({
  scout,
  department: 'research',
  sampleRate: 0.1,  // Track only 10% of calls
  enabled: true,
});
```

## Performance Impact

Connectors have minimal overhead:

- **Memory:** < 1 MB per connector instance
- **CPU:** < 1% when batching (async)
- **Latency:** < 10ms added per request (mostly I/O to Node)

Scout batches events, so high-volume apps (1000s of calls/sec) experience minimal impact.

## Zero Content Guarantee

All connectors:
- Never read request/response body
- Never extract prompts or completions
- Never store or transmit content
- Never access API keys (pass through to provider)

This is auditable in the source code.

## Testing Connectors

Unit test a connector:

```typescript
import { createOpenAIConnector } from '@hive/connector-openai';
import { MockScout } from '@hive/scout/testing';

const mockScout = new MockScout();
const connector = createOpenAIConnector({ scout: mockScout });

// Trigger a call
const response = await connector.createClient({...}).chat.completions.create({...});

// Verify Scout was called
expect(mockScout.events).toHaveLength(1);
expect(mockScout.events[0]).toEqual({
  provider: 'openai',
  model: 'gpt-4',
  tokens_prompt: 100,
  tokens_completion: 50,
  cost_usd: 0.003,
});
```

## Troubleshooting

**No events tracked?**
- Verify Scout is initialized and `nodeUrl` is correct
- Check connector is created before API calls
- Ensure Node server is running and accepting events

**Wrong cost estimates?**
- Connector pricing may be outdated
- Check connector changelog for pricing updates
- Submit issue to update pricing

**Streaming responses not tracked?**
- Streaming token counts come from `message.usage` at stream end
- Ensure you're consuming the entire stream
- Some providers don't return completion tokens for streaming

**High memory usage?**
- Reduce `batchSize` in Scout config
- Increase `flushIntervalMs` to flush more often
- Check for memory leaks in middleware

---

Next: [OpenAI Connector](/connectors/openai), [Anthropic Connector](/connectors/anthropic), or [Custom Connector](/connectors/custom).
