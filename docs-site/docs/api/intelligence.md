---
sidebar_position: 3
title: "Intelligence API"
description: "Cost modeling, anomalies, forecasting, clustering"
---

# Intelligence API

Access HIVE's intelligence analysis programmatically.

## Cost Breakdown

```
GET /api/v1/intelligence/cost
```

Query parameters:
- `from`: Start date (ISO 8601)
- `to`: End date (ISO 8601)
- `group_by`: `provider`, `model`, `department` (default: provider)

Response:

```json
{
  "period": {
    "from": "2026-04-01T00:00:00Z",
    "to": "2026-04-30T23:59:59Z"
  },
  "total_cost": 5234.56,
  "breakdown": [
    {
      "name": "openai",
      "cost": 3400.50,
      "percent": 65.0,
      "event_count": 45000
    },
    {
      "name": "anthropic",
      "cost": 1200.75,
      "percent": 23.0,
      "event_count": 15000
    }
  ]
}
```

## Anomalies

```
GET /api/v1/intelligence/anomalies
```

Query parameters:
- `severity`: `low`, `medium`, `high`, `critical` (comma-separated)
- `type`: `spend_spike`, `error_rate`, `shadow_ai`, `latency` (comma-separated)
- `from`: Start date
- `to`: End date
- `limit`: Max results (1-1000)

Response:

```json
{
  "anomalies": [
    {
      "id": "anom-001",
      "type": "spend_spike",
      "severity": "high",
      "timestamp": "2026-04-16T14:00:00Z",
      "department": "engineering",
      "observed": 90.0,
      "baseline": 50.0,
      "z_score": 2.5,
      "description": "Engineering spend spiked 80%"
    }
  ],
  "total": 15
}
```

## Forecasts

```
GET /api/v1/intelligence/forecast
```

Query parameters:
- `horizon`: `week`, `month`, `quarter` (default: month)
- `confidence`: `0.80`, `0.95`, `0.99` (default: 0.95)

Response:

```json
{
  "forecasts": [
    {
      "provider": "openai",
      "period": "2026-05-01 to 2026-05-31",
      "predicted_cost": 3500.0,
      "lower_bound": 3200.0,
      "upper_bound": 3800.0,
      "trend": "increasing"
    }
  ]
}
```

## Clustering

```
GET /api/v1/intelligence/clusters
```

Response:

```json
{
  "clusters": [
    {
      "id": "cluster-001",
      "name": "Interactive Chat",
      "size": 10000,
      "avg_prompt_tokens": 50,
      "avg_completion_tokens": 200,
      "avg_latency_ms": 1500,
      "cost_per_day": 45.0,
      "models": ["gpt-3.5-turbo"],
      "optimization": "Consider gpt-3.5-turbo for 90% cost savings"
    }
  ]
}
```

---

Next: [Config API](/api/config) or [Deployment](/deployment/modes).
