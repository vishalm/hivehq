---
sidebar_position: 2
title: "OpenAI Connector"
description: "Track OpenAI API usage with token counts and cost"
---

# OpenAI Connector

The OpenAI connector tracks all Chat Completion and Embedding API calls.

## Installation

```bash
npm install @hive/connector-openai @hive/scout
```

## Setup

### Initialize Scout

```typescript
import { createScout } from '@hive/scout';

const scout = createScout({
  nodeUrl: 'http://localhost:3001',
  department: 'engineering',
});
```

### Initialize Connector

```typescript
import { createOpenAIConnector } from '@hive/connector-openai';

const connector = createOpenAIConnector({ scout });

const openai = connector.createClient({
  apiKey: process.env.OPENAI_API_KEY,
});
```

## Tracked Endpoints

| Endpoint | Tracked | Metrics |
|----------|---------|---------|
| `/v1/chat/completions` | Yes | Prompt tokens, completion tokens, cost |
| `/v1/embeddings` | Yes | Token count, cost |
| `/v1/completions` | Yes | Tokens, cost (legacy) |
| `/v1/models` | No | (metadata only) |

## Chat Completions

Standard usage:

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'What is the capital of France?' }
  ],
});

console.log(response.choices[0].message.content);
```

Tracked as:

```json
{
  "provider": "openai",
  "model": "gpt-4",
  "tokens_prompt": 25,
  "tokens_completion": 10,
  "cost_usd": 0.001,
  "latency_ms": 1200,
  "department": "engineering"
}
```

**Model pricing** (as of 2026-04-16):

| Model | Prompt | Completion | Type |
|-------|--------|-----------|------|
| gpt-4 | $0.03/1K | $0.06/1K | Reasoning |
| gpt-4-turbo | $0.01/1K | $0.03/1K | Fast |
| gpt-3.5-turbo | $0.0005/1K | $0.0015/1K | Cheap |
| gpt-4o | $0.005/1K | $0.015/1K | Multimodal |

## Streaming

Streaming responses are supported:

```typescript
const stream = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

Token counts are extracted from the final message (when stream ends):

```json
{
  "provider": "openai",
  "model": "gpt-4",
  "tokens_prompt": 25,
  "tokens_completion": 100,
  "cost_usd": 0.0045
}
```

## Embeddings

Embedding API usage:

```typescript
const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'HIVE is a token economy platform',
});

console.log(response.data[0].embedding);  // Float array
```

Tracked as:

```json
{
  "provider": "openai",
  "model": "text-embedding-3-small",
  "tokens_prompt": 12,
  "cost_usd": 0.000002
}
```

**Embedding pricing:**

| Model | Cost |
|-------|------|
| text-embedding-3-small | $0.02/1M |
| text-embedding-3-large | $0.13/1M |

## Vision

GPT-4V (Vision) with image input:

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4-vision',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is in this image?' },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/image.jpg' }
        }
      ]
    }
  ],
});
```

Token counting for images:

```
Image size → tokens
Small (<512x512): ~170 tokens
Large (>512x512): ~765 tokens
Precision: high (2x multiplier)
```

HIVE tracks the total tokens including image processing.

## Function Calling

Function calling with schema:

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Check the weather' }],
  functions: [
    {
      name: 'get_weather',
      description: 'Get weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' }
        },
        required: ['location']
      }
    }
  ],
  function_call: 'auto',
});
```

Token counts include function definitions.

## Configuration

Extended options:

```typescript
interface OpenAIConnectorConfig {
  scout: Scout;
  department?: string;           // Override department
  enabled?: boolean;             // Enable/disable tracking
  apiUrl?: string;              // Custom OpenAI-compatible endpoint
  modelPricingOverride?: Record<string, ModelPricing>;  // Custom pricing
}
```

Example with custom endpoint (Azure OpenAI):

```typescript
const connector = createOpenAIConnector({
  scout,
  apiUrl: 'https://my-azure-openai.openai.azure.com',
});

const client = connector.createClient({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  defaultQuery: { 'api-version': '2023-05-15' },
});
```

## Error Tracking

API errors are tracked:

```typescript
try {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [],  // Empty messages
  });
} catch (error) {
  // Tracked as:
  // {
  //   "provider": "openai",
  //   "model": "gpt-4",
  //   "error": "invalid_request",
  //   "tokens_prompt": 0,
  //   "latency_ms": 150
  // }
}
```

Common errors:

| Error | Cause |
|-------|-------|
| `rate_limit_exceeded` | Quota exceeded |
| `invalid_api_key` | Wrong or expired key |
| `invalid_request` | Malformed request |
| `server_error` | OpenAI service issue |
| `timeout` | Request timed out |

## Cost Breakdown

View cost by model in Dashboard:

```
Model Costs (Last 30 days)
├─ gpt-4: $1,234.56 (45 calls)
├─ gpt-3.5-turbo: $12.34 (5,000 calls)
├─ gpt-4-turbo: $234.56 (2,000 calls)
└─ text-embedding-3-small: $0.02 (1M tokens)
```

Cost = (prompt_tokens / 1000) * prompt_price + (completion_tokens / 1000) * completion_price

## Rate Limiting

OpenAI enforces rate limits:

```
gpt-4: 500 RPM, 40,000 TPM
gpt-3.5-turbo: 90,000 RPM, 3,500,000 TPM
```

When rate limited (HTTP 429), Scout automatically retries with exponential backoff:

```
Attempt 1: wait 1s
Attempt 2: wait 2s
Attempt 3: wait 4s
Attempt 4: wait 8s
(max 60s total)
```

Check rate limit status in response headers:

```
x-ratelimit-limit-requests: 3500
x-ratelimit-remaining-requests: 3499
x-ratelimit-reset-requests: 1s
```

## Batch API

For cost-effective processing of non-urgent requests:

```typescript
const client = connector.createClient({ apiKey: '...' });

// Create batch file
const batch = [
  {
    "custom_id": "request-1",
    "method": "POST",
    "url": "/v1/chat/completions",
    "body": {
      "model": "gpt-4",
      "messages": [{"role": "user", "content": "Hello"}]
    }
  }
];

// Submit batch (returns batch_id)
const response = await client.batches.create({
  input_file_id: fileId,
});
```

Batch API is 50% cheaper but 24-hour turnaround. HIVE tracks batch costs separately.

## Best Practices

1. **Use appropriate models**: gpt-3.5-turbo for simple tasks, gpt-4 for complex reasoning
2. **Minimize prompt tokens**: Use caching or summarization
3. **Cache completions**: Reuse results for repeated requests
4. **Monitor costs**: Use HIVE Dashboard to identify expensive calls
5. **Set budget limits**: Configure spending alerts in Dashboard

## Troubleshooting

**Events not tracked?**
- Verify API key is correct
- Check Scout is initialized
- Ensure Node server is running

**Wrong token counts?**
- Use OpenAI's tokenizer to verify: https://platform.openai.com/tokenizer
- Token counts come from OpenAI in the response

**Cost is $0?**
- Verify pricing is current (updated monthly)
- Check Dashboard for pricing errors
- Submit issue if pricing is outdated

**Rate limited constantly?**
- Reduce batch size in Scout config
- Increase flushIntervalMs
- Use Batch API for non-urgent requests
- Contact OpenAI about raising limits

---

Next: [Anthropic Connector](/connectors/anthropic) or [API Reference](/api/ingest).
