---
sidebar_position: 3
title: "Notifications & Alerts"
description: "Configure notifications for anomalies, errors, and compliance alerts"
---

# Notifications & Alerts

HIVE can send real-time alerts to Slack, email, PagerDuty, or webhooks.

## Alert Types

| Alert | Trigger | Severity |
|-------|---------|----------|
| Spend Spike | Spend > 2σ from baseline | High |
| Error Rate Spike | Error rate 2x baseline | Medium |
| Shadow AI | Unsanctioned provider detected | High |
| Latency Anomaly | p95 latency 2σ above baseline | Low |
| Compliance Violation | PII/content assertion failed | Critical |
| Quota Exceeded | API rate limit hit | High |
| Retention Violation | Data kept past retention policy | Medium |

## Slack Integration

### Step 1: Create a Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App"
3. Choose "From scratch"
4. Name: "HIVE"
5. Workspace: your workspace

### Step 2: Enable Webhooks

1. In the Slack app settings, go to "Incoming Webhooks"
2. Toggle "Activate Incoming Webhooks" ON
3. Click "Add New Webhook to Workspace"
4. Select channel (e.g., #hive-alerts)
5. Copy webhook URL

### Step 3: Configure HIVE

Dashboard → Settings → Notifications

Paste webhook URL:

```
https://hooks.slack.com/services/TXXXXX/BXXXXX/your-webhook-token
```

Test:

```bash
curl -X POST https://hooks.slack.com/services/TXXXXX/BXXXXX/your-webhook-token \
  -H 'Content-Type: application/json' \
  -d '{"text": "HIVE test alert"}'
```

### Alert Format

When an alert fires:

```
HIVE Alert: Spend Spike (Engineering)
────────────────────────────────────

Severity: HIGH
Time: 2026-04-16 14:00 UTC

Baseline: $50/hour
Actual: $90/hour
Delta: +$40 (+80%)

Recommended action:
└─ Review automated workloads in engineering

View dashboard: http://localhost:3000/anomalies
```

## Email Notifications

### Configuration

Dashboard → Settings → Notifications

Email addresses:
```
engineering-team@company.com
devops-on-call@company.com
```

Alert rules:
```
[✓] Spend spikes (severity: high, medium)
[✓] Error rates (severity: medium)
[✓] Shadow AI (severity: high)
[✗] Latency anomalies
[✓] Compliance violations (severity: critical)
```

### Email Format

```
Subject: HIVE Alert: Spend Spike (Engineering)

From: alerts@hive.io
To: engineering-team@company.com

────────────────────────────────────

HIVE Alert

Severity: HIGH

Alert Type: Spend Spike
Time: 2026-04-16 14:00 UTC
Department: Engineering

Details:
  Baseline spend: $50/hour
  Actual spend: $90/hour
  Difference: +80% (+$40)

Recommendation:
  Review automated workloads. Check for:
  ├─ Batch processing jobs
  ├─ Model fine-tuning
  ├─ Cache misses
  └─ Retry storms

View more: http://dashboard.hive.io/anomalies

────────────────────────────────────
```

## PagerDuty Integration

### Step 1: Create a PagerDuty Service

1. Go to PagerDuty dashboard
2. Create new service: "HIVE Alerts"
3. Select escalation policy
4. Save

### Step 2: Get Integration Key

In service settings:
- Copy the "Integration Key" (sometimes called "Routing Key")

### Step 3: Configure HIVE

Dashboard → Settings → Notifications

PagerDuty integration key:
```
YOUR_INTEGRATION_KEY_HERE
```

Alert routing:
```
Spend spike → Urgency: high
Error rate spike → Urgency: high
Shadow AI → Urgency: critical
Latency → Urgency: low
```

## Webhook Integration

Custom webhook for any HTTP endpoint:

Dashboard → Settings → Notifications

Webhook URL:
```
https://my-system.example.com/hive-webhooks
```

HIVE sends POST requests:

```json
{
  "type": "spend_spike",
  "severity": "high",
  "timestamp": "2026-04-16T14:00:00Z",
  "department": "engineering",
  "baseline": 50.0,
  "actual": 90.0,
  "delta_percent": 80.0,
  "delta_usd": 40.0,
  "alert_id": "alert-001"
}
```

Your endpoint should respond with:

```json
{
  "status": "received",
  "id": "alert-001"
}
```

## Alert Rules Engine

Fine-grained control over what triggers alerts.

### Rule Syntax

```
IF <condition> THEN <action>
```

Examples:

```
# Alert on engineering spend spike
IF department = "engineering" AND spend_spike_percent > 50 
THEN send_slack_webhook(channel=#eng-alerts) AND send_email(to=eng-lead@co.com)

# Suppress low-severity latency alerts
IF alert_type = "latency_anomaly" AND severity = "low"
THEN skip_notification

# Critical compliance alerts go to everyone
IF alert_type = "compliance_violation" AND severity = "critical"
THEN send_slack_webhook(channel=#incidents) AND send_pagerduty(urgency=critical)
```

### Configure Rules

Dashboard → Settings → Alert Rules

```
Rule 1: Engineering Team Alerts
  ├─ Department: engineering
  ├─ Alert types: spend_spike, error_rate, shadow_ai
  ├─ Severity: high, critical
  ├─ Action: Slack #hive-eng
  └─ Enabled: [✓]

Rule 2: Compliance Alerts
  ├─ Alert types: compliance_violation, retention_violation
  ├─ Severity: critical, medium
  ├─ Action: Slack #incidents, Email security-team@co.com, PagerDuty
  └─ Enabled: [✓]

Rule 3: Suppress Low Severity
  ├─ Severity: low
  ├─ Action: Skip notification
  └─ Enabled: [✓]
```

## Do Not Disturb

Suppress alerts during maintenance windows:

Dashboard → Settings → Maintenance Windows

```
Maintenance Window
  ├─ Name: "Database migration"
  ├─ Start: 2026-04-17 02:00 UTC
  ├─ Duration: 2 hours
  ├─ Suppress alerts: [✓] All
  └─ Enabled: [✓]
```

During maintenance, alerts are queued but not sent. They're visible in Dashboard afterward.

## Alert History

View all alerts (fired, suppressed, acknowledged):

Dashboard → Alerts → History

```
Alert History (Last 30 days)
──────────────────────────

2026-04-16 14:00 | SPEND_SPIKE | engineering | HIGH | ✓ Acknowledged
2026-04-16 13:30 | ERROR_RATE | openai | MEDIUM | Resolved
2026-04-16 12:00 | SHADOW_AI | cohere | HIGH | ✓ Investigating
```

Click to see full details and timeline.

## Testing Alerts

Trigger a test alert:

Dashboard → Settings → Notifications → Test

```
Select alert type: [Spend Spike ▼]
Department: [Engineering ▼]
Severity: [High ▼]

[Send Test Alert]
```

All configured notification channels receive the test alert.

---

Next: [Chat Widget](/dashboard/chat-widget) or [API Reference](/api/ingest).
