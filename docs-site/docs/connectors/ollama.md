---
sidebar_position: 3
title: "Ollama Connector"
description: "Tracking local LLM inference with Ollama and HIVE"
---

# Ollama Connector

The Ollama connector tracks local language model inference through the Ollama API.

## What It Tracks

The Ollama connector monitors all `/api/*` endpoints:

| Endpoint | Tracked | Metrics |
|----------|---------|---------|
| `/api/chat` | Yes | Tokens, latency, model |
| `/api/generate` | Yes | Tokens, latency, model |
| `/api/embeddings` | Yes | Token count, latency, model |
| `/api/tags` | No | (metadata only, not a call) |
| `/api/show` | No | (metadata only) |
| `/api/copy` | Yes | Model operations (for audit) |
| `/api/delete` | Yes | Model operations (for audit) |
| `/api/pull` | No | (not a consumption event) |

## Installation

```bash
npm install @hive/connector-ollama @hive/scout
```

## Setup

### Step 1: Start Ollama

```bash
ollama serve
```

Default: `http://localhost:11434`

### Step 2: Download a Model

```bash
ollama pull mistral
# OR
ollama pull llama2
# OR
ollama pull neural-chat
```

Check available models:

```bash
curl http://localhost:11434/api/tags
```

### Step 3: Initialize Scout

```typescript
import { createScout } from '@hive/scout';

const scout = createScout({
  nodeUrl: 'http://localhost:3001',
  department: 'engineering',
  batchSize: 10,
  flushIntervalMs: 5000,
});
```

### Step 4: Initialize Connector

```typescript
import { createOllamaConnector } from '@hive/connector-ollama';

const connector = createOllamaConnector({
  scout,
  ollamaUrl: 'http://localhost:11434',  // Default, optional
});

const client = connector.createClient();
```

## Usage

### Chat Endpoint

```typescript
const response = await client.chat({
  model: 'mistral',
  messages: [
    { role: 'user', content: 'What is Rust?' }
  ],
});

console.log(response.message.content);
```

Tracked as:

```json
{
  "provider": "ollama",
  "model": "mistral",
  "tokens_prompt": 25,
  "tokens_completion": 150,
  "cost_usd": 0.0,
  "latency_ms": 2500,
  "department": "engineering"
}
```

### Generation Endpoint

```typescript
const response = await client.generate({
  model: 'llama2',
  prompt: 'Why is Rust popular?',
  stream: false,
});

console.log(response.response);
```

Tracked as:

```json
{
  "provider": "ollama",
  "model": "llama2",
  "tokens_prompt": 20,
  "tokens_completion": 200,
  "cost_usd": 0.0,
  "latency_ms": 3500
}
```

### Embeddings Endpoint

```typescript
const response = await client.embeddings({
  model: 'neural-chat',
  prompt: 'HIVE is a token economy platform',
});

console.log(response.embedding);  // Float array
```

Tracked as:

```json
{
  "provider": "ollama",
  "model": "neural-chat",
  "tokens_prompt": 12,
  "cost_usd": 0.0,
  "latency_ms": 500
}
```

## Streaming

Ollama supports streaming responses:

```typescript
const response = await client.chat({
  model: 'mistral',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true,
});

for await (const chunk of response) {
  process.stdout.write(chunk.message.content);
}
```

The connector tracks completion tokens from the final response chunk (when stream ends).

## Configuration

Extended configuration options:

```typescript
interface OllamaConnectorConfig {
  scout: Scout;
  ollamaUrl?: string;              // Default: http://localhost:11434
  department?: string;             // Override department
  enabled?: boolean;               // Enable/disable tracking
  trackMetadataEndpoints?: boolean; // Track /tags, /show (default: false)
  costEstimation?: boolean;        // Enable cost estimation (default: true)
}
```

**Note:** Cost estimation for local models is $0 by default, since Ollama runs locally.

## Docker Setup

Run Ollama in Docker with HIVE tracking:

```bash
docker run -d \
  --name ollama \
  -p 11434:11434 \
  ollama/ollama
```

In your HIVE app:

```typescript
const connector = createOllamaConnector({
  scout,
  ollamaUrl: 'http://ollama:11434',  // Docker hostname
});
```

## GPU Acceleration

To enable GPU acceleration:

```bash
# NVIDIA GPU
docker run -d \
  --name ollama \
  --gpus all \
  -p 11434:11434 \
  ollama/ollama
```

Check GPU usage:

```bash
curl http://localhost:11434/api/ps
```

Response:

```json
{
  "models": [
    {
      "name": "mistral:latest",
      "size": 4000000000,
      "digest": "...",
      "details": {
        "family": "mistral",
        "parameter_size": "7B"
      },
      "expires_at": "2026-04-16T14:30:00Z",
      "size_vram": 3500000000  // GPU memory usage
    }
  ]
}
```

## Token Counting

Ollama automatically reports token usage in responses:

```json
{
  "message": {...},
  "eval_count": 150,           // Completion tokens
  "prompt_eval_count": 25,     // Prompt tokens
  "total_duration": 2500000000 // Nanoseconds
}
```

The connector extracts these and includes in TTP event.

## Error Handling

Errors are tracked:

```typescript
try {
  const response = await client.chat({
    model: 'nonexistent-model',
    messages: [...]
  });
} catch (error) {
  // Connector still tracks:
  // - error: "model_not_found"
  // - latency_ms: 100
}
```

Common errors:

| Error | Cause | Tracking |
|-------|-------|----------|
| `model_not_found` | Model not pulled | Tracked as error |
| `connection_refused` | Ollama not running | Retried with backoff |
| `timeout` | Request timed out | Tracked as error, retried |
| `out_of_memory` | GPU/RAM full | Tracked as error |

## Cost Estimation

For local models, cost is typically $0 (no API charges):

```typescript
const event = {
  provider: 'ollama',
  model: 'mistral',
  tokens_prompt: 100,
  tokens_completion: 50,
  cost_usd: 0.0,  // Local model
  latency_ms: 2000
};
```

If you want to estimate amortized cost (based on hardware):

```typescript
const connector = createOllamaConnector({
  scout,
  costEstimation: true,
  costPerTokenBillion: 0.001,  // Custom pricing
});
```

This estimates: `(tokens_total / 1_000_000_000) * costPerTokenBillion = cost_usd`

## Multi-Model Tracking

Track multiple models in one app:

```typescript
const mistral = await client.chat({
  model: 'mistral',
  messages: [...]
});

const llama2 = await client.generate({
  model: 'llama2',
  prompt: 'Hello'
});

// Both tracked separately in Scout
```

Dashboard will show cost breakdown by model.

## Monitoring

Check Ollama status:

```bash
curl http://localhost:11434/api/tags
```

Lists all installed models with sizes.

Check currently loaded models:

```bash
curl http://localhost:11434/api/ps
```

Shows real-time memory usage.

## Performance Tuning

For high-volume inference:

```typescript
const scout = createScout({
  nodeUrl: 'http://localhost:3001',
  batchSize: 50,              // Larger batches
  flushIntervalMs: 10000,     // Flush every 10s
  maxRetries: 3,
});

const connector = createOllamaConnector({
  scout,
  enabled: true,
});
```

This reduces overhead on Ollama for large inference workloads.

## Troubleshooting

**"Connection refused"?**
```bash
curl http://localhost:11434/api/tags
```

Ensure Ollama is running.

**Model not found?**
```bash
ollama pull mistral
ollama list
```

Pull the model first.

**Slow inference?**
- Check CPU usage
- Enable GPU if available
- Try smaller model (mistral vs llama2)

**Events not tracked?**
- Verify Scout is initialized
- Check Node URL is correct
- Ensure Node server is running

---

Next: [OpenAI Connector](/connectors/openai) or [Custom Connector](/connectors/custom).
