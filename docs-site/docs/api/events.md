---
sidebar_position: 2
title: "Events API"
description: "Query recent events"
---

# Events API

Query recent AI consumption events.

## Endpoint

```
GET /api/v1/events/recent
```

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 100 | Max events to return (1-1000) |
| `offset` | number | 0 | Pagination offset |
| `provider` | string | - | Filter by provider (openai, anthropic, etc.) |
| `model` | string | - | Filter by model |
| `department` | string | - | Filter by department |
| `min_cost` | number | - | Minimum cost (USD) |
| `max_cost` | number | - | Maximum cost (USD) |
| `from` | string | 24h ago | Start time (ISO 8601) |
| `to` | string | now | End time (ISO 8601) |

## Response

```json
{
  "events": [
    {
      "id": "event-001",
      "timestamp": "2026-04-16T14:32:11Z",
      "provider": "openai",
      "model": "gpt-4",
      "tokens_prompt": 150,
      "tokens_completion": 75,
      "cost_usd": 0.0045,
      "latency_ms": 1234,
      "department": "engineering",
      "request_id": "req-001",
      "error": null
    }
  ],
  "total": 5000,
  "limit": 100,
  "offset": 0
}
```

## Examples

```bash
# Last 100 events
curl http://localhost:3001/api/v1/events/recent?limit=100

# OpenAI events from last 7 days
curl "http://localhost:3001/api/v1/events/recent?provider=openai&from=2026-04-09T00:00:00Z"

# Engineering department, last 24 hours
curl "http://localhost:3001/api/v1/events/recent?department=engineering&limit=500"

# Expensive events (> $0.01)
curl "http://localhost:3001/api/v1/events/recent?min_cost=0.01"
```

---

Next: [Intelligence API](/api/intelligence) or [Config API](/api/config).
