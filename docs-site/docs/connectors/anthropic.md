---
sidebar_position: 4
title: "Anthropic Connector"
description: "Track Anthropic Claude API usage with token counts"
---

# Anthropic Connector

The Anthropic connector tracks all Claude API calls.

## Installation

```bash
npm install @hive/connector-anthropic @hive/scout
```

## Setup

```typescript
import { createScout } from '@hive/scout';
import { createAnthropicConnector } from '@hive/connector-anthropic';

const scout = createScout({
  nodeUrl: 'http://localhost:3001',
  department: 'research',
});

const connector = createAnthropicConnector({ scout });

const anthropic = connector.createClient({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

## Usage

### Messages API

```typescript
const message = await anthropic.messages.create({
  model: 'claude-opus',
  max_tokens: 1024,
  messages: [
    {
      role: 'user',
      content: 'Explain quantum computing'
    }
  ],
});

console.log(message.content[0].text);
```

Tracked as:

```json
{
  "provider": "anthropic",
  "model": "claude-opus",
  "tokens_prompt": 15,
  "tokens_completion": 250,
  "cost_usd": 0.015,
  "latency_ms": 2100
}
```

**Model pricing:**

| Model | Prompt | Completion |
|-------|--------|-----------|
| claude-3-opus | $0.015/1K | $0.075/1K |
| claude-3-sonnet | $0.003/1K | $0.015/1K |
| claude-3-haiku | $0.00025/1K | $0.00125/1K |
| claude-2.1 | $0.008/1K | $0.024/1K |

## Streaming

Streaming responses:

```typescript
const stream = anthropic.messages.stream({
  model: 'claude-opus',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Hello, Claude!' }
  ],
});

stream.on('text', (text) => {
  process.stdout.write(text);
});

const finalMessage = await stream.finalMessage();
```

Token counts are extracted from the final message.

## Vision (Images)

Claude Opus supports image analysis:

```typescript
const response = await anthropic.messages.create({
  model: 'claude-opus',
  max_tokens: 1024,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'url',
            url: 'https://example.com/image.jpg'
          }
        },
        {
          type: 'text',
          text: 'Describe this image'
        }
      ]
    }
  ],
});
```

Images count as tokens:
- JPEG/PNG: ~(width * height) / 750 tokens
- Typical image: 100-1000 tokens

HIVE tracks total tokens including image processing.

## System Prompts

Include system instructions:

```typescript
const response = await anthropic.messages.create({
  model: 'claude-opus',
  max_tokens: 1024,
  system: 'You are a helpful assistant. Respond in markdown.',
  messages: [
    { role: 'user', content: 'What is HIVE?' }
  ],
});
```

System prompt tokens are included in prompt count.

## Configuration

```typescript
interface AnthropicConnectorConfig {
  scout: Scout;
  department?: string;
  enabled?: boolean;
  apiVersion?: string;  // e.g., "2023-06-01"
}
```

## Error Handling

API errors are tracked:

```typescript
try {
  const message = await anthropic.messages.create({
    model: 'invalid-model',
    max_tokens: 1024,
    messages: []
  });
} catch (error) {
  // Tracked as:
  // {
  //   "provider": "anthropic",
  //   "error": "invalid_request",
  //   "latency_ms": 200
  // }
}
```

## Cost Optimization

Use Claude Haiku for simple tasks:

```typescript
// Cheap: Haiku for summarization
const summary = await anthropic.messages.create({
  model: 'claude-3-haiku',
  max_tokens: 500,
  messages: [
    { role: 'user', content: `Summarize: ${longText}` }
  ],
});

// Expensive: Opus for complex reasoning
const analysis = await anthropic.messages.create({
  model: 'claude-opus',
  max_tokens: 2000,
  messages: [
    { role: 'user', content: 'Analyze this...' }
  ],
});
```

Dashboard will show cost breakdown by model.

---

Next: [Custom Connector](/connectors/custom) or [Dashboard Overview](/dashboard/overview).
