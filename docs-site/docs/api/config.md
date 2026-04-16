---
sidebar_position: 4
title: "Config API"
description: "Manage HIVE configuration"
---

# Config API

Manage HIVE configuration (providers, governance, departments).

## Get Configuration

```
GET /api/v1/config
```

Response:

```json
{
  "providers": {
    "openai": {
      "apiKey": "sk-...",
      "enabled": true
    },
    "anthropic": {
      "apiKey": "sk-ant-...",
      "enabled": true
    }
  },
  "governance": {
    "defaultRegulation": "none",
    "defaultDataResidency": "us-east-1",
    "defaultRetentionDays": 90
  },
  "departments": [
    {
      "id": "eng",
      "name": "Engineering",
      "costCenter": "1001"
    },
    {
      "id": "mkt",
      "name": "Marketing",
      "costCenter": "2001"
    }
  ]
}
```

## Update Configuration

```
POST /api/v1/config
```

Request body (partial update):

```json
{
  "governance": {
    "defaultRegulation": "hipaa",
    "defaultDataResidency": "us-east-1",
    "defaultRetentionDays": 365
  }
}
```

Response:

```json
{
  "status": "updated",
  "timestamp": "2026-04-16T14:35:00Z"
}
```

---

Next: [Deployment Modes](/deployment/modes) or [Contributing](/contributing).
